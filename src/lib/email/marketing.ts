import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { carregarConfigEmail } from "@/lib/email/config";
import { emailConfigurado, enviarEmail } from "@/lib/email/provedor";
import { htmlParaTexto, renderizarTexto } from "@/lib/email/renderizar";
import { LIMITE_LOTE, VARIAVEIS_CAMPANHA, type SegmentoEmail } from "@/lib/email/marketing-tipos";
import { anexarRodapeDescadastro, linkDescadastro } from "@/lib/email/descadastro";

// E-mail Marketing: escolha dos destinatários e envio em lotes.
//
// Envio em LOTES, RETOMÁVEL. Cada lote = 10 e-mails, com 1s de pausa entre lotes. Dentro
// do lote os envios saem ESPAÇADOS (500ms no Resend, que limita a 2 requisições/s;
// 100ms nos outros) — 10 requisições de uma vez estourariam o limite. Isso dá ~1,7
// e-mails/s. Como uma função serverless tem tempo limitado, cada execução trabalha por
// um ORÇAMENTO de tempo e devolve quantos faltam; quem chama (Server Action em segundo
// plano, tela de detalhes ou cron) continua depois. Nada se repete: só os `pendente`
// são enviados, e uma trava curta impede duas execuções simultâneas.

export type Destinatario = { email: string; nome: string; aluno_id: string };

type Supabase = ReturnType<typeof createAdminClient>;

const TAMANHO_PAGINA = 1000;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// O PostgREST devolve no máximo 1000 linhas por requisição: lê tudo paginando.
async function lerTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; de < 500_000; de += TAMANHO_PAGINA) {
    const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const pagina = (data ?? []) as T[];
    linhas.push(...pagina);
    if (pagina.length < TAMANHO_PAGINA) break;
  }
  return linhas;
}

async function idsAlunos(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<Set<string>> {
  const linhas = await lerTudo<{ aluno_id: string }>(consulta);
  return new Set(linhas.map((linha) => linha.aluno_id));
}

// ===== a) Destinatários =====

export async function getDestinatarios(segmento: SegmentoEmail, cursoId?: string | null): Promise<Destinatario[]> {
  const admin = createAdminClient();

  const alunos = await lerTudo<{ id: string; email: string | null; full_name: string | null; email_marketing_ativo: boolean | null }>((de, ate) =>
    admin.from("alunos").select("id, email, full_name, email_marketing_ativo").not("email", "is", null).order("id").range(de, ate),
  );

  // Descadastrados (LGPD) NUNCA entram, em nenhum segmento. Dois critérios: a marca no
  // aluno E o registro por e-mail — este último vale mesmo se o mesmo endereço estiver
  // em outro cadastro, ou se o aluno original tiver sido excluído.
  const descadastrados = new Set(
    (await lerTudo<{ email: string }>((de, ate) => admin.from("email_descadastros").select("email").order("id").range(de, ate))).map((linha) =>
      linha.email.toLowerCase(),
    ),
  );

  let manter: (alunoId: string) => boolean = () => true;
  if (segmento === "ativos" || segmento === "inativos") {
    const ativos = await idsAlunos((de, ate) => admin.from("matriculas").select("aluno_id").eq("status", "ativa").order("id").range(de, ate));
    manter = segmento === "ativos" ? (id) => ativos.has(id) : (id) => !ativos.has(id);
  } else if (segmento === "sem_matricula") {
    const comMatricula = await idsAlunos((de, ate) => admin.from("matriculas").select("aluno_id").order("id").range(de, ate));
    manter = (id) => !comMatricula.has(id);
  } else if (segmento === "com_cobranca_atrasada") {
    const atrasados = await idsAlunos((de, ate) => admin.from("parcelas").select("aluno_id").eq("status", "atrasado").order("id").range(de, ate));
    manter = (id) => atrasados.has(id);
  } else if (segmento === "curso_especifico") {
    if (!cursoId) return [];
    // Qualquer matrícula em turma do curso, exceto as canceladas.
    const doCurso = await idsAlunos((de, ate) =>
      admin
        .from("matriculas")
        .select("aluno_id, turmas!inner(curso_id)")
        .eq("turmas.curso_id", cursoId)
        .neq("status", "cancelada")
        .order("id")
        .range(de, ate),
    );
    manter = (id) => doCurso.has(id);
  }

  // Dedup por e-mail (minúsculo): dois cadastros com o mesmo endereço recebem uma vez.
  const vistos = new Set<string>();
  const destinatarios: Destinatario[] = [];
  for (const aluno of alunos) {
    const email = aluno.email?.trim().toLowerCase();
    if (!email || !REGEX_EMAIL.test(email) || vistos.has(email) || !manter(aluno.id)) continue;
    if (aluno.email_marketing_ativo === false || descadastrados.has(email)) continue;
    vistos.add(email);
    destinatarios.push({ email, nome: aluno.full_name?.trim() || "", aluno_id: aluno.id });
  }
  return destinatarios;
}

// ===== b) Envio =====

type LinhaCampanha = {
  id: string;
  assunto: string;
  corpo_html: string;
  segmento: SegmentoEmail;
  curso_id: string | null;
  status: string;
};

export type ResultadoInicio = { ok: true; total: number } | { ok: false; erro: string };

// Passo 1: congela a lista de destinatários (uma linha `pendente` por pessoa) e põe a
// campanha em "enviando". Só sai de rascunho/agendada — o UPDATE condicional é a
// trava contra dois cliques (ou cron + clique) iniciarem a mesma campanha.
export async function iniciarEnvioCampanha(campanhaId: string): Promise<ResultadoInicio> {
  const admin = createAdminClient();

  const { data: atual, error: erroLeitura } = await admin
    .from("email_campanhas_marketing")
    .select("id, assunto, corpo_html, segmento, curso_id, status")
    .eq("id", campanhaId)
    .maybeSingle();
  if (erroLeitura || !atual) return { ok: false, erro: "Campanha não encontrada." };
  const campanha = atual as LinhaCampanha;

  if (campanha.status !== "rascunho" && campanha.status !== "agendada") {
    return { ok: false, erro: "Esta campanha já foi iniciada." };
  }
  if (!campanha.assunto.trim() || !campanha.corpo_html.trim()) return { ok: false, erro: "A campanha precisa de assunto e corpo." };
  if (!(await emailConfigurado())) {
    return { ok: false, erro: "O provedor de e-mail não está configurado (Configurações > E-mail)." };
  }

  let destinatarios: Destinatario[];
  try {
    destinatarios = await getDestinatarios(campanha.segmento, campanha.curso_id);
  } catch {
    return {
      ok: false,
      erro: "Não foi possível montar a lista de destinatários (a migration email_descadastros foi aplicada?).",
    };
  }
  if (destinatarios.length === 0) return { ok: false, erro: "Nenhum destinatário encontrado para este segmento." };

  const statusAnterior = campanha.status;
  const { data: reservada } = await admin
    .from("email_campanhas_marketing")
    .update({ status: "enviando", total_destinatarios: destinatarios.length, total_enviados: 0, total_erros: 0, processando_ate: null })
    .eq("id", campanhaId)
    .eq("status", statusAnterior)
    .select("id");
  if (!reservada?.length) return { ok: false, erro: "Esta campanha já foi iniciada." };

  // Recomeço limpo (uma campanha que voltou de "cancelada" não passa por aqui; isto é só rede de segurança).
  await admin.from("email_campanhas_envios").delete().eq("campanha_id", campanhaId);

  for (let i = 0; i < destinatarios.length; i += 500) {
    const { error } = await admin.from("email_campanhas_envios").insert(
      destinatarios.slice(i, i + 500).map((d) => ({
        campanha_id: campanhaId,
        aluno_id: d.aluno_id,
        email: d.email,
        nome: d.nome || null,
        status: "pendente",
      })),
    );
    if (error) {
      await admin.from("email_campanhas_envios").delete().eq("campanha_id", campanhaId);
      await admin.from("email_campanhas_marketing").update({ status: statusAnterior, total_destinatarios: 0 }).eq("id", campanhaId);
      return { ok: false, erro: "Não foi possível registrar os destinatários. Tente novamente." };
    }
  }
  return { ok: true, total: destinatarios.length };
}

export type ResultadoProcessamento = {
  enviados: number;
  erros: number;
  // Quantos ainda faltam (pendentes).
  restantes: number;
  concluida: boolean;
  // Outra execução está enviando agora — tente de novo em instantes.
  ocupada: boolean;
};

const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Falha de limite de requisições: vale tentar de novo depois de uma pausa.
const REGEX_LIMITE = /too many|rate.?limit|429|throttl/i;

const ORCAMENTO_PADRAO_MS = 50_000;
// Um lote leva ~6s (10 envios espaçados + pausa): não começa outro sem folga.
const FOLGA_POR_LOTE_MS = 9_000;
const TRAVA_MS = 90_000;

async function contar(admin: Supabase, campanhaId: string, status?: string): Promise<number> {
  let consulta = admin.from("email_campanhas_envios").select("id", { count: "exact", head: true }).eq("campanha_id", campanhaId);
  if (status) consulta = consulta.eq("status", status);
  const { count } = await consulta;
  return count ?? 0;
}

// Passo 2: envia os `pendente` em lotes, por até `orcamentoMs`. Devolve quantos faltam.
export async function processarEnvios(campanhaId: string, opcoes: { orcamentoMs?: number } = {}): Promise<ResultadoProcessamento> {
  const inicio = Date.now();
  const orcamento = opcoes.orcamentoMs ?? ORCAMENTO_PADRAO_MS;
  const admin = createAdminClient();

  // Trava: só uma execução por campanha por vez.
  const agora = new Date().toISOString();
  const { data: travada } = await admin
    .from("email_campanhas_marketing")
    .update({ processando_ate: new Date(Date.now() + TRAVA_MS).toISOString() })
    .eq("id", campanhaId)
    .eq("status", "enviando")
    .or(`processando_ate.is.null,processando_ate.lt.${agora}`)
    .select("id, assunto, corpo_html");

  if (!travada?.length) {
    const { data: campanha } = await admin.from("email_campanhas_marketing").select("status").eq("id", campanhaId).maybeSingle();
    const restantes = await contar(admin, campanhaId, "pendente");
    return {
      enviados: 0,
      erros: 0,
      restantes,
      concluida: campanha?.status === "enviada" || campanha?.status === "cancelada",
      ocupada: campanha?.status === "enviando",
    };
  }
  const { assunto, corpo_html: corpo } = travada[0] as { assunto: string; corpo_html: string };

  const config = await carregarConfigEmail();
  // Resend: 2 req/s => 500ms entre envios. Os demais toleram mais.
  const espacamento = (config?.provedor ?? "resend") === "resend" ? 500 : 100;

  let nomeEscola = "GÊNEZI Educação";
  try {
    const { data } = await admin.from("configuracoes").select("escola_nome").eq("id", true).maybeSingle();
    if (data?.escola_nome) nomeEscola = data.escola_nome as string;
  } catch {
    // mantém o padrão
  }

  let enviados = 0;
  let erros = 0;
  let concluida = false;

  try {
    let primeiroLote = true;
    for (;;) {
      // Orçamento de tempo e cancelamento são checados ANTES de cada lote.
      if (Date.now() - inicio > orcamento - FOLGA_POR_LOTE_MS) break;
      const { data: estado } = await admin.from("email_campanhas_marketing").select("status").eq("id", campanhaId).maybeSingle();
      if (estado?.status !== "enviando") {
        concluida = estado?.status === "enviada";
        break;
      }

      const { data: lote } = await admin
        .from("email_campanhas_envios")
        .select("id, email, nome")
        .eq("campanha_id", campanhaId)
        .eq("status", "pendente")
        .order("created_at")
        .order("id")
        .limit(LIMITE_LOTE);

      if (!lote?.length) {
        concluida = true;
        break;
      }

      // 1s de pausa entre lotes (não antes do primeiro).
      if (!primeiroLote) await dormir(1000);
      primeiroLote = false;

      for (const destino of lote as { id: string; email: string; nome: string | null }[]) {
        const variaveis = { nome_cliente: destino.nome || "aluno(a)", email_cliente: destino.email, nome_escola: nomeEscola };
        const assuntoFinal = renderizarTexto(assunto, variaveis, VARIAVEIS_CAMPANHA, { escapar: false });

        // Rodapé de descadastro OBRIGATÓRIO em todo e-mail de campanha, com o link único
        // deste destinatário (não faz parte do texto editável). O cabeçalho List-Unsubscribe
        // faz o próprio Gmail/Outlook mostrar "cancelar inscrição".
        const link = linkDescadastro(destino.email);
        const html = anexarRodapeDescadastro(renderizarTexto(corpo, variaveis, VARIAVEIS_CAMPANHA, { escapar: true }), link);
        const enviar = () =>
          enviarEmail({
            para: destino.email,
            assunto: assuntoFinal,
            html,
            texto: htmlParaTexto(html),
            headers: { "List-Unsubscribe": `<${link}>` },
          });

        // O espaçamento conta do INÍCIO de cada envio (a latência da chamada entra no intervalo).
        const [resultado] = await Promise.all([
          (async () => {
            let r = await enviar();
            for (let tentativa = 0; tentativa < 2 && !r.ok && REGEX_LIMITE.test(r.erro ?? ""); tentativa++) {
              await dormir(2000 * (tentativa + 1));
              r = await enviar();
            }
            return r;
          })(),
          dormir(espacamento),
        ]);

        await admin
          .from("email_campanhas_envios")
          .update(
            resultado.ok
              ? { status: "enviado", enviado_at: new Date().toISOString(), erro: null }
              : { status: "erro", erro: (resultado.erro ?? "Falha desconhecida").slice(0, 500) },
          )
          .eq("id", destino.id);
        if (resultado.ok) enviados++;
        else erros++;
      }

      // Contadores da campanha + estende a trava.
      const [totalEnviados, totalErros] = await Promise.all([contar(admin, campanhaId, "enviado"), contar(admin, campanhaId, "erro")]);
      await admin
        .from("email_campanhas_marketing")
        .update({ total_enviados: totalEnviados, total_erros: totalErros, processando_ate: new Date(Date.now() + TRAVA_MS).toISOString() })
        .eq("id", campanhaId)
        .eq("status", "enviando");
    }
  } finally {
    // Sempre solta a trava (e, se acabou, fecha a campanha) — mesmo se algo lançar.
    const [totalEnviados, totalErros] = await Promise.all([contar(admin, campanhaId, "enviado"), contar(admin, campanhaId, "erro")]);
    await admin
      .from("email_campanhas_marketing")
      .update({ total_enviados: totalEnviados, total_erros: totalErros, processando_ate: null, ...(concluida ? { status: "enviada" } : {}) })
      .eq("id", campanhaId)
      .eq("status", "enviando");
  }

  return { enviados, erros, restantes: await contar(admin, campanhaId, "pendente"), concluida, ocupada: false };
}

// Atalho: inicia (se preciso) e envia o primeiro trecho.
export async function enviarCampanha(campanhaId: string, opcoes: { orcamentoMs?: number } = {}): Promise<
  { ok: true; total: number; processamento: ResultadoProcessamento } | { ok: false; erro: string }
> {
  const inicio = await iniciarEnvioCampanha(campanhaId);
  if (!inicio.ok) return inicio;
  return { ok: true, total: inicio.total, processamento: await processarEnvios(campanhaId, opcoes) };
}
