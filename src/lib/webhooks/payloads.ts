import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { dispararWebhookComPayload } from "@/lib/webhooks/disparar";
import type { WebhookEvento } from "@/lib/webhooks/eventos";

// Monta o payload dos eventos que giram em torno de uma parcela ou matrícula e os
// dispara. A consulta roda com o client ADMIN e depois da resposta (ver
// dispararWebhookComPayload), então serve tanto pra Server Actions quanto pra
// webhooks de gateway (sem sessão) sem atrasar o fluxo principal.

type Aluno = { full_name: string | null; email: string | null; telefone: string | null } | null;
type Turma = { nome: string; curso_id: string; cursos: { nome: string } | null } | null;

type LinhaParcela = {
  id: string;
  matricula_id: string;
  aluno_id: string;
  valor: number;
  numero_parcela: number;
  status: string;
  forma_pagamento: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  alunos: Aluno;
  matriculas: { num_parcelas: number | null; turmas: Turma } | null;
};

async function payloadParcela(parcelaId: string): Promise<Record<string, unknown> | null> {
  const { data } = await createAdminClient()
    .from("parcelas")
    .select(
      "id, matricula_id, aluno_id, valor, numero_parcela, status, forma_pagamento, data_vencimento, data_pagamento, alunos(full_name, email, telefone), matriculas(num_parcelas, turmas(nome, curso_id, cursos(nome)))",
    )
    .eq("id", parcelaId)
    .maybeSingle();
  const parcela = data as unknown as LinhaParcela | null;
  if (!parcela) return null;

  return {
    parcela_id: parcela.id,
    matricula_id: parcela.matricula_id,
    aluno_id: parcela.aluno_id,
    aluno_nome: parcela.alunos?.full_name ?? null,
    aluno_email: parcela.alunos?.email ?? null,
    aluno_telefone: parcela.alunos?.telefone ?? null,
    curso_id: parcela.matriculas?.turmas?.curso_id ?? null,
    curso_nome: parcela.matriculas?.turmas?.cursos?.nome ?? null,
    turma_nome: parcela.matriculas?.turmas?.nome ?? null,
    valor: Number(parcela.valor),
    numero_parcela: parcela.numero_parcela,
    total_parcelas: parcela.matriculas?.num_parcelas ?? null,
    status: parcela.status,
    forma_pagamento: parcela.forma_pagamento,
    data_vencimento: parcela.data_vencimento,
    data_pagamento: parcela.data_pagamento,
  };
}

// pedido_pendente / pedido_pago / pedido_cancelado / pagamento_recusado.
// `extras` sobrescreve campos (ex.: o motivo da recusa).
export function dispararWebhookDeParcela(
  evento: WebhookEvento,
  parcelaId: string,
  extras: Record<string, unknown> = {},
): void {
  dispararWebhookComPayload(evento, async () => {
    const payload = await payloadParcela(parcelaId);
    return payload ? { ...payload, ...extras } : null;
  });
}

type LinhaMatricula = {
  id: string;
  aluno_id: string;
  turma_id: string;
  status: string;
  valor_final: number | null;
  num_parcelas: number | null;
  alunos: Aluno;
  turmas: Turma;
};

// matricula_criada / acesso_enviado (dados de acesso enviados pela matrícula).
export function dispararWebhookDeMatricula(
  evento: WebhookEvento,
  matriculaId: string,
  extras: Record<string, unknown> = {},
): void {
  dispararWebhookComPayload(evento, async () => {
    const { data } = await createAdminClient()
      .from("matriculas")
      .select(
        "id, aluno_id, turma_id, status, valor_final, num_parcelas, alunos(full_name, email, telefone), turmas(nome, curso_id, cursos(nome))",
      )
      .eq("id", matriculaId)
      .maybeSingle();
    const matricula = data as unknown as LinhaMatricula | null;
    if (!matricula) return null;

    return {
      matricula_id: matricula.id,
      aluno_id: matricula.aluno_id,
      aluno_nome: matricula.alunos?.full_name ?? null,
      aluno_email: matricula.alunos?.email ?? null,
      aluno_telefone: matricula.alunos?.telefone ?? null,
      curso_id: matricula.turmas?.curso_id ?? null,
      curso_nome: matricula.turmas?.cursos?.nome ?? null,
      turma_id: matricula.turma_id,
      turma_nome: matricula.turmas?.nome ?? null,
      status: matricula.status,
      valor_final: matricula.valor_final === null ? null : Number(matricula.valor_final),
      num_parcelas: matricula.num_parcelas,
      ...extras,
    };
  });
}
