"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  matriculaWizardSchema,
  type Matricula,
  type MatriculaWizardInput,
} from "@/lib/matriculas/schema";
import { notificarMatriculaWhatsApp } from "@/lib/matriculas/notificacoes";
import type { CURSO_TIPOS } from "@/lib/cursos/schema";
import type { DIAS_SEMANA } from "@/lib/turmas/schema";

export type AlunoParaMatricula = {
  id: string;
  full_name: string | null;
  email: string;
  cpf: string;
  telefone: string;
};

// Só alunos com status_aluno = "ativo" fazem sentido pra uma matrícula nova
// — inativo/trancado/formado ficam de fora da busca do wizard.
export async function getAlunosParaMatricula(): Promise<AlunoParaMatricula[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("alunos")
    .select("id, full_name, email, cpf, telefone")
    .eq("status_aluno", "ativo")
    .order("full_name");

  return (data as AlunoParaMatricula[] | null) ?? [];
}

export type TurmaParaMatricula = {
  id: string;
  nome: string;
  vagas_total: number;
  vagas_ocupadas: number;
  cadencia_dias_semana: (typeof DIAS_SEMANA)[number][] | null;
  horario_aula: string | null;
  data_inicio: string;
  data_fim: string;
};

export type CursoParaMatricula = {
  id: string;
  nome: string;
  tipo: (typeof CURSO_TIPOS)[number];
  carga_horaria_horas: number | null;
  valor: number | null;
  turmas: TurmaParaMatricula[];
};

type CursoParaMatriculaRow = Omit<CursoParaMatricula, "turmas"> & {
  turmas: (TurmaParaMatricula & { status: string })[] | null;
};

// Cursos ativos com suas turmas ativas aninhadas. Filtra turma.status="ativa"
// em memória (não com um `turmas!inner(...)` na query) de propósito: um
// !inner esconderia cursos ativos que hoje não têm nenhuma turma ativa, mas
// o wizard ainda deve listar o curso — só sem opção de turma pra escolher.
export async function getCursosParaMatricula(): Promise<CursoParaMatricula[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("cursos")
    .select(
      "id, nome, tipo, carga_horaria_horas, valor, turmas(id, nome, vagas_total, vagas_ocupadas, cadencia_dias_semana, horario_aula, data_inicio, data_fim, status)",
    )
    .eq("status", "ativo")
    .order("nome");

  return ((data as CursoParaMatriculaRow[] | null) ?? []).map((curso) => ({
    ...curso,
    turmas: (curso.turmas ?? []).filter((turma) => turma.status === "ativa"),
  }));
}

export type CreateMatriculaResult =
  | { success: true; data: Matricula }
  | { success: false; error: string };

export async function createMatricula(
  input: MatriculaWizardInput,
): Promise<CreateMatriculaResult> {
  await requireRole("admin");

  const parsed = matriculaWizardSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();

  // Vagas nunca são confiadas no que o wizard calculou no client — reconsulta
  // o estado atual da turma bem antes do insert. Só importa quando a
  // matrícula nasce "ativa": é isso que a trigger atualizar_vagas_turma()
  // conta (ver 20260908200000_matriculas_campos_expandidos.sql) —
  // "inativa" não ocupa vaga.
  if (data.status === "ativa") {
    const { data: turma, error: turmaError } = await supabase
      .from("turmas")
      .select("vagas_total, vagas_ocupadas")
      .eq("id", data.turma_id)
      .single();

    if (turmaError || !turma) {
      return { success: false, error: "Não foi possível verificar as vagas da turma." };
    }
    if (turma.vagas_ocupadas >= turma.vagas_total) {
      return { success: false, error: "Essa turma não tem mais vagas disponíveis." };
    }
  }

  const { data: matricula, error } = await supabase
    .from("matriculas")
    .insert({
      aluno_id: data.aluno_id,
      turma_id: data.turma_id,
      status: data.status,
      valor_original: data.valor_original,
      desconto_tipo: data.desconto_tipo,
      desconto_formato: data.desconto_formato,
      desconto_valor: data.desconto_valor,
      valor_final: data.valor_final,
      num_parcelas: data.num_parcelas,
      valor_parcela: data.valor_parcela,
      forma_pagamento: data.forma_pagamento,
      taxa_cartao: data.taxa_cartao,
      data_primeira_mensalidade: data.data_primeira_mensalidade,
      data_inicio: data.data_inicio,
      previsao_conclusao: data.previsao_conclusao,
      farda_entregue: data.farda_entregue,
      apostila_entregue: data.apostila_entregue,
      kit_entregue: data.kit_entregue,
      observacoes: data.observacoes ?? null,
    })
    .select()
    .single();

  if (error || !matricula) {
    if (error?.code === "23505") {
      return { success: false, error: "O aluno já tem uma matrícula ativa nessa turma." };
    }
    return { success: false, error: "Não foi possível criar a matrícula. Tente novamente." };
  }

  // Best-effort, nunca bloqueia a matrícula (já criada com sucesso acima) —
  // mesma política das outras notificações do sistema (ver lib/mensagens).
  try {
    await notificarMatriculaWhatsApp(matricula.id);
  } catch {
    // O stub atual só faz console.log e não lança — o try/catch já fica
    // pronto pro dia em que isso virar uma chamada de rede de verdade.
  }

  revalidatePath("/admin/matriculas");
  return { success: true, data: matricula as Matricula };
}
