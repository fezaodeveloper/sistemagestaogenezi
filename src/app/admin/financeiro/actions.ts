"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { termoIlike } from "@/lib/busca";
import { cancelarCobrancasAsaasPendentes } from "@/lib/financeiro/limpeza";
import { escapeHtml, formatarDataTelegram, formatarReaisTelegram, sendTelegram } from "@/lib/telegram";

// Avisa no Telegram que uma cobrança foi gerada no Asaas. Best-effort: nunca
// lança nem altera o resultado de gerarCobranca (a cobrança já existe no Asaas
// e foi gravada na parcela quando isto é chamado).
async function notificarCobrancaGerada(dados: {
  aluno: string;
  valor: string;
  vencimento: string;
  link: string | null | undefined;
}): Promise<void> {
  try {
    const linhas = [
      "💰 <b>Nova cobrança gerada no Asaas:</b>",
      `👤 Aluno: ${escapeHtml(dados.aluno)}`,
      `💵 Valor: ${escapeHtml(dados.valor)}`,
      `📅 Vencimento: ${escapeHtml(dados.vencimento)}`,
    ];
    if (dados.link) linhas.push(`🔗 Link: ${escapeHtml(dados.link)}`);
    await sendTelegram(linhas.join("\n"));
  } catch {
    // Best-effort — ver comentário acima.
  }
}
import { onlyDigits } from "@/lib/alunos/schema";
import { dispararWebhookDeParcela } from "@/lib/webhooks/payloads";
import { emitirNotaAutomatica } from "@/lib/spedy/nfe";
import { notificarEmailCobrancaGerada } from "@/lib/email/eventos";
import {
  notificarSmsCobrancaGerada,
  notificarSmsPagamentoRecebido,
} from "@/lib/integrax/notificacoes";
import { notificarWhatsappCobrancaGerada } from "@/lib/whatsapp/eventos";
import {
  criarClienteAsaas,
  buscarClienteAsaasPorCpf,
  criarCobrancaAsaas,
  criarParcelamentoAsaas,
  buscarParcelasDoParcelamento,
  gerarCarneAsaas,
  cancelarCobrancaAsaas,
  confirmarRecebimentoDinheiro,
  estornarCobrancaAsaas,
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
  totalParcelas: number;
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

// Soma `valor` de uma consulta de parcelas paginando de 1000 em 1000: o
// PostgREST devolve no máximo 1000 linhas por requisição, e sem paginar o KPI
// ficaria silenciosamente truncado num mês com mais parcelas que isso.
// `montar` recebe o intervalo e deve devolver a consulta JÁ ordenada por id
// (ordem estável pra paginação por range).
async function somarParcelas(
  montar: (de: number, ate: number) => PromiseLike<{ data: { valor: number }[] | null }>,
): Promise<{ total: number; quantidade: number }> {
  const TAMANHO_PAGINA = 1000;
  let total = 0;
  let quantidade = 0;
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data } = await montar(de, de + TAMANHO_PAGINA - 1);
    const linhas = data ?? [];
    total += somarValores(linhas);
    quantidade += linhas.length;
    if (linhas.length < TAMANHO_PAGINA) break;
  }
  return { total, quantidade };
}

export async function getFinanceiroDados(
  ano: number,
  mes: number,
  dataInicio?: string,
  dataFim?: string,
  page = 1,
  limit = 20,
  query?: string,
): Promise<FinanceiroDados> {
  await requireRole("admin");
  const supabase = await createClient();
  const { inicio, fim } =
    dataInicio && dataFim ? { inicio: dataInicio, fim: dataFim } : iniciosEFimDoMes(ano, mes);
  const offset = (page - 1) * limit;

  // Busca por nome do aluno (nome mora em profiles; alunos.id = profiles.id):
  // acha os ids e filtra as parcelas por aluno_id. Só a lista paginada é
  // filtrada — os KPIs continuam olhando o período inteiro.
  const termoBusca = query?.trim();
  let idsAlunosBusca: string[] | null = null;
  if (termoBusca) {
    const { data: perfis } = await supabase
      .from("profiles")
      .select("id")
      .ilike("full_name", `%${termoIlike(termoBusca)}%`)
      .limit(100);
    idsAlunosBusca = (perfis ?? []).map((perfil) => perfil.id as string);
  }

  const [{ data: parcelasData, count: totalParcelas }, receber, recebido, atrasado] = await Promise.all([
    (() => {
      let consultaParcelas = supabase
        .from("parcelas")
        .select(
          "*, alunos(full_name, cpf, email, telefone), matriculas(num_parcelas, asaas_installment_id, turmas(nome, cursos(nome)))",
          { count: "exact" },
        )
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim);
      if (idsAlunosBusca) {
        // Lista vazia (nenhum aluno bate com o termo) = nenhum resultado.
        consultaParcelas = consultaParcelas.in(
          "aluno_id",
          idsAlunosBusca.length > 0 ? idsAlunosBusca : ["00000000-0000-0000-0000-000000000000"],
        );
      }
      return consultaParcelas.order("data_vencimento").range(offset, offset + limit - 1);
    })(),
    // KPIs olham o mês/período SELECIONADO inteiro (nunca só a página atual) e
    // SOMENTE ele — todos com limite inferior E superior:
    //  - A receber: parcelas ainda em aberto (pendente/atrasado) que VENCEM no
    //    período. (Antes só tinha `data_vencimento <= fim`, sem limite
    //    inferior: somava o em aberto de TODOS os meses anteriores.)
    //  - Recebido: pagas com data_pagamento no período.
    //  - Em atraso: parcelas "atrasado" que vencem no período. (Antes não tinha
    //    filtro de data nenhum: o mesmo total histórico em qualquer mês.)
    somarParcelas((de, ate) =>
      supabase
        .from("parcelas")
        .select("valor")
        .in("status", ["pendente", "atrasado"])
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim)
        .order("id")
        .range(de, ate),
    ),
    somarParcelas((de, ate) =>
      supabase
        .from("parcelas")
        .select("valor")
        .eq("status", "pago")
        .gte("data_pagamento", inicio)
        .lte("data_pagamento", fim)
        .order("id")
        .range(de, ate),
    ),
    somarParcelas((de, ate) =>
      supabase
        .from("parcelas")
        .select("valor")
        .eq("status", "atrasado")
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim)
        .order("id")
        .range(de, ate),
    ),
  ]);

  return {
    kpis: {
      totalReceber: receber.total,
      totalRecebido: recebido.total,
      totalAtrasado: atrasado.total,
      countAtrasado: atrasado.quantidade,
    },
    parcelas: (parcelasData as ParcelaComRelacoes[] | null) ?? [],
    totalParcelas: totalParcelas ?? 0,
  };
}

export type LimparFinanceiroAlunoResult =
  | { success: true; parcelasExcluidas: number; pagamentosExcluidos: number; cobrancasAsaasNaoCanceladas: number }
  | { error: string };

// Apaga TODAS as parcelas e TODOS os pagamentos avulsos do aluno, mantendo a
// matrícula intacta. Os dois deletes rodam numa função do banco
// (limpar_financeiro_aluno, migration 20260919100000): pagamentos avulsos
// primeiro, parcelas depois, na mesma transação — se uma etapa falhar, nada é
// apagado. Não há FK entre as duas tabelas (ambas se ligam ao aluno).
export async function limparFinanceiroAluno(alunoId: string): Promise<LimparFinanceiroAlunoResult> {
  await requireRole("admin");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(alunoId)) {
    return { error: "Aluno inválido." };
  }

  const supabase = await createClient();

  // Guarda os dados das cobranças ANTES de apagar, pra cancelar no Asaas depois.
  const { data: parcelasData } = await supabase
    .from("parcelas")
    .select("status, asaas_payment_id")
    .eq("aluno_id", alunoId);
  const parcelas = (parcelasData as { status: string; asaas_payment_id: string | null }[] | null) ?? [];

  const { data, error } = await supabase.rpc("limpar_financeiro_aluno", { p_aluno_id: alunoId });

  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      return { error: "A migration 20260919100000 ainda não foi aplicada no banco (função limpar_financeiro_aluno ausente)." };
    }
    if (error.code === "42501") {
      return { error: "Sem permissão para limpar o financeiro." };
    }
    return { error: "Não foi possível limpar o financeiro do aluno. Nada foi excluído." };
  }

  const linha = (data as { parcelas_excluidas: number; pagamentos_excluidos: number }[] | null)?.[0];
  const cobrancasAsaasNaoCanceladas = await cancelarCobrancasAsaasPendentes(parcelas);

  revalidatePath("/admin/financeiro");
  revalidatePath(`/admin/alunos/${alunoId}/editar`);
  return {
    success: true,
    parcelasExcluidas: linha?.parcelas_excluidas ?? 0,
    pagamentosExcluidos: linha?.pagamentos_excluidos ?? 0,
    cobrancasAsaasNaoCanceladas,
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

      // Parcelamento: uma única mensagem resumindo as N cobranças geradas
      // (link = o da 1ª parcela).
      const primeiraParcela = [...parcelasAsaas].sort((a, b) => a.installmentNumber - b.installmentNumber)[0];
      await notificarCobrancaGerada({
        aluno: nomeAluno,
        valor: `${formatarReaisTelegram(parcela.matriculas.valor_final)} (${numParcelas}x de ${formatarReaisTelegram(Number(parcela.matriculas.valor_final) / numParcelas)})`,
        vencimento: `${formatarDataTelegram(parcela.matriculas.data_primeira_mensalidade)} (1ª parcela)`,
        link: primeiraParcela?.invoiceUrl,
      });
      dispararWebhookDeParcela("pedido_pendente", parcelaId, { gateway: "asaas", parcelamento: true });
      notificarSmsCobrancaGerada(parcelaId);
      notificarWhatsappCobrancaGerada(parcelaId);
      // No parcelamento o link do boleto/fatura é o da 1ª parcela (a fatura do Asaas também aceita PIX).
      notificarEmailCobrancaGerada(parcelaId, { boleto: primeiraParcela?.bankSlipUrl ?? primeiraParcela?.invoiceUrl, pix: primeiraParcela?.invoiceUrl });

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

    await notificarCobrancaGerada({
      aluno: nomeAluno,
      valor: formatarReaisTelegram(parcela.valor),
      vencimento: formatarDataTelegram(parcela.data_vencimento),
      link: cobranca.invoiceUrl,
    });
    dispararWebhookDeParcela("pedido_pendente", parcelaId, { gateway: "asaas", link_pagamento: cobranca.invoiceUrl });
    notificarSmsCobrancaGerada(parcelaId);
    notificarWhatsappCobrancaGerada(parcelaId);
    notificarEmailCobrancaGerada(parcelaId, { boleto: cobranca.bankSlipUrl ?? cobranca.invoiceUrl, pix: cobranca.invoiceUrl });

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

  dispararWebhookDeParcela("pedido_cancelado", parcelaId, { gateway: parcela.asaas_payment_id ? "asaas" : "manual" });

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

  dispararWebhookDeParcela("pedido_pago", parcelaId, { gateway: "manual" });
  notificarSmsPagamentoRecebido(parcelaId);
  emitirNotaAutomatica(parcelaId);

  revalidatePath("/admin/financeiro");
  return { success: true };
}

// ===== Estorno de parcela paga (ITEM 1) =====

export async function estornarParcela(parcelaId: string): Promise<ParcelaActionResult> {
  await requireRole("admin");
  const supabase = await createClient();

  const { data: parcela } = await supabase
    .from("parcelas")
    .select("id, asaas_payment_id")
    .eq("id", parcelaId)
    .single();

  if (!parcela) return { error: "Parcela não encontrada." };

  if (!parcela.asaas_payment_id) {
    return { error: "Esta parcela não tem cobrança no Asaas para estornar." };
  }

  try {
    await estornarCobrancaAsaas(parcela.asaas_payment_id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível estornar no Asaas." };
  }

  const { error } = await supabase
    .from("parcelas")
    .update({ status: "estornado", asaas_status: "REFUNDED" })
    .eq("id", parcelaId);

  if (error) return { error: "Estorno feito no Asaas, mas não foi possível atualizar a parcela." };

  revalidatePath("/admin/financeiro");
  return { success: true };
}

// ===== Nota fiscal (ITEM 7) =====

// Desmarcar (emitida=false) também limpa nota_fiscal_url/path e remove o
// arquivo do Storage, se existir — segue o mesmo padrão defensivo de
// removerFotoAluno (src/app/admin/alunos/actions.ts): se a remoção no
// Storage falhar, retorna erro e NÃO limpa o banco, pra nunca deixar a
// parcela "sem NF" enquanto o arquivo antigo continua órfão lá.
export async function marcarNotaFiscal(parcelaId: string, emitida: boolean): Promise<ParcelaActionResult> {
  await requireRole("admin");
  const supabase = await createClient();

  if (!emitida) {
    const { data: parcela } = await supabase
      .from("parcelas")
      .select("nota_fiscal_path")
      .eq("id", parcelaId)
      .single();

    if (parcela?.nota_fiscal_path) {
      const { error: storageError } = await supabase.storage
        .from("notas-fiscais")
        .remove([parcela.nota_fiscal_path]);
      if (storageError) {
        return { error: "Não foi possível remover o arquivo do Storage. Tente novamente." };
      }
    }

    const { error } = await supabase
      .from("parcelas")
      .update({ nota_fiscal_emitida: false, nota_fiscal_url: null, nota_fiscal_path: null })
      .eq("id", parcelaId);

    if (error) {
      return { error: "Arquivo removido do Storage, mas não foi possível atualizar a parcela." };
    }

    revalidatePath("/admin/financeiro");
    return { success: true };
  }

  const { error } = await supabase
    .from("parcelas")
    .update({ nota_fiscal_emitida: true })
    .eq("id", parcelaId);

  if (error) return { error: "Não foi possível marcar a nota fiscal como emitida." };

  revalidatePath("/admin/financeiro");
  return { success: true };
}

export async function salvarNotaFiscal(
  parcelaId: string,
  url: string,
  path: string,
): Promise<ParcelaActionResult> {
  await requireRole("admin");
  const supabase = await createClient();

  const { error } = await supabase
    .from("parcelas")
    .update({ nota_fiscal_url: url, nota_fiscal_path: path })
    .eq("id", parcelaId);

  if (error) return { error: "Arquivo enviado, mas não foi possível salvar na parcela." };

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
