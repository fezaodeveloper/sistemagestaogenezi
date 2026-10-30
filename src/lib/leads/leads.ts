import "server-only";

import { UserPlus } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizarTelefone } from "@/lib/mensagens/texto";
import { dispararWebhook } from "@/lib/webhooks/disparar";
import { notificarSmsLeadConfirmacao } from "@/lib/integrax/notificacoes";
import { dispararFluxosPorGatilho } from "@/lib/whatsapp/fluxos";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";
import type { createClient } from "@/lib/supabase/server";
import {
  KANBAN_COLUNAS_ENCERRADAS,
  KANBAN_COLUNAS_PADRAO,
  type KanbanColuna,
  type KanbanColunaConfig,
  type Lead,
  type LeadFormValues,
  type LeadHistoricoEntrada,
  type LeadHistoricoTipo,
  type Temperatura,
} from "./schema";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

const DIAS_SEM_CONTATO = 7;

export type LeadSemContato = { id: string; nome: string; telefone: string; dias: number };

// Usado pelo cron de verificar-atrasos (TAREFA 9B) — leads que não viraram
// aluno_ativo (nem foram descartados/desistentes) e não têm nenhuma
// atualização (contato, mudança de status) há mais de 7 dias.
export async function verificarLeadsSemContato(admin: SupabaseAdminClient): Promise<LeadSemContato[]> {
  const limite = new Date();
  limite.setDate(limite.getDate() - DIAS_SEM_CONTATO);

  const { data } = await admin
    .from("leads")
    .select("id, nome, telefone, updated_at")
    .neq("status", "aluno_ativo")
    .lt("updated_at", limite.toISOString());

  return ((data ?? []) as { id: string; nome: string; telefone: string; updated_at: string }[]).map((lead) => ({
    id: lead.id,
    nome: lead.nome,
    telefone: lead.telefone,
    dias: Math.floor((Date.now() - new Date(lead.updated_at).getTime()) / 86400000),
  }));
}

export type LeadComCurso = Lead & {
  nomeCurso: string | null;
  // CRM 2.1 (TAREFA) — nomes resolvidos por embed, pra não expor só os ids nos cards/drawer.
  nomeCampanha: string | null;
  nomeResponsavel: string | null;
};

const LEADS_SELECT_COM_RELACOES =
  "*, cursos(nome), campanhas_marketing(nome), profiles!leads_responsavel_id_fkey(full_name)";

type LeadRow = Lead & {
  cursos: { nome: string } | null;
  campanhas_marketing: { nome: string } | null;
  profiles: { full_name: string | null } | null;
};

function mapearLeadComRelacoes(linha: LeadRow): LeadComCurso {
  return {
    ...linha,
    nomeCurso: linha.cursos?.nome ?? null,
    nomeCampanha: linha.campanhas_marketing?.nome ?? null,
    nomeResponsavel: linha.profiles?.full_name ?? null,
  };
}

export async function getLeads(
  supabase: SupabaseServerClient,
  paginacao?: { offset: number; limite: number },
  filtros?: { temperatura?: Temperatura; kanbanColuna?: KanbanColuna; campanhaOrigem?: string },
): Promise<{ itens: LeadComCurso[]; total: number }> {
  let query = supabase
    .from("leads")
    .select(LEADS_SELECT_COM_RELACOES, { count: "exact" })
    .order("created_at", { ascending: false });

  if (filtros?.temperatura) query = query.eq("temperatura", filtros.temperatura);
  if (filtros?.kanbanColuna) query = query.eq("kanban_coluna", filtros.kanbanColuna);
  if (filtros?.campanhaOrigem) query = query.eq("campanha_origem", filtros.campanhaOrigem);

  if (paginacao) {
    query = query.range(paginacao.offset, paginacao.offset + paginacao.limite - 1);
  }

  const { data, count } = await query;

  const itens = ((data ?? []) as unknown as LeadRow[]).map(mapearLeadComRelacoes);

  return { itens, total: count ?? 0 };
}

// Colunas do Kanban, em ordem (tabela kanban_colunas). Se a leitura falhar ou
// vier vazia (ex.: migration ainda não aplicada), cai nas 5 colunas padrão —
// o quadro continua funcionando em modo leitura em vez de sumir.
export async function getKanbanColunas(supabase: SupabaseServerClient): Promise<KanbanColunaConfig[]> {
  const { data, error } = await supabase
    .from("kanban_colunas")
    .select("id, nome, ordem, cor")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data || data.length === 0) return KANBAN_COLUNAS_PADRAO;
  return data as KanbanColunaConfig[];
}

// Valores distintos de campanha_origem, pro filtro da listagem/Kanban.
export async function getCampanhasOrigem(supabase: SupabaseServerClient): Promise<string[]> {
  const { data } = await supabase.from("leads").select("campanha_origem").not("campanha_origem", "is", null);
  const nomes = new Set<string>();
  for (const linha of (data ?? []) as { campanha_origem: string | null }[]) {
    if (linha.campanha_origem) nomes.add(linha.campanha_origem);
  }
  return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
}

// Kanban precisa de todos os leads "em aberto" de uma vez (agrupados em 5
// colunas no client), não faz sentido paginar — diferente de getLeads
// (Lista), que pagina normalmente. Aceitável em v1 pro volume atual de
// leads; se crescer muito, revisar com paginação por coluna.
export async function getLeadsKanban(supabase: SupabaseServerClient): Promise<LeadComCurso[]> {
  const { data } = await supabase
    .from("leads")
    .select(LEADS_SELECT_COM_RELACOES)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as LeadRow[]).map(mapearLeadComRelacoes);
}

// "Histórico de follow-ups" (drawer do Kanban) não tem tabela própria —
// reaproveita o campo notas como um log reverso-cronológico de entradas
// datadas, mesmo espírito do append em observacoes de
// criarOuAtualizarLeadPublico. Cada entrada vira uma linha
// "[DD/MM/AAAA HH:mm] texto", mais recente primeiro.
export function formatarEntradaFollowup(nota: string): string {
  const agora = new Date();
  const data = agora.toLocaleDateString("pt-BR");
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `[${data} ${hora}] ${nota}`;
}

export function adicionarEntradaNotas(notasAtual: string | null, novaEntrada: string): string {
  return [novaEntrada, notasAtual].filter(Boolean).join("\n");
}

export async function getLead(
  supabase: SupabaseServerClient,
  id: string,
): Promise<LeadComCurso | null> {
  const { data } = await supabase.from("leads").select(LEADS_SELECT_COM_RELACOES).eq("id", id).single();
  const lead = data as unknown as LeadRow | null;
  if (!lead) return null;
  return mapearLeadComRelacoes(lead);
}

// TAREFA: combobox de campanha no formulário/drawer.
export async function getCampanhasMarketingAtivas(
  supabase: SupabaseServerClient,
): Promise<{ id: string; nome: string }[]> {
  const { data } = await supabase
    .from("campanhas_marketing")
    .select("id, nome")
    .eq("status", "ativa")
    .order("nome", { ascending: true });
  return (data ?? []) as { id: string; nome: string }[];
}

// TAREFA: combobox de responsável — só admins (não há um papel "comercial" separado hoje; todo
// usuário com acesso ao painel é role='admin', ver CLAUDE.md).
export async function getResponsaveisAdmin(supabase: SupabaseServerClient): Promise<{ id: string; nome: string }[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "admin")
    .order("full_name", { ascending: true });
  return ((data ?? []) as { id: string; full_name: string | null }[]).map((p) => ({
    id: p.id,
    nome: p.full_name ?? "Admin",
  }));
}

// TAREFA: debounce no formulário — avisa se já existe um lead com esse telefone/WhatsApp, pra
// evitar duplicidade manual (o dedup de verdade, por telefone+curso, já existe no índice único
// parcial — isto aqui é só um aviso cedo, sem filtrar por curso).
export async function buscarLeadPorTelefoneOuWhatsapp(
  supabase: SupabaseServerClient,
  telefoneNormalizado: string,
  excluirId?: string,
): Promise<{ id: string; nome: string } | null> {
  let query = supabase
    .from("leads")
    .select("id, nome, telefone, whatsapp")
    .or(`telefone.eq.${telefoneNormalizado},whatsapp.eq.${telefoneNormalizado}`)
    .limit(5);
  if (excluirId) query = query.neq("id", excluirId);

  const { data } = await query;
  const encontrado = (data ?? []).find(
    (l) => normalizarTelefone(l.telefone) === normalizarTelefone(telefoneNormalizado),
  );
  return encontrado ? { id: encontrado.id, nome: encontrado.nome } : null;
}

// ===== Integrações do Comercial (TAREFA CRM 2.2: campanha e agendamento público) =====
//
// Diferente de buscarLeadPorTelefoneOuWhatsapp (acima — usado só pro aviso de duplicado no
// formulário do admin): esta busca também por e-mail, roda com o client admin (contexto público,
// sem sessão) e devolve o lead inteiro, não só id/nome — os dois pontos de integração abaixo
// precisam ler/atualizar kanban_coluna, campanha_id etc.
export async function encontrarLeadPorWhatsappOuEmail(
  admin: SupabaseAdminClient,
  whatsapp: string,
  email?: string | null,
): Promise<Lead | null> {
  const normalizado = normalizarTelefone(whatsapp);
  const condicoes = [`telefone.eq.${whatsapp}`, `whatsapp.eq.${whatsapp}`];
  if (email) condicoes.push(`email.eq.${email}`);

  const { data } = await admin.from("leads").select("*").or(condicoes.join(","));
  const encontrado = (data ?? []).find(
    (l) =>
      (!!normalizado && (normalizarTelefone(l.telefone) === normalizado || normalizarTelefone(l.whatsapp ?? "") === normalizado)) ||
      (!!email && l.email === email),
  );
  return (encontrado as Lead | undefined) ?? null;
}

// ===== Histórico de atividades (tabela lead_historico, TAREFA CRM 2.1) =====

export async function getLeadHistorico(supabase: SupabaseServerClient, leadId: string): Promise<LeadHistoricoEntrada[]> {
  const { data } = await supabase
    .from("lead_historico")
    .select("id, tipo, descricao, coluna_anterior, coluna_nova, created_at, profiles(full_name)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    tipo: LeadHistoricoTipo;
    descricao: string;
    coluna_anterior: string | null;
    coluna_nova: string | null;
    created_at: string;
    profiles: { full_name: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((row) => ({
    id: row.id,
    tipo: row.tipo,
    descricao: row.descricao,
    colunaAnterior: row.coluna_anterior,
    colunaNova: row.coluna_nova,
    usuarioNome: row.profiles?.full_name ?? null,
    createdAt: row.created_at,
  }));
}

// Best-effort — nunca lança: registrar a atividade é um complemento, nunca pode derrubar a ação
// principal (mover coluna, salvar anotação etc.) que já aconteceu com sucesso antes desta chamada.
export async function registrarHistoricoLead(
  supabase: SupabaseServerClient,
  leadId: string,
  tipo: LeadHistoricoTipo,
  descricao: string,
  extra?: { colunaAnterior?: string; colunaNova?: string; usuarioId?: string },
): Promise<void> {
  try {
    await supabase.from("lead_historico").insert({
      lead_id: leadId,
      tipo,
      descricao,
      coluna_anterior: extra?.colunaAnterior ?? null,
      coluna_nova: extra?.colunaNova ?? null,
      usuario_id: extra?.usuarioId ?? null,
    });
  } catch {
    // Best-effort — ver comentário acima.
  }
}

// ===== "Retornos pendentes" (TAREFA PARTE 4) =====
//
// Implementado em JS, não como uma única query SQL com subqueries/intervalos (supabase-js não
// expressa `now() - interval` nem múltiplos OR com subquery de forma direta) — mesmo padrão já
// usado no cron de follow-up (src/app/api/cron/followup-leads/route.ts) e em
// verificarLeadsSemContato acima: busca o universo candidato com filtros simples no banco,
// decide o motivo de cada alerta em JS.
export type RetornoPendente = {
  id: string;
  nome: string;
  telefone: string;
  whatsapp: string | null;
  colunaNome: string;
  motivo: string;
  proximoContato: string | null;
};

const LIMITE_RETORNOS_PENDENTES = 20;
const HORAS_NOVO_SEM_ATENDIMENTO = 2;
const DIAS_SEM_ATIVIDADE_RECENTE = 3;
// status 'descartado'/'aluno_ativo'/'ex_aluno'/'desistente' = negócio já resolvido pelo lado do
// `status` (enum automático); KANBAN_COLUNAS_ENCERRADAS ('matriculado'/'perdido') = resolvido
// pelo lado da coluna do Kanban (manual) — são dois conceitos diferentes (ver AUDITORIA), por
// isso os dois filtros abaixo, não um só "NOT IN" misturando os dois enums como o SQL da TAREFA
// pedia (que usava 'matriculado' como se fosse um valor de `status`, mas é um id de
// kanban_coluna).
const KANBAN_COLUNAS_ENCERRADAS_SET = new Set(KANBAN_COLUNAS_ENCERRADAS);

export async function getRetornosPendentes(
  supabase: SupabaseServerClient,
  colunas: KanbanColunaConfig[],
): Promise<RetornoPendente[]> {
  const { data } = await supabase
    .from("leads")
    .select("id, nome, telefone, whatsapp, kanban_coluna, proximo_contato, ultimo_followup, created_at")
    .not("status", "in", "(aluno_ativo,ex_aluno,desistente,descartado)");

  type Row = {
    id: string;
    nome: string;
    telefone: string;
    whatsapp: string | null;
    kanban_coluna: string;
    proximo_contato: string | null;
    ultimo_followup: string | null;
    created_at: string;
  };

  const nomeColuna = new Map(colunas.map((c) => [c.id, c.nome]));
  const agora = Date.now();
  const limiteNovo = agora - HORAS_NOVO_SEM_ATENDIMENTO * 60 * 60 * 1000;
  const limiteSemAtividade = agora - DIAS_SEM_ATIVIDADE_RECENTE * 24 * 60 * 60 * 1000;

  const candidatos: (RetornoPendente & { ordenacao: number })[] = [];

  for (const lead of (data ?? []) as Row[]) {
    if (KANBAN_COLUNAS_ENCERRADAS_SET.has(lead.kanban_coluna)) continue;

    const proximoContatoMs = lead.proximo_contato ? new Date(lead.proximo_contato).getTime() : null;
    const ultimoFollowupMs = lead.ultimo_followup ? new Date(lead.ultimo_followup).getTime() : null;
    const criadoMs = new Date(lead.created_at).getTime();

    let motivo: string | null = null;
    if (lead.kanban_coluna === "novo" && criadoMs < limiteNovo) {
      motivo = "Novo sem atendimento";
    } else if (proximoContatoMs !== null && proximoContatoMs < agora) {
      const diasVencido = Math.floor((agora - proximoContatoMs) / 86400000);
      motivo = diasVencido > 0 ? `Retorno vencido há ${diasVencido} dia${diasVencido === 1 ? "" : "s"}` : "Retorno vencido";
    } else if (proximoContatoMs === null && (ultimoFollowupMs === null || ultimoFollowupMs < limiteSemAtividade)) {
      motivo = "Sem próxima ação definida";
    }

    if (!motivo) continue;

    candidatos.push({
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      whatsapp: lead.whatsapp,
      colunaNome: nomeColuna.get(lead.kanban_coluna) ?? lead.kanban_coluna,
      motivo,
      proximoContato: lead.proximo_contato,
      ordenacao: proximoContatoMs ?? Number.MAX_SAFE_INTEGER,
    });
  }

  candidatos.sort((a, b) => a.ordenacao - b.ordenacao);
  return candidatos.slice(0, LIMITE_RETORNOS_PENDENTES).map((candidato) => ({
    id: candidato.id,
    nome: candidato.nome,
    telefone: candidato.telefone,
    whatsapp: candidato.whatsapp,
    colunaNome: candidato.colunaNome,
    motivo: candidato.motivo,
    proximoContato: candidato.proximoContato,
  }));
}

export async function getNotificacaoLeadsNovos(
  supabase: SupabaseServerClient,
): Promise<DashboardNotificacao | null> {
  const { count } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "novo");

  if (!count) return null;

  return {
    chave: "leads-novos",
    titulo: "Leads novos aguardando contato",
    quantidade: count,
    href: "/admin/leads",
    icone: UserPlus,
  };
}

// Único ponto de entrada de dado do formulário público (/captacao) — sem
// requireRole() de propósito, é a única Server Action do projeto
// genuinamente alcançável por um visitante sem conta. Roda com o client
// admin (service_role): não existe sessão nem RLS de "anon" pra leads
// (ver migration) — a validação de input abaixo é a única fronteira.
//
// Dedup: se já existe um lead em aberto (status novo/contatado) com o
// mesmo telefone (normalizado) + curso, atualiza esse registro em vez de
// criar duplicata (anexa a observação nova, se houver). O índice único
// parcial da migration é a rede de segurança contra a corrida rara de
// duas submissões simultâneas — nesse caso o insert falha com 23505 e a
// function trata como sucesso mesmo assim (do ponto de vista de quem
// preencheu o formulário, o interesse foi registrado de um jeito ou de
// outro).
export async function criarOuAtualizarLeadPublico(
  input: LeadFormValues,
  extras?: { campanha_origem?: string },
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const normalizadoNovo = normalizarTelefone(input.telefone);

  if (normalizadoNovo) {
    const { data: abertos } = await admin
      .from("leads")
      .select("id, telefone, observacoes, campanha_origem")
      .eq("curso_id", input.curso_id)
      .in("status", ["novo", "contatado"]);

    const existente = (abertos ?? []).find((l) => normalizarTelefone(l.telefone) === normalizadoNovo);

    if (existente) {
      const observacoesFinal = input.observacoes
        ? [existente.observacoes, input.observacoes].filter(Boolean).join("\n---\n")
        : existente.observacoes;

      const { error } = await admin
        .from("leads")
        .update({
          observacoes: observacoesFinal,
          // Só preenche se o lead ainda não tem campanha de origem — não
          // sobrescreve a etiqueta que já estava lá.
          campanha_origem: existente.campanha_origem ?? extras?.campanha_origem ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existente.id);

      if (error) {
        return { error: "Não foi possível enviar. Tente novamente." };
      }
      return {};
    }
  }

  const { data: novo, error } = await admin
    .from("leads")
    .insert({
      nome: input.nome,
      telefone: input.telefone,
      curso_id: input.curso_id,
      origem: input.origem,
      observacoes: input.observacoes ?? null,
      campanha_origem: extras?.campanha_origem ?? null,
    })
    .select("id")
    .single();

  if (error && error.code !== "23505") {
    return { error: "Não foi possível enviar. Tente novamente." };
  }

  // Webhook de saída (Apps > Webhooks). Só lead NOVO (o ramo acima, de lead já
  // aberto, só atualiza). Cobre campanha, captação e agendamento, que passam por aqui.
  if (novo) {
    dispararWebhook("lead_criado", {
      lead_id: novo.id,
      nome: input.nome,
      telefone: input.telefone,
      curso_id: input.curso_id,
      origem: input.origem,
      campanha_origem: extras?.campanha_origem ?? null,
    });
    // SMS de confirmação (template "lead_confirmacao" da IntegraX). Só lead NOVO; roda depois da
    // resposta e nunca lança. Com a integração desligada só registra no console (stub).
    notificarSmsLeadConfirmacao(novo.id);

    // GênZap Fase 3 — fluxos personalizados com gatilho "lead_criado" (não há template
    // automático de WhatsApp pra este evento hoje, só o de SMS acima — os fluxos são
    // independentes disso). Nunca lança.
    admin
      .from("cursos")
      .select("nome")
      .eq("id", input.curso_id)
      .maybeSingle()
      .then(({ data: curso }) =>
        dispararFluxosPorGatilho(
          "lead_criado",
          { telefone: input.telefone, nome: input.nome, curso: curso?.nome ?? "" },
          { tipo: "lead", id: novo.id },
        ),
      );
  }

  return {};
}
