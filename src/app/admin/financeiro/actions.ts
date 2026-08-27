"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { onlyDigits } from "@/lib/alunos/schema";
import {
  criarClienteAsaas,
  buscarClienteAsaasPorCpf,
  criarCobrancaAsaas,
  criarParcelamentoAsaas,
  buscarParcelasDoParcelamento,
  gerarCarneAsaas,
  cancelarCobrancaAsaas,
  confirmarRecebimentoDinheiro,
} from "@/lib/asaas/client";
import { parcelaFormSchema, type Parcela } from "@/lib/financeiro/schema";

export type ParcelaComRelacoes = Parcela & {
  alunos: { full_name: string | null; cpf: string; email: string; telefone: string } | null;
  matriculas: {
    num_parcelas: number | null;
    asaas_installment_id: string | null;
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
          "*, alunos(full_name, cpf, email, telefone), matriculas(num_parcelas, asaas_installment_id, turmas(nome, cursos(nome)))",
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

export async function gerarCobranca(parcelaId: string): Promise<ParcelaActionResult> {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: parcelaData } = await supabase
    .from("parcelas")
    .select(
      "id, matricula_id, valor, data_vencimento, numero_parcela, forma_pagamento, asaas_payment_id, alunos(full_name, cpf, email, telefone), matriculas(num_parcelas, valor_final, data_primeira_mensalidade, asaas_installment_id, turmas(cursos(nome)))",
    )
    .eq("id", parcelaId)
    .single();

  const parcela = parcelaData as unknown as
    | (Pick<
        Parcela,
        "id" | "matricula_id" | "valor" | "data_vencimento" | "numero_parcela" | "forma_pagamento" | "asaas_payment_id"
      > & {
        alunos: { full_name: string | null; cpf: string; email: string; telefone: string } | null;
        matriculas: {
          num_parcelas: number | null;
          valor_final: number | null;
          data_primeira_mensalidade: string | null;
          asaas_installment_id: string | null;
          turmas: { cursos: { nome: string } | null } | null;
        } | null;
      })
    | null;

  if (!parcela) return { error: "Parcela não encontrada." };
  if (parcela.asaas_payment_id) return { error: "Essa parcela já tem uma cobrança gerada." };
  if (!parcela.alunos) return { error: "Aluno da parcela não encontrado." };

  // Cartão é processado na maquininha Infinipay, fora do Asaas — a baixa
  // dessas parcelas é sempre manual (ver marcarComoPagoManual).
  if (parcela.forma_pagamento === "cartao") {
    return {
      error:
        'Cartão de crédito é processado na Infinipay. Use "Marcar como pago" após processar na máquina.',
    };
  }

  const aluno = parcela.alunos;
  const nomeCurso = parcela.matriculas?.turmas?.cursos?.nome ?? "curso";
  const nomeAluno = aluno.full_name ?? aluno.email;
  const numParcelas = parcela.matriculas?.num_parcelas ?? 1;

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

    // boleto, pix, à vista e outro geram o mesmo billingType ("BOLETO") no
    // Asaas — o Pix vem embutido na própria fatura do boleto, com taxa
    // menor do que um Pix cobrado separadamente. Cartão nunca chega aqui
    // (barrado acima).
    if (numParcelas > 1) {
      if (parcela.matriculas?.asaas_installment_id) {
        return { error: "Essa matrícula já tem um parcelamento gerado no Asaas." };
      }
      if (!parcela.matriculas?.valor_final || !parcela.matriculas?.data_primeira_mensalidade) {
        return { error: "Matrícula sem valor final ou data da primeira mensalidade definidos." };
      }

      const parcelamento = await criarParcelamentoAsaas({
        customer: customerId,
        billingType: "BOLETO",
        totalValue: Number(parcela.matriculas.valor_final),
        installmentCount: numParcelas,
        dueDate: parcela.matriculas.data_primeira_mensalidade,
        description: `Curso ${nomeCurso} - ${nomeAluno} - ${numParcelas} parcelas`,
        externalReference: parcela.matricula_id,
      });

      await supabase
        .from("matriculas")
        .update({ asaas_installment_id: parcelamento.installment })
        .eq("id", parcela.matricula_id);

      const parcelasAsaas = await buscarParcelasDoParcelamento(parcelamento.installment);

      // Match por installmentNumber <-> numero_parcela. Best-effort: se
      // alguma parcela local não tiver correspondente no Asaas (ex.: já
      // cancelada antes de gerar o parcelamento), simplesmente não é
      // atualizada — não interrompe as demais.
      await Promise.all(
        parcelasAsaas.map((parcelaAsaas) =>
          supabase
            .from("parcelas")
            .update({
              asaas_payment_id: parcelaAsaas.id,
              asaas_invoice_url: parcelaAsaas.invoiceUrl,
              asaas_bank_slip_url: parcelaAsaas.bankSlipUrl ?? null,
              asaas_status: parcelaAsaas.status,
            })
            .eq("matricula_id", parcela.matricula_id)
            .eq("numero_parcela", parcelaAsaas.installmentNumber),
        ),
      );

      revalidatePath("/admin/financeiro");
      return { success: true };
    }

    const cobranca = await criarCobrancaAsaas({
      customer: customerId,
      billingType: "BOLETO",
      value: Number(parcela.valor),
      dueDate: parcela.data_vencimento,
      description: `Parcela ${parcela.numero_parcela}/${numParcelas} - ${nomeCurso} - ${nomeAluno}`,
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

// Baixa manual (dinheiro, cartão na Infinipay, ou até um boleto/Pix do
// Asaas pago presencialmente): quando a parcela já tem cobrança no Asaas,
// dá baixa lá também (POST /receiveInCash) pra manter os dois lados
// sincronizados — sem isso, o Asaas seguiria cobrando/marcando atraso numa
// parcela que já foi paga por fora.
export async function marcarComoPagoManual(
  parcelaId: string,
  dataPagamento: string,
  valor: number,
): Promise<ParcelaActionResult> {
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
      await confirmarRecebimentoDinheiro(parcela.asaas_payment_id, {
        paymentDate: dataPagamento,
        value: valor,
        notifyCustomer: false,
      });
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Não foi possível confirmar o recebimento no Asaas.",
      };
    }
  }

  const { error } = await supabase
    .from("parcelas")
    .update({
      status: "pago",
      data_pagamento: dataPagamento,
      asaas_status: parcela.asaas_payment_id ? "RECEIVED_IN_CASH" : null,
    })
    .eq("id", parcelaId);

  if (error) return { error: "Não foi possível marcar a parcela como paga." };

  revalidatePath("/admin/financeiro");
  return { success: true };
}

export type GerarCarneResult = { pdf: string } | { error: string };

// PDF binário do Asaas convertido pra base64 aqui no servidor — Server
// Actions só serializam JSON-compatível de volta pro client, não Buffer/
// ArrayBuffer bruto.
export async function gerarCarne(installmentId: string): Promise<GerarCarneResult> {
  await requireRole("admin");

  try {
    const buffer = await gerarCarneAsaas(installmentId);
    return { pdf: Buffer.from(buffer).toString("base64") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível gerar o carnê." };
  }
}
