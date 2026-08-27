"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/alunos/schema";
import {
  criarClienteAsaas,
  buscarClienteAsaasPorCpf,
  criarCobrancaAsaas,
  cancelarCobrancaAsaas,
} from "@/lib/asaas/client";
import { parcelaFormSchema, type Parcela } from "@/lib/financeiro/schema";
import { FORMAS_PAGAMENTO, type FormaPagamento } from "@/lib/matriculas/schema";

export type ParcelaComRelacoes = Parcela & {
  alunos: { full_name: string | null; cpf: string; email: string; telefone: string } | null;
  matriculas: {
    num_parcelas: number | null;
    turmas: { nome: string; cursos: { nome: string } | null } | null;
  } | null;
};

export type FinanceiroKpis = {
  totalReceber: number;
  totalRecebido: number;
  totalAtrasado: number;
  countAtrasado: number;
};

export type FinanceiroDados = {
  kpis: FinanceiroKpis;
  parcelas: ParcelaComRelacoes[];
};

function iniciosEFimDoMes(ano: number, mes: number) {
  const inicio = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(ano, mes, 0).getDate();
  const fim = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

function somarValores(rows: { valor: number }[] | null): number {
  return (rows ?? []).reduce((total, row) => total + Number(row.valor), 0);
}

export async function getFinanceiroDados(ano: number, mes: number): Promise<FinanceiroDados> {
  await requireRole("admin");
  const supabase = await createClient();
  const { inicio, fim } = iniciosEFimDoMes(ano, mes);

  const [{ data: parcelasData }, { data: receberData }, { data: recebidoData }, { data: atrasadoData }] =
    await Promise.all([
      supabase
        .from("parcelas")
        .select(
          "*, alunos(full_name, cpf, email, telefone), matriculas(num_parcelas, turmas(nome, cursos(nome)))",
        )
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim)
        .order("data_vencimento"),
      supabase
        .from("parcelas")
        .select("valor")
        .in("status", ["pendente", "atrasado"])
        .lte("data_vencimento", fim),
      supabase
        .from("parcelas")
        .select("valor")
        .eq("status", "pago")
        .gte("data_pagamento", inicio)
        .lte("data_pagamento", fim),
      supabase.from("parcelas").select("valor").eq("status", "atrasado"),
    ]);

  return {
    kpis: {
      totalReceber: somarValores(receberData),
      totalRecebido: somarValores(recebidoData),
      totalAtrasado: somarValores(atrasadoData),
      countAtrasado: (atrasadoData ?? []).length,
    },
    parcelas: (parcelasData as ParcelaComRelacoes[] | null) ?? [],
  };
}

export type MatriculaParaParcela = {
  id: string;
  aluno_id: string;
  num_parcelas: number | null;
  alunos: { full_name: string | null } | null;
  turmas: { nome: string; cursos: { nome: string } | null } | null;
};

// Só matrículas ativas fazem sentido pra gerar uma parcela manual nova —
// mesmo critério de getAlunosParaMatricula (src/app/admin/matriculas/actions.ts).
export async function getMatriculasParaParcela(): Promise<MatriculaParaParcela[]> {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("matriculas")
    .select("id, aluno_id, num_parcelas, alunos(full_name), turmas(nome, cursos(nome))")
    .eq("status", "ativa")
    .order("data_matricula", { ascending: false });

  return (data as MatriculaParaParcela[] | null) ?? [];
}

export type ParcelaActionResult = { success: true } | { error: string };

export async function criarParcelaManual(formData: FormData): Promise<ParcelaActionResult> {
  await requireRole("admin");

  const formaPagamentoRaw = formData.get("forma_pagamento");

  const parsed = parcelaFormSchema.safeParse({
    matricula_id: formData.get("matricula_id"),
    numero_parcela: Number(formData.get("numero_parcela")),
    valor: Number(formData.get("valor")),
    data_vencimento: formData.get("data_vencimento"),
    forma_pagamento: formaPagamentoRaw || null,
    observacoes: formData.get("observacoes") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { data: matricula } = await supabase
    .from("matriculas")
    .select("id, aluno_id")
    .eq("id", data.matricula_id)
    .single();

  if (!matricula) {
    return { error: "Matrícula não encontrada." };
  }

  const { error } = await supabase.from("parcelas").insert({
    matricula_id: matricula.id,
    aluno_id: matricula.aluno_id,
    numero_parcela: data.numero_parcela,
    valor: data.valor,
    data_vencimento: data.data_vencimento,
    forma_pagamento: data.forma_pagamento,
    observacoes: data.observacoes ?? null,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe uma parcela com esse número para essa matrícula." };
    }
    return { error: "Não foi possível criar a parcela. Tente novamente." };
  }

  revalidatePath("/admin/financeiro");
  return { success: true };
}

const BILLING_TYPE_MAP: Record<FormaPagamento, "BOLETO" | "PIX" | "CREDIT_CARD" | "UNDEFINED"> = {
  boleto: "BOLETO",
  pix: "PIX",
  cartao: "CREDIT_CARD",
  avista: "UNDEFINED",
  outro: "UNDEFINED",
};

export async function gerarCobranca(parcelaId: string): Promise<ParcelaActionResult> {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: parcelaData } = await supabase
    .from("parcelas")
    .select(
      "id, matricula_id, valor, data_vencimento, numero_parcela, forma_pagamento, asaas_payment_id, alunos(full_name, cpf, email, telefone)",
    )
    .eq("id", parcelaId)
    .single();

  const parcela = parcelaData as unknown as
    | (Pick<
        Parcela,
        "id" | "matricula_id" | "valor" | "data_vencimento" | "numero_parcela" | "forma_pagamento" | "asaas_payment_id"
      > & {
        alunos: { full_name: string | null; cpf: string; email: string; telefone: string } | null;
      })
    | null;

  if (!parcela) return { error: "Parcela não encontrada." };
  if (parcela.asaas_payment_id) return { error: "Essa parcela já tem uma cobrança gerada." };
  if (!parcela.alunos) return { error: "Aluno da parcela não encontrado." };

  const aluno = parcela.alunos;

  const { data: matricula } = await supabase
    .from("matriculas")
    .select("asaas_customer_id")
    .eq("id", parcela.matricula_id)
    .single();

  try {
    let customerId = matricula?.asaas_customer_id ?? null;

    if (!customerId) {
      const cpfDigits = onlyDigits(aluno.cpf);
      const existente = await buscarClienteAsaasPorCpf(cpfDigits);
      if (existente) {
        customerId = existente.id;
      } else {
        const criado = await criarClienteAsaas({
          name: aluno.full_name ?? aluno.email,
          cpfCnpj: cpfDigits,
          email: aluno.email,
          phone: onlyDigits(aluno.telefone),
        });
        customerId = criado.id;
      }
      await supabase.from("matriculas").update({ asaas_customer_id: customerId }).eq("id", parcela.matricula_id);
    }

    const billingType = parcela.forma_pagamento ? BILLING_TYPE_MAP[parcela.forma_pagamento] : "UNDEFINED";

    const cobranca = await criarCobrancaAsaas({
      customer: customerId,
      billingType,
      value: Number(parcela.valor),
      dueDate: parcela.data_vencimento,
      description: `Parcela ${parcela.numero_parcela}`,
      externalReference: parcela.id,
    });

    const { error } = await supabase
      .from("parcelas")
      .update({
        asaas_payment_id: cobranca.id,
        asaas_invoice_url: cobranca.invoiceUrl,
        asaas_bank_slip_url: cobranca.bankSlipUrl ?? null,
        asaas_status: cobranca.status,
      })
      .eq("id", parcelaId);

    if (error) return { error: "Cobrança criada no Asaas, mas não foi possível salvar na parcela." };

    revalidatePath("/admin/financeiro");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível gerar a cobrança." };
  }
}

export async function cancelarParcela(parcelaId: string): Promise<ParcelaActionResult> {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: parcela } = await supabase
    .from("parcelas")
    .select("id, asaas_payment_id")
    .eq("id", parcelaId)
    .single();

  if (!parcela) return { error: "Parcela não encontrada." };

  if (parcela.asaas_payment_id) {
    try {
      await cancelarCobrancaAsaas(parcela.asaas_payment_id);
    } catch {
      // Best-effort: se a cobrança já não existir mais no Asaas (removida
      // manualmente por lá, por exemplo), ainda assim cancela localmente.
    }
  }

  const { error } = await supabase.from("parcelas").update({ status: "cancelado" }).eq("id", parcelaId);

  if (error) return { error: "Não foi possível cancelar a parcela." };

  revalidatePath("/admin/financeiro");
  return { success: true };
}

export async function registrarPagamentoManual(
  parcelaId: string,
  formData: FormData,
): Promise<ParcelaActionResult> {
  await requireRole("admin");

  const dataPagamento = formData.get("data_pagamento");
  const formaPagamentoRaw = formData.get("forma_pagamento");

  if (typeof dataPagamento !== "string" || !dataPagamento) {
    return { error: "Informe a data do pagamento." };
  }

  const formaPagamento =
    typeof formaPagamentoRaw === "string" &&
    (FORMAS_PAGAMENTO as readonly string[]).includes(formaPagamentoRaw)
      ? (formaPagamentoRaw as FormaPagamento)
      : null;

  const supabase = await createClient();

  // .is("asaas_payment_id", null): pagamento manual só é permitido pra
  // parcela sem cobrança Asaas associada — com Asaas, o status vem do
  // webhook (src/app/api/webhooks/asaas/route.ts), nunca marcado à mão.
  const { error } = await supabase
    .from("parcelas")
    .update({ status: "pago", data_pagamento: dataPagamento, forma_pagamento: formaPagamento })
    .eq("id", parcelaId)
    .is("asaas_payment_id", null);

  if (error) return { error: "Não foi possível registrar o pagamento." };

  revalidatePath("/admin/financeiro");
  return { success: true };
}
