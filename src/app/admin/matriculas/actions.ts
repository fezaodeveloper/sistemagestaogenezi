"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  MATRICULA_STATUSES,
  matriculaDetalhesFormSchema,
  matriculaWizardSchema,
  type Matricula,
  type MatriculaWizardInput,
} from "@/lib/matriculas/schema";
import { notificarMatriculaWhatsApp } from "@/lib/matriculas/notificacoes";
import { dispararEvento } from "@/lib/automacoes/motor";
import { gerarContratoPdf } from "@/lib/contratos/pdf";
import type { CURSO_TIPOS } from "@/lib/cursos/schema";
import type { DIAS_SEMANA } from "@/lib/turmas/schema";

export type AlunoParaMatricula = {
  id: string;
  full_name: string | null;
  email: string;
  cpf: string;
  telefone: string;
};

// Busca sob demanda pro wizard de matrícula (Etapa 1) — substituiu o
// antigo getAlunosParaMatricula(), que carregava a lista inteira de alunos
// ativos de uma vez só. Só dispara com 2+ caracteres (o client já garante
// isso antes de chamar, mas a checagem é repetida aqui porque a action é
// um endpoint alcançável direto, sem depender do client se comportar).
export async function buscarAlunosParaWizard(query: string): Promise<AlunoParaMatricula[]> {
  await requireRole("admin");

  const termo = query.trim();
  if (termo.length < 2) return [];

  // PostgREST usa vírgula e parênteses como delimitadores da sintaxe do
  // próprio .or() — removidos do termo antes de montar o filtro pra não
  // quebrá-lo (ex.: aluno colando um telefone com DDD entre parênteses).
  const termoSeguro = termo.replace(/[,()]/g, "").trim();
  if (!termoSeguro) return [];
  const termoLike = `%${termoSeguro}%`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("alunos")
    .select("id, full_name, email, cpf, telefone")
    .eq("status_aluno", "ativo")
    .or(`full_name.ilike.${termoLike},cpf.ilike.${termoLike},email.ilike.${termoLike}`)
    .order("full_name")
    .limit(10);

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
};

// Busca sob demanda pro wizard de matrícula (Etapa 2) — substituiu o
// antigo getCursosParaMatricula(), que carregava todos os cursos ativos
// (com turmas aninhadas) de uma vez só. Mesmo padrão de
// buscarAlunosParaWizard: só dispara com 2+ caracteres.
export async function buscarCursosParaWizard(query: string): Promise<CursoParaMatricula[]> {
  await requireRole("admin");

  const termo = query.trim();
  if (termo.length < 2) return [];

  const termoSeguro = termo.replace(/[,()]/g, "").trim();
  if (!termoSeguro) return [];
  const termoLike = `%${termoSeguro}%`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("cursos")
    .select("id, nome, tipo, carga_horaria_horas, valor")
    .eq("status", "ativo")
    .ilike("nome", termoLike)
    .order("nome")
    .limit(10);

  return (data as CursoParaMatricula[] | null) ?? [];
}

// Turmas ativas de um curso já selecionado — busca automática (sem campo
// de digitação), disparada assim que o admin escolhe o curso na Etapa 2.
// Sem limit: o filtro por curso_id já é o que mantém isso pequeno (poucas
// turmas por curso); se passar de 10, o wizard mostra um campo de busca
// que filtra esse mesmo array no client, sem nova ida ao servidor.
export async function buscarTurmasParaWizard(cursoId: string): Promise<TurmaParaMatricula[]> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("turmas")
    .select("id, nome, vagas_total, vagas_ocupadas, cadencia_dias_semana, horario_aula, data_inicio, data_fim")
    .eq("curso_id", cursoId)
    .eq("status", "ativa")
    .order("nome");

  return (data as TurmaParaMatricula[] | null) ?? [];
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
      .select("capacidade_maxima, vagas_ocupadas")
      .eq("id", data.turma_id)
      .single();

    if (turmaError || !turma) {
      return { success: false, error: "Não foi possível verificar as vagas da turma." };
    }
    if (turma.vagas_ocupadas >= turma.capacidade_maxima) {
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
      taxa_matricula: data.taxa_matricula,
      taxa_matricula_desconto_tipo: data.taxa_matricula_desconto_tipo,
      taxa_matricula_desconto_valor: data.taxa_matricula_desconto_valor,
      taxa_matricula_final: data.taxa_matricula_final,
      taxa_matricula_forma_pagamento: data.taxa_matricula_forma_pagamento,
      taxa_matricula_paga: data.taxa_matricula_paga,
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

  try {
    const { data: detalhes } = await supabase
      .from("matriculas")
      .select("alunos(full_name), turmas(nome, cursos(nome))")
      .eq("id", matricula.id)
      .single();

    const info = detalhes as unknown as {
      alunos: { full_name: string | null } | null;
      turmas: { nome: string; cursos: { nome: string } | null } | null;
    } | null;

    await dispararEvento(
      "matricula.criada",
      {
        nome_aluno: info?.alunos?.full_name ?? "—",
        nome_curso: info?.turmas?.cursos?.nome ?? "—",
        nome_turma: info?.turmas?.nome ?? "—",
        valor_final: matricula.valor_final,
      },
      `matricula-criada-${matricula.id}`,
    );
  } catch {
    // Best-effort — a matrícula já foi criada com sucesso acima.
  }

  // Taxa de matrícula já paga no ato (TAREFA 2C) — gera automaticamente um
  // registro em pagamentos_avulsos pra já entrar no financeiro, sem o
  // admin precisar lançar manualmente. Best-effort, mesmo padrão dos blocos
  // acima: nunca bloqueia a matrícula (já criada com sucesso).
  if (data.taxa_matricula_paga && data.taxa_matricula_final !== null && data.taxa_matricula_final > 0) {
    try {
      const { data: detalhesTaxa } = await supabase
        .from("matriculas")
        .select("alunos(full_name), turmas(cursos(nome))")
        .eq("id", matricula.id)
        .single();

      const infoTaxa = detalhesTaxa as unknown as {
        alunos: { full_name: string | null } | null;
        turmas: { cursos: { nome: string } | null } | null;
      } | null;

      const nomeAluno = infoTaxa?.alunos?.full_name ?? "—";
      const nomeCurso = infoTaxa?.turmas?.cursos?.nome ?? "—";

      await supabase.from("pagamentos_avulsos").insert({
        descricao: `Taxa de matrícula - ${nomeAluno} - ${nomeCurso}`,
        valor: data.taxa_matricula_final,
        data_pagamento: new Date().toISOString().slice(0, 10),
        tipo: "taxa",
        forma_pagamento: data.taxa_matricula_forma_pagamento,
        aluno_id: data.aluno_id,
        observacoes: "Registrado automaticamente ao criar matrícula",
      });
    } catch {
      // Best-effort — a matrícula já foi criada com sucesso acima.
    }
  }

  // Parcelas geradas localmente (sem cobrança no Asaas) — o admin decide
  // quando gerar cada cobrança na tela financeira (botão "Gerar cobrança").
  if (data.num_parcelas && data.valor_parcela !== null && data.data_primeira_mensalidade) {
    const [ano, mes, dia] = data.data_primeira_mensalidade.split("-").map(Number);
    const parcelas = Array.from({ length: data.num_parcelas }, (_, indice) => {
      const vencimento = new Date(ano, mes - 1 + indice, dia);
      const dataVencimento = `${vencimento.getFullYear()}-${String(vencimento.getMonth() + 1).padStart(2, "0")}-${String(vencimento.getDate()).padStart(2, "0")}`;
      return {
        matricula_id: matricula.id,
        aluno_id: data.aluno_id,
        numero_parcela: indice + 1,
        valor: data.valor_parcela!,
        data_vencimento: dataVencimento,
        status: "pendente" as const,
        forma_pagamento: data.forma_pagamento,
      };
    });

    // Best-effort: parcela é um registro de controle financeiro, não deve
    // impedir a matrícula (já criada com sucesso acima) de existir se a
    // geração falhar por algum motivo.
    await supabase.from("parcelas").insert(parcelas);
  }

  // Contrato de matrícula (TAREFA 5) — best-effort, igual às notificações
  // acima: nunca bloqueia a matrícula (já criada com sucesso) se a geração
  // do PDF ou a gravação falharem.
  try {
    const pdfBuffer = await gerarContratoPdf(matricula.id);
    await supabase.from("contratos_assinados").insert({
      matricula_id: matricula.id,
      aluno_id: data.aluno_id,
      conteudo_pdf_base64: pdfBuffer.toString("base64"),
      status: "pendente",
    });
  } catch {
    // Best-effort — a matrícula já foi criada com sucesso acima.
  }

  revalidatePath("/admin/matriculas");
  return { success: true, data: matricula as Matricula };
}

export type MatriculaDetalhada = Matricula & {
  alunos: { full_name: string | null; email: string; cpf: string; telefone: string } | null;
  turmas: {
    nome: string;
    cadencia_dias_semana: (typeof DIAS_SEMANA)[number][] | null;
    horario_aula: string | null;
    data_inicio: string;
    data_fim: string;
    cursos: {
      nome: string;
      tipo: (typeof CURSO_TIPOS)[number];
      carga_horaria_horas: number | null;
    } | null;
  } | null;
};

export async function getMatricula(id: string): Promise<MatriculaDetalhada | null> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("matriculas")
    .select(
      "*, alunos(full_name, email, cpf, telefone), turmas(nome, cadencia_dias_semana, horario_aula, data_inicio, data_fim, cursos(nome, tipo, carga_horaria_horas))",
    )
    .eq("id", id)
    .single();

  return (data as MatriculaDetalhada | null) ?? null;
}

export type UpdateMatriculaDetalhesResult = { success: true } | { error: string };

export async function updateMatriculaDetalhes(
  id: string,
  formData: FormData,
): Promise<UpdateMatriculaDetalhesResult> {
  await requireRole("admin");

  const previsaoConclusaoRaw = String(formData.get("previsao_conclusao") ?? "");
  const observacoesRaw = String(formData.get("observacoes") ?? "");

  const parsed = matriculaDetalhesFormSchema.safeParse({
    status: formData.get("status"),
    data_inicio: formData.get("data_inicio"),
    previsao_conclusao: previsaoConclusaoRaw || null,
    farda_entregue: formData.get("farda_entregue") === "true",
    apostila_entregue: formData.get("apostila_entregue") === "true",
    kit_entregue: formData.get("kit_entregue") === "true",
    observacoes: observacoesRaw || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("matriculas")
    .update({
      status: data.status,
      data_inicio: data.data_inicio,
      previsao_conclusao: data.previsao_conclusao,
      farda_entregue: data.farda_entregue,
      apostila_entregue: data.apostila_entregue,
      kit_entregue: data.kit_entregue,
      observacoes: data.observacoes ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/matriculas");
  return { success: true };
}

// ===== Edição em lote (MELHORIA 8) =====

export type AlterarStatusEmLoteResult = { success: true; count: number } | { error: string };

export async function alterarStatusEmLote(
  ids: string[],
  novoStatus: string,
): Promise<AlterarStatusEmLoteResult> {
  await requireRole("admin");

  if (ids.length === 0) {
    return { error: "Nenhuma matrícula selecionada." };
  }
  if (!MATRICULA_STATUSES.includes(novoStatus as (typeof MATRICULA_STATUSES)[number])) {
    return { error: "Status inválido." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("matriculas")
    .update({ status: novoStatus })
    .in("id", ids)
    .select("id");

  if (error) {
    return { error: "Não foi possível atualizar o status das matrículas selecionadas." };
  }

  revalidatePath("/admin/matriculas");
  return { success: true, count: data?.length ?? 0 };
}

// ===== Contrato de matrícula (TAREFA 6) =====

export type DownloadContratoResult = { pdf: string } | { error: string };

export async function downloadContrato(matriculaId: string): Promise<DownloadContratoResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contratos_assinados")
    .select("conteudo_pdf_base64")
    .eq("matricula_id", matriculaId)
    .single();

  if (error || !data?.conteudo_pdf_base64) {
    return { error: "Contrato não encontrado para esta matrícula." };
  }

  return { pdf: data.conteudo_pdf_base64 };
}

// ===== Botões WhatsApp — stub (5 melhorias: WhatsApp stub + taxa de matrícula) =====

// "dados_acesso" não estava no exemplo de payload da tarefa
// (que lista só 'contrato'|'comprovante'|'cobranca'), mas a MELHORIA 1
// pede um terceiro botão "Dados de acesso" — adicionado como um 4º valor
// de tipo, mesmo mecanismo de log.
export type WhatsappStubTipo = "contrato" | "comprovante" | "cobranca" | "dados_acesso";

// Nunca chama a API do WhatsApp de verdade — só registra a intenção via
// dispararEvento, criando histórico em /admin/automacoes pra quando a
// integração real (API Evolution) for ligada. Cada clique gera um evento
// novo (idempotencyKey com timestamp): diferente de matricula.criada etc.,
// aqui não faz sentido deduplicar — o admin pode clicar "Enviar contrato"
// mais de uma vez de propósito (reenviar).
export async function registrarWhatsappStub(tipo: WhatsappStubTipo, matriculaId: string): Promise<void> {
  await requireRole("admin");
  await dispararEvento(
    "whatsapp.stub",
    { tipo, matriculaId },
    `whatsapp-stub-${tipo}-${matriculaId}-${Date.now()}`,
  );
}
