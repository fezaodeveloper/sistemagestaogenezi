"use server";

import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type PendenciaPrioridade = "alta" | "media" | "baixa";

// "icone" é uma chave (não o componente em si): Pendencia atravessa a
// fronteira Server → Client (esta action é consumida por
// src/components/admin/pendencias-view.tsx, um Client Component, pro
// filtro de prioridade funcionar) — componentes de ícone (funções) não são
// serializáveis nessa travessia. PendenciasView resolve a chave pro
// componente lucide-react real localmente, do lado do client.
export type PendenciaIcone =
  | "parcela"
  | "evasao"
  | "manutencao"
  | "certificado"
  | "lead"
  | "estoque"
  | "frequencia";

export type Pendencia = {
  id: string;
  icone: PendenciaIcone;
  titulo: string;
  descricao: string;
  prioridade: PendenciaPrioridade;
  href: string;
};

function formatValor(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

const JANELA_FREQUENCIA_DIAS = 30;
const FREQUENCIA_MINIMA = 75;
const LEAD_DIAS_SEM_CONTATO = 7;
const MANUTENCAO_DIAS_PENDENTE = 3;
const RISCO_ALTO = 70;
const RISCO_MEDIO = 40;

// Reúne pendências de todo o sistema num único feed priorizado — a fonte
// de verdade de cada categoria é lida em paralelo, e o resultado final é
// ordenado alta → média → baixa, preservando a ordem de leitura dentro de
// cada nível. Consumida tanto pela página /admin/pendencias quanto (via
// import direto, sem duplicar lógica) pelo badge da sidebar em
// src/app/admin/layout.tsx — requireRole() usa cache() do React, então
// chamar esta function mais de uma vez na mesma request não duplica as
// queries.
export async function getPendencias(): Promise<Pendencia[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const hoje = new Date();
  const dataLimiteFrequencia = new Date(hoje);
  dataLimiteFrequencia.setDate(dataLimiteFrequencia.getDate() - JANELA_FREQUENCIA_DIAS);
  const dataLimiteFrequenciaStr = dataLimiteFrequencia.toISOString().slice(0, 10);
  const dataLimiteLead = new Date(hoje);
  dataLimiteLead.setDate(dataLimiteLead.getDate() - LEAD_DIAS_SEM_CONTATO);
  const dataLimiteManutencao = new Date(hoje);
  dataLimiteManutencao.setDate(dataLimiteManutencao.getDate() - MANUTENCAO_DIAS_PENDENTE);

  const [
    { data: parcelasAtrasadas },
    { data: indicesEvasao },
    { data: chamadosUrgentes },
    { data: certificadosPendentes },
    { data: leadsSemContato },
    { data: estoqueBaixoData },
    { data: chamadosPendentes },
    { data: matriculasAtivas },
    { data: presencasRecentes },
  ] = await Promise.all([
    supabase
      .from("parcelas")
      .select("id, valor, data_vencimento, alunos(full_name)")
      .eq("status", "atrasado"),
    supabase.from("indices_evasao").select("aluno_id, matricula_id, indice, alunos(full_name)").gte("indice", RISCO_MEDIO),
    supabase
      .from("manutencao_chamados")
      .select("id, titulo, local")
      .eq("prioridade", "urgente")
      .in("status", ["aberto", "em_andamento"]),
    supabase
      .from("certificados")
      .select("id, liberado, matriculas(alunos(full_name), turmas(cursos(nome)))")
      .eq("liberado", false),
    supabase
      .from("leads")
      .select("id, nome, created_at")
      .eq("status", "novo")
      .lte("created_at", dataLimiteLead.toISOString()),
    supabase
      .from("estoque_itens")
      .select("id, nome, quantidade_atual, quantidade_minima"),
    supabase
      .from("manutencao_chamados")
      .select("id, titulo, created_at")
      .eq("status", "aberto")
      .neq("prioridade", "urgente")
      .lte("created_at", dataLimiteManutencao.toISOString()),
    supabase.from("matriculas").select("id, aluno_id, alunos(full_name)").eq("status", "ativa"),
    supabase
      .from("presencas")
      .select("matricula_id, status")
      .gte("data", dataLimiteFrequenciaStr),
  ]);

  const pendenciasAlta: Pendencia[] = [];
  const pendenciasMedia: Pendencia[] = [];
  const pendenciasBaixa: Pendencia[] = [];

  // ALTA — Parcelas atrasadas
  for (const parcela of (parcelasAtrasadas ?? []) as unknown as {
    id: string;
    valor: number;
    data_vencimento: string;
    alunos: { full_name: string | null } | null;
  }[]) {
    pendenciasAlta.push({
      id: `parcela-${parcela.id}`,
      icone: "parcela",
      titulo: "Parcela em atraso",
      descricao: `${parcela.alunos?.full_name ?? "—"} — ${formatValor(Number(parcela.valor))} — venceu ${formatData(parcela.data_vencimento)}`,
      prioridade: "alta",
      href: "/admin/financeiro",
    });
  }

  // ALTA (>=70) e BAIXA (40-69) — risco de evasão, um item por aluno (pior
  // índice entre as matrículas dele, evita duplicar o mesmo aluno).
  const piorIndicePorAluno = new Map<string, { indice: number; nome: string }>();
  for (const linha of (indicesEvasao ?? []) as unknown as {
    aluno_id: string;
    indice: number;
    alunos: { full_name: string | null } | null;
  }[]) {
    const atual = piorIndicePorAluno.get(linha.aluno_id);
    if (!atual || linha.indice > atual.indice) {
      piorIndicePorAluno.set(linha.aluno_id, { indice: linha.indice, nome: linha.alunos?.full_name ?? "—" });
    }
  }
  for (const [alunoId, info] of piorIndicePorAluno) {
    if (info.indice >= RISCO_ALTO) {
      pendenciasAlta.push({
        id: `evasao-alto-${alunoId}`,
        icone: "evasao",
        titulo: "Risco de evasão alto",
        descricao: `${info.nome} — índice ${info.indice}/100`,
        prioridade: "alta",
        href: "/admin/alunos",
      });
    } else {
      pendenciasBaixa.push({
        id: `evasao-medio-${alunoId}`,
        icone: "evasao",
        titulo: "Risco de evasão médio",
        descricao: `${info.nome} — índice ${info.indice}/100`,
        prioridade: "baixa",
        href: "/admin/alunos",
      });
    }
  }

  // ALTA — Chamados de manutenção urgentes
  for (const chamado of (chamadosUrgentes ?? []) as { id: string; titulo: string; local: string | null }[]) {
    pendenciasAlta.push({
      id: `manutencao-urgente-${chamado.id}`,
      icone: "manutencao",
      titulo: "Manutenção urgente",
      descricao: `${chamado.titulo} — ${chamado.local ?? "local não informado"}`,
      prioridade: "alta",
      href: "/admin/manutencao",
    });
  }

  // MÉDIA — Certificados aguardando liberação
  for (const certificado of (certificadosPendentes ?? []) as unknown as {
    id: string;
    matriculas: { alunos: { full_name: string | null } | null; turmas: { cursos: { nome: string } | null } | null } | null;
  }[]) {
    pendenciasMedia.push({
      id: `certificado-${certificado.id}`,
      icone: "certificado",
      titulo: "Certificado pendente",
      descricao: `${certificado.matriculas?.alunos?.full_name ?? "—"} — ${certificado.matriculas?.turmas?.cursos?.nome ?? "—"}`,
      prioridade: "media",
      href: "/admin/certificados",
    });
  }

  // MÉDIA — Leads sem contato há mais de 7 dias
  for (const lead of (leadsSemContato ?? []) as { id: string; nome: string; created_at: string }[]) {
    pendenciasMedia.push({
      id: `lead-${lead.id}`,
      icone: "lead",
      titulo: "Lead sem contato",
      descricao: `${lead.nome} — ${diasDesde(lead.created_at)} dias aguardando`,
      prioridade: "media",
      href: "/admin/leads",
    });
  }

  // MÉDIA — Estoque abaixo do mínimo
  for (const item of (estoqueBaixoData ?? []) as {
    id: string;
    nome: string;
    quantidade_atual: number;
    quantidade_minima: number;
  }[]) {
    if (item.quantidade_atual < item.quantidade_minima) {
      pendenciasMedia.push({
        id: `estoque-${item.id}`,
        icone: "estoque",
        titulo: "Estoque baixo",
        descricao: `${item.nome} — apenas ${item.quantidade_atual} unidades`,
        prioridade: "media",
        href: "/admin/estoque",
      });
    }
  }

  // MÉDIA — Chamados de manutenção abertos há mais de 3 dias (não-urgentes,
  // já cobertos acima)
  for (const chamado of (chamadosPendentes ?? []) as { id: string; titulo: string; created_at: string }[]) {
    pendenciasMedia.push({
      id: `manutencao-pendente-${chamado.id}`,
      icone: "manutencao",
      titulo: "Manutenção pendente",
      descricao: `${chamado.titulo} — aberto há ${diasDesde(chamado.created_at)} dias`,
      prioridade: "media",
      href: "/admin/manutencao",
    });
  }

  // BAIXA — Alunos com frequência < 75% nos últimos 30 dias (mas risco < 70,
  // já coberto em ALTA acima)
  const contagemPorMatricula = new Map<string, { total: number; presentes: number }>();
  for (const presenca of (presencasRecentes ?? []) as { matricula_id: string; status: string }[]) {
    const atual = contagemPorMatricula.get(presenca.matricula_id) ?? { total: 0, presentes: 0 };
    atual.total += 1;
    if (presenca.status === "presente" || presenca.status === "reposicao") atual.presentes += 1;
    contagemPorMatricula.set(presenca.matricula_id, atual);
  }
  for (const matricula of (matriculasAtivas ?? []) as unknown as {
    id: string;
    aluno_id: string;
    alunos: { full_name: string | null } | null;
  }[]) {
    const contagem = contagemPorMatricula.get(matricula.id);
    if (!contagem || contagem.total === 0) continue;

    const percentual = Math.round((contagem.presentes / contagem.total) * 100);
    if (percentual >= FREQUENCIA_MINIMA) continue;

    const riscoDoAluno = piorIndicePorAluno.get(matricula.aluno_id)?.indice ?? 0;
    if (riscoDoAluno >= RISCO_ALTO) continue; // já é uma pendência de alta prioridade

    pendenciasBaixa.push({
      id: `frequencia-${matricula.id}`,
      icone: "frequencia",
      titulo: "Frequência baixa",
      descricao: `${matricula.alunos?.full_name ?? "—"} — ${percentual}%`,
      prioridade: "baixa",
      href: "/admin/turmas",
    });
  }

  return [...pendenciasAlta, ...pendenciasMedia, ...pendenciasBaixa];
}
