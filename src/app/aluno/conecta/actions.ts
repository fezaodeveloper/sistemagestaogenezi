"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateAge } from "@/lib/alunos/schema";
import { cancelarAssinaturaConecta } from "@/lib/asaas/client";
import { getVagasPublicasConecta } from "@/lib/conecta/publico";
import { notificarNovoCandidatoTelegram } from "@/lib/conecta/telegram";
import {
  perfilConectaFormSchema,
  type PerfilConecta,
  type VagasConectaFiltro,
  type VagasConectaResultado,
} from "@/lib/conecta/schema";

// matriculas.status = 'concluida' já significa curso concluído (mesmo
// critério usado em aluno/page.tsx pra agrupar cursos) — mais simples que
// juntar aulas_concluidas pra chegar na mesma informação.
export async function getCursosConcluidosAluno(alunoId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("matriculas")
    .select("turmas(cursos(nome))")
    .eq("aluno_id", alunoId)
    .eq("status", "concluida");

  type Row = { turmas: { cursos: { nome: string } | null } | null };
  const nomes = ((data as unknown as Row[]) ?? [])
    .map((row) => row.turmas?.cursos?.nome)
    .filter((nome): nome is string => Boolean(nome));

  return [...new Set(nomes)].sort((a, b) => a.localeCompare(b));
}

export async function getMeuPerfilConecta(): Promise<PerfilConecta | null> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase
    .from("perfis_conecta")
    .select("*")
    .eq("aluno_id", user.id)
    .maybeSingle();

  return (data as PerfilConecta | null) ?? null;
}

// Proteção de idade (TAREFA 1) — data_nascimento do aluno vive em public.alunos, NÃO em
// profiles nem em perfis_conecta (que só guarda esse campo pra candidatos EXTERNOS, ver
// migration). perfis_conecta.aluno_id referencia alunos(id), que é o mesmo id da sessão.
export async function getIdadeAlunoConecta(alunoId: string): Promise<number | null> {
  await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase.from("alunos").select("data_nascimento").eq("id", alunoId).maybeSingle();

  return data?.data_nascimento ? calculateAge(data.data_nascimento) : null;
}

export async function salvarPerfilConecta(formData: FormData): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const parsed = perfilConectaFormSchema.safeParse({
    whatsapp: formData.get("whatsapp") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    resumo: formData.get("resumo") || undefined,
    experiencias: formData.get("experiencias") || undefined,
    linkedin_url: formData.get("linkedin_url") || undefined,
    disponibilidade: formData.get("disponibilidade"),
    modalidade_preferida: formData.get("modalidade_preferida"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const data = parsed.data;
  const supabase = await createClient();
  // upsert com onConflict em aluno_id (unique na tabela) — cobre tanto o
  // primeiro salvamento (linha ainda não existe) quanto edições
  // seguintes, sem precisar checar antes se já existe uma linha.
  // tipo NUNCA entra no payload: a coluna tem default 'aluno' (cobre o INSERT de uma linha
  // nova), mas se já existir uma linha 'externo' (candidato pago editando o próprio perfil em
  // /aluno/conecta, que usa a mesma role 'aluno'), incluir tipo:"aluno" aqui sobrescreveria o
  // ON CONFLICT e flipparia esse candidato pra 'aluno' — a policy RLS de visibilidade pra
  // empresas libera QUALQUER perfil tipo='aluno' sem checar assinatura, então isso seria um
  // jeito de burlar a cobrança (ver "Empresas veem perfis visiveis e ativos" na migration).
  const { error } = await supabase.from("perfis_conecta").upsert(
    {
      aluno_id: user.id,
      whatsapp: data.whatsapp ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      resumo: data.resumo ?? null,
      experiencias: data.experiencias ?? null,
      linkedin_url: data.linkedin_url ?? null,
      disponibilidade: data.disponibilidade,
      modalidade_preferida: data.modalidade_preferida,
    },
    { onConflict: "aluno_id" },
  );

  if (error) {
    return { error: "Não foi possível salvar o perfil. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

// WhatsApp obrigatório só ao ATIVAR a visibilidade (REGRA da tarefa) — checa o valor já salvo
// em vez de exigir que o form de dados seja reenviado junto do toggle. Proteção de idade
// (TAREFA 1) só se aplica ao ATIVAR também, pelo mesmo motivo — desativar nunca é bloqueado.
// menorComTermo vem do client (checkbox já marcado) mas é só um indício: a idade de verdade é
// recalculada aqui a partir de alunos.data_nascimento, nunca confiando no client.
export async function toggleVisibilidadePerfil(
  visivel: boolean,
  menorComTermo = false,
): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();

  let menorComTermoConfirmado = false;
  let cidade: string | null = null;
  let estado: string | null = null;

  if (visivel) {
    const { data: perfil } = await supabase
      .from("perfis_conecta")
      .select("whatsapp, cidade, estado, termo_conecta_aceito")
      .eq("aluno_id", user.id)
      .maybeSingle();

    if (!perfil?.whatsapp) {
      return { error: "Informe seu WhatsApp antes de tornar o perfil visível." };
    }
    // Termo de participação (TAREFA: matrícula com opção "Participar do Gênezi Conecta") —
    // nunca confia só na checagem do client (VisibilidadeToggle já desabilita o switch antes
    // de aceitar), checa de novo aqui o valor já salvo em aceitarTermoParticipacaoConecta.
    if (!perfil.termo_conecta_aceito) {
      return { error: "Aceite o termo de participação antes de tornar o perfil visível." };
    }
    cidade = perfil.cidade;
    estado = perfil.estado;

    const { data: aluno } = await supabase.from("alunos").select("data_nascimento").eq("id", user.id).maybeSingle();
    if (aluno?.data_nascimento) {
      const idade = calculateAge(aluno.data_nascimento);
      if (idade < 16) {
        return { error: "Você precisa ter 16 anos para participar do Gênezi Conecta." };
      }
      if (idade < 18) {
        if (!menorComTermo) {
          return {
            error: "Declare que será acompanhado por um responsável legal nas entrevistas antes de ativar.",
          };
        }
        menorComTermoConfirmado = true;
      }
    }
  }

  const { error } = await supabase.from("perfis_conecta").upsert(
    {
      aluno_id: user.id,
      // tipo NUNCA entra no payload — ver comentário em salvarPerfilConecta acima.
      visivel,
      // Omitido (não incluído no payload) quando não é o caso — upsert com onConflict só
      // atualiza as colunas presentes aqui, então o valor já salvo (ex.: true de uma ativação
      // anterior) não é apagado ao simplesmente desativar a visibilidade.
      ...(menorComTermoConfirmado ? { menor_com_termo: true } : {}),
    },
    { onConflict: "aluno_id" },
  );

  if (error) {
    return { error: "Não foi possível atualizar a visibilidade. Tente novamente." };
  }

  // Notificação Telegram do Conecta (best-effort — já se protege por dentro, nunca lança) só ao
  // ATIVAR, nunca ao desativar — mesmo recorte do WhatsApp obrigatório/proteção de idade acima.
  if (visivel) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    await notificarNovoCandidatoTelegram({
      nome: profile?.full_name ?? "Aluno",
      tipo: "aluno",
      cidade,
      estado,
    });
  }

  revalidatePath("/aluno/conecta");
  return {};
}

// Termo de participação (TAREFA: matrícula com opção "Participar do Gênezi Conecta") — exigido
// antes de ativar a visibilidade (ver toggleVisibilidadePerfil acima). Diferente do termo de
// acompanhamento de menor (menor_com_termo): este é pedido a QUALQUER participante (aluno ou
// externo), não só a quem tem 16-17 anos.
export async function aceitarTermoParticipacaoConecta(): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  // tipo NUNCA entra no payload — ver comentário em salvarPerfilConecta (acima, neste arquivo).
  const { error } = await supabase.from("perfis_conecta").upsert(
    { aluno_id: user.id, termo_conecta_aceito: true, termo_conecta_data: new Date().toISOString() },
    { onConflict: "aluno_id" },
  );

  if (error) {
    return { error: "Não foi possível registrar o aceite do termo. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

// Cancelamento self-service pro candidato EXTERNO (diferente de cancelarAssinaturaCandidato em
// src/app/admin/conecta/candidatos/actions.ts, que é a mesma operação feita pelo admin) —
// confirma que a assinatura pertence mesmo ao usuário logado antes de cancelar no Asaas.
export async function cancelarMinhaAssinaturaConecta(): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfis_conecta")
    .select("asaas_subscription_id")
    .eq("aluno_id", user.id)
    .eq("tipo", "externo")
    .maybeSingle();

  if (!perfil?.asaas_subscription_id) {
    return { error: "Nenhuma assinatura ativa encontrada." };
  }

  try {
    await cancelarAssinaturaConecta(perfil.asaas_subscription_id);
  } catch {
    // Best-effort — segue pra desativar o perfil local mesmo se a assinatura já não existir
    // mais no Asaas (mesmo padrão de cancelarAssinaturaCandidato, admin/conecta/candidatos).
  }

  const { error } = await supabase
    .from("perfis_conecta")
    .update({ esta_ativo: false, visivel: false })
    .eq("aluno_id", user.id);

  if (error) {
    return { error: "Não foi possível cancelar a assinatura. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

// Upload em si acontece do lado do client, direto pro Supabase Storage
// (mesmo padrão de foto-aluno-upload.tsx) — essa action só grava o path já
// pronto na tabela. curriculo_url guarda o NOME ORIGINAL do arquivo (só
// pra exibição — "mostrar nome do arquivo atual"), não uma URL de verdade:
// o bucket é privado, então não existe uma URL pública fixa pra guardar
// ali; a coluna é reaproveitada porque já existe desde a Etapa 1 (sem
// migration nova).
export async function uploadCurriculoConecta(
  path: string,
  nomeArquivo: string,
): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  // tipo NUNCA entra no payload — ver comentário em salvarPerfilConecta (acima, neste arquivo).
  const { error } = await supabase.from("perfis_conecta").upsert(
    { aluno_id: user.id, curriculo_path: path, curriculo_url: nomeArquivo },
    { onConflict: "aluno_id" },
  );

  if (error) {
    return { error: "Currículo enviado mas não foi possível salvar. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

export async function removerCurriculoConecta(): Promise<{ error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfis_conecta")
    .select("curriculo_path")
    .eq("aluno_id", user.id)
    .maybeSingle();

  if (perfil?.curriculo_path) {
    await supabase.storage.from("curriculos-conecta").remove([perfil.curriculo_path]);
  }

  const { error } = await supabase
    .from("perfis_conecta")
    .update({ curriculo_path: null, curriculo_url: null })
    .eq("aluno_id", user.id);

  if (error) {
    return { error: "Não foi possível remover o currículo. Tente novamente." };
  }

  revalidatePath("/aluno/conecta");
  return {};
}

// Delegado a getVagasPublicasConecta (src/lib/conecta/publico.ts) — mesma
// consulta é usada pela página pública /conecta/vagas, sem sessão nenhuma
// (Etapa 6); aqui só entra o requireRole("aluno") antes, já que esta versão
// é chamada de dentro do portal autenticado.
export async function buscarVagasConecta(
  filtro: VagasConectaFiltro = {},
): Promise<VagasConectaResultado> {
  await requireRole("aluno");
  return getVagasPublicasConecta(filtro);
}

// Signed URL de curta duração (60s) — mesmo padrão de materiais/certificados
// (bucket privado, sem URL pública fixa). Client admin necessário: o bucket
// é privado e createSignedUrl não é afetado pela RLS do client autenticado
// mesmo sendo o próprio dono, porque a policy de select do bucket restringe
// a empresa/admin (ver migration de storage) — o aluno lê o PRÓPRIO
// currículo por aqui, contornando essa restrição com segurança porque a
// action já confirma que o path pertence à sessão autenticada.
export async function getUrlCurriculoConecta(): Promise<{ url?: string; error?: string }> {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const { data: perfil } = await supabase
    .from("perfis_conecta")
    .select("curriculo_path")
    .eq("aluno_id", user.id)
    .maybeSingle();

  if (!perfil?.curriculo_path) {
    return { error: "Nenhum currículo enviado ainda." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from("curriculos-conecta")
    .createSignedUrl(perfil.curriculo_path, 60);

  if (error || !data) {
    return { error: "Não foi possível gerar o link do currículo. Tente novamente." };
  }

  return { url: data.signedUrl };
}
