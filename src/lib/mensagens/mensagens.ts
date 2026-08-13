import "server-only";

import { MessageCircleWarning } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { substituirVariaveis } from "@/lib/certificados/texto";
import { enviarWhatsapp } from "./evolution";
import { normalizarTelefone } from "./texto";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";
import type { createClient } from "@/lib/supabase/server";
import type { MensagemStatus, MensagemTipo, MensagemEnviada } from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function formatarDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarHorario(time: string): string {
  return time.slice(0, 5);
}

type ContextoAluno = {
  alunos: { telefone: string; profiles: { full_name: string | null } | null } | null;
};

// Núcleo do envio: monta o texto a partir do template configurado, valida
// telefone/config, chama a Evolution API e sempre grava uma linha no log —
// nunca lança exceção (política "loga o erro e segue", ver CLAUDE.md/plano
// aprovado). Chamado só pelas três funções públicas abaixo.
async function enviarMensagem(params: {
  tipo: MensagemTipo;
  matriculaId: string | null;
  leadId: string | null;
  aulaId: string | null;
  telefoneAlunoBruto: string;
  variaveis: Record<string, string>;
  criadoPor: string | null;
}): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data: config } = await admin
      .from("whatsapp_config")
      .select(
        "ativo, evolution_api_url, evolution_instance_name, evolution_api_key, template_matricula_criada, template_lembrete_aula, template_falta, template_lead_recontato",
      )
      .eq("id", true)
      .single();

    // ativo=false é pausa deliberada do admin — não é falha, não loga nada.
    if (!config || !config.ativo) return;

    const template = {
      matricula_criada: config.template_matricula_criada,
      lembrete_aula: config.template_lembrete_aula,
      falta: config.template_falta,
      lead_recontato: config.template_lead_recontato,
    }[params.tipo];
    const mensagemTexto = substituirVariaveis(template, params.variaveis);

    const registrar = (status: MensagemStatus, telefoneDestino: string, erroDetalhe: string | null) =>
      admin.from("mensagens_enviadas").insert({
        tipo: params.tipo,
        matricula_id: params.matriculaId,
        lead_id: params.leadId,
        aula_id: params.aulaId,
        telefone_destino: telefoneDestino,
        mensagem_texto: mensagemTexto,
        status,
        erro_detalhe: erroDetalhe,
        created_by: params.criadoPor,
      });

    if (!config.evolution_api_url || !config.evolution_instance_name || !config.evolution_api_key) {
      await registrar("falha", params.telefoneAlunoBruto, "Evolution API não configurada (URL/instância/chave ausente).");
      return;
    }

    const numero = normalizarTelefone(params.telefoneAlunoBruto);
    if (!numero) {
      await registrar("falha", params.telefoneAlunoBruto, "Telefone do aluno inválido ou ausente.");
      return;
    }

    const resultado = await enviarWhatsapp(
      {
        url: config.evolution_api_url,
        instancia: config.evolution_instance_name,
        apiKey: config.evolution_api_key,
      },
      numero,
      mensagemTexto,
    );

    await registrar(resultado.ok ? "enviado" : "falha", numero, resultado.ok ? null : resultado.erro);
  } catch {
    // Rede de segurança final: nenhum erro inesperado aqui pode voltar a
    // interromper a matrícula/presença que chamou esta function.
  }
}

// Disparada por createMatricula logo após o insert. Busca a data/horário da
// primeira aula via calendario_aulas_turma (a mesma function que já resolve
// o cronograma no portal do aluno).
export async function enviarMensagemMatriculaCriada(
  matriculaId: string,
  criadoPor: string,
): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from("matriculas")
      .select("turma_id, alunos(telefone, profiles!alunos_id_fkey(full_name)), turmas(nome, horario_aula, cursos(nome))")
      .eq("id", matriculaId)
      .single();

    const matricula = data as unknown as
      | (ContextoAluno & {
          turma_id: string;
          turmas: { nome: string; horario_aula: string | null; cursos: { nome: string } | null } | null;
        })
      | null;

    if (!matricula?.alunos || !matricula.turmas) return;

    const { data: calendario } = await admin.rpc("calendario_aulas_turma", {
      p_turma_id: matricula.turma_id,
    });
    const primeiraAula = ((calendario ?? []) as { numero_sessao: number; data_liberacao: string }[]).sort(
      (a, b) => a.numero_sessao - b.numero_sessao,
    )[0];

    await enviarMensagem({
      tipo: "matricula_criada",
      matriculaId,
      leadId: null,
      aulaId: null,
      telefoneAlunoBruto: matricula.alunos.telefone,
      criadoPor,
      variaveis: {
        nome_aluno: matricula.alunos.profiles?.full_name ?? "aluno(a)",
        nome_curso: matricula.turmas.cursos?.nome ?? "",
        nome_turma: matricula.turmas.nome,
        data_aula: primeiraAula ? formatarDataBR(primeiraAula.data_liberacao) : "a definir",
        horario_aula: matricula.turmas.horario_aula ? formatarHorario(matricula.turmas.horario_aula) : "a definir",
      },
    });
  } catch {
    // idem: matrícula já foi criada com sucesso antes desta chamada.
  }
}

// Disparada por registrarPresencas quando detecta uma transição pra
// status='falta' (ver comentário em presencas/actions.ts — a comparação de
// "é uma falta nova" é feita lá, não aqui).
export async function enviarMensagemFalta(
  matriculaId: string,
  aulaId: string,
  dataAula: string,
  criadoPor: string,
): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from("matriculas")
      .select("alunos(telefone, profiles!alunos_id_fkey(full_name)), turmas(cursos(nome))")
      .eq("id", matriculaId)
      .single();

    const matricula = data as unknown as
      | (ContextoAluno & { turmas: { cursos: { nome: string } | null } | null })
      | null;

    if (!matricula?.alunos) return;

    await enviarMensagem({
      tipo: "falta",
      matriculaId,
      leadId: null,
      aulaId,
      telefoneAlunoBruto: matricula.alunos.telefone,
      criadoPor,
      variaveis: {
        nome_aluno: matricula.alunos.profiles?.full_name ?? "aluno(a)",
        nome_curso: matricula.turmas?.cursos?.nome ?? "",
        data_aula: formatarDataBR(dataAula),
      },
    });
  } catch {
    // idem: presença já foi registrada com sucesso antes desta chamada.
  }
}

// Disparada pela Route Handler do cron diário (/api/cron/lembretes-aula),
// uma vez por matrícula ativa, pra cada aula que cai amanhã. created_by
// fica null — não há sessão autenticada nesse contexto (ver migration).
export async function enviarMensagemLembreteAula(
  matriculaId: string,
  aulaId: string,
  dataAula: string,
  horarioAula: string | null,
): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from("matriculas")
      .select("alunos(telefone, profiles!alunos_id_fkey(full_name)), turmas(cursos(nome))")
      .eq("id", matriculaId)
      .single();

    const matricula = data as unknown as
      | (ContextoAluno & { turmas: { cursos: { nome: string } | null } | null })
      | null;

    if (!matricula?.alunos) return;

    await enviarMensagem({
      tipo: "lembrete_aula",
      matriculaId,
      leadId: null,
      aulaId,
      telefoneAlunoBruto: matricula.alunos.telefone,
      criadoPor: null,
      variaveis: {
        nome_aluno: matricula.alunos.profiles?.full_name ?? "aluno(a)",
        nome_curso: matricula.turmas?.cursos?.nome ?? "",
        data_aula: formatarDataBR(dataAula),
        horario_aula: horarioAula ? formatarHorario(horarioAula) : "horário a confirmar",
      },
    });
  } catch {
    // idem.
  }
}

// Disparada tanto pelo envio manual (admin seleciona leads em /admin/leads
// e clica "Enviar recontato") quanto pelo automático (createTurma, pra
// leads novo/contatado do curso da turma recém-criada) — em ambos os
// casos o disparo em si é sempre uma decisão explícita do admin (criar a
// turma, ou clicar o botão), nunca um job agendado.
export async function enviarMensagemLeadRecontato(
  leadId: string,
  criadoPor: string | null,
  contexto?: { nomeTurma: string; dataInicioTurma: string },
): Promise<void> {
  try {
    const admin = createAdminClient();

    const { data } = await admin
      .from("leads")
      .select("nome, telefone, cursos(nome)")
      .eq("id", leadId)
      .single();

    const lead = data as unknown as { nome: string; telefone: string; cursos: { nome: string } | null } | null;
    if (!lead) return;

    await enviarMensagem({
      tipo: "lead_recontato",
      matriculaId: null,
      leadId,
      aulaId: null,
      telefoneAlunoBruto: lead.telefone,
      criadoPor,
      variaveis: {
        nome_lead: lead.nome,
        nome_curso: lead.cursos?.nome ?? "",
        nome_turma: contexto?.nomeTurma ?? "a definir",
        data_inicio_turma: contexto?.dataInicioTurma ? formatarDataBR(contexto.dataInicioTurma) : "a definir",
      },
    });
  } catch {
    // idem: a criação da turma ou o clique do admin já foram bem-sucedidos
    // antes desta chamada, nunca devem ser desfeitos por causa disso.
  }
}

// Chamado só pelo botão "Reenviar" da tela de log — atualiza a mesma linha
// em vez de inserir uma nova (mesmo espírito de certificados.status
// mudando de pendente_emissao pra emitido em cima da linha existente: o
// "reenvio" é uma nova tentativa do mesmo evento, não um evento novo).
export async function reenviarMensagemFalha(id: string): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: original } = await admin
    .from("mensagens_enviadas")
    .select("telefone_destino, mensagem_texto, status")
    .eq("id", id)
    .single();

  if (!original || original.status !== "falha") {
    return { error: "Mensagem não encontrada ou não está com falha." };
  }

  const { data: config } = await admin
    .from("whatsapp_config")
    .select("ativo, evolution_api_url, evolution_instance_name, evolution_api_key")
    .eq("id", true)
    .single();

  if (!config?.ativo || !config.evolution_api_url || !config.evolution_instance_name || !config.evolution_api_key) {
    return { error: "WhatsApp não está ativo ou configurado." };
  }

  const numero = normalizarTelefone(original.telefone_destino) ?? original.telefone_destino;
  const resultado = await enviarWhatsapp(
    { url: config.evolution_api_url, instancia: config.evolution_instance_name, apiKey: config.evolution_api_key },
    numero,
    original.mensagem_texto,
  );

  await admin
    .from("mensagens_enviadas")
    .update({
      status: resultado.ok ? "enviado" : "falha",
      erro_detalhe: resultado.ok ? null : resultado.erro,
      telefone_destino: numero,
    })
    .eq("id", id);

  return resultado.ok ? {} : { error: resultado.erro };
}

// evolution_api_key não tem grant de select pra authenticated — a tela de
// configuração não consegue ler nem "só a existência" pelo client normal.
// Esta function roda com o client admin só pra devolver um boolean, nunca
// o valor em si.
export async function getChaveEvolutionConfigurada(): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("whatsapp_config").select("evolution_api_key").eq("id", true).single();
  return !!data?.evolution_api_key;
}

// destinatarioNome: nome do aluno (via matricula_id) ou do lead (via
// lead_id) — os dois tipos de destinatário aparecem juntos na mesma
// tela/histórico, já que compartilham a mesma tabela de log.
export type MensagemEnviadaComContexto = MensagemEnviada & {
  destinatarioNome: string | null;
  nomeCurso: string | null;
};

export async function getMensagensEnviadas(
  supabase: SupabaseServerClient,
): Promise<MensagemEnviadaComContexto[]> {
  const { data } = await supabase
    .from("mensagens_enviadas")
    .select(
      "id, tipo, matricula_id, lead_id, aula_id, telefone_destino, mensagem_texto, status, erro_detalhe, created_at, matriculas(alunos(profiles!alunos_id_fkey(full_name)), turmas(cursos(nome))), leads(nome, cursos(nome))",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return ((data ?? []) as unknown as Array<
    MensagemEnviada & {
      matriculas: {
        alunos: { profiles: { full_name: string | null } | null } | null;
        turmas: { cursos: { nome: string } | null } | null;
      } | null;
      leads: { nome: string; cursos: { nome: string } | null } | null;
    }
  >).map((m) => ({
    ...m,
    destinatarioNome: m.matriculas?.alunos?.profiles?.full_name ?? m.leads?.nome ?? null,
    nomeCurso: m.matriculas?.turmas?.cursos?.nome ?? m.leads?.cursos?.nome ?? null,
  }));
}

export async function getNotificacaoMensagensFalha(
  supabase: SupabaseServerClient,
): Promise<DashboardNotificacao | null> {
  const { count } = await supabase
    .from("mensagens_enviadas")
    .select("*", { count: "exact", head: true })
    .eq("status", "falha");

  if (!count) return null;

  return {
    chave: "mensagens-falha",
    titulo: "Mensagens de WhatsApp com falha de envio",
    quantidade: count,
    href: "/admin/mensagens",
    icone: MessageCircleWarning,
  };
}
