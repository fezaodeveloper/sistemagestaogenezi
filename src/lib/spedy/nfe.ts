import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  carregarIntegracoesAtivas,
  escolherIntegracao,
  type Ambiente,
  type IntegracaoSpedy,
} from "@/lib/spedy/config";

// Emissão de nota fiscal pela Spedy. A escola presta SERVIÇO (curso), então a nota é
// NFS-e: POST /v1/service-invoices. A API é ASSÍNCRONA: um 2xx só confirma que a nota
// entrou na fila; a autorização da prefeitura vem depois (por isso o número da nota
// pode vir vazio na emissão e é consultado depois com consultarNotaFiscal).
//
// Hosts da documentação (docs.spedy.com.br/start/autenticacao): produção
// https://api.spedy.com.br/v1 e sandbox https://sandbox-api.spedy.com.br/v1 — o
// "app.spedy.com.br/api/v1" da especificação é o painel, não a API. Autenticação:
// header X-Api-Key. Sandbox e produção são contas separadas (chaves diferentes).
//
// Idempotência: integrationId = id da parcela. Reenviar a mesma parcela ATUALIZA a
// nota existente em vez de duplicar.

const BASE_URL: Record<Ambiente, string> = {
  producao: "https://api.spedy.com.br/v1",
  sandbox: "https://sandbox-api.spedy.com.br/v1",
};

const TIMEOUT_MS = 20_000;

export const SPEDY_STATUS_LABELS: Record<string, string> = {
  enqueued: "Na fila para emissão",
  processing: "Em processamento",
  authorized: "Autorizada",
  rejected: "Rejeitada",
  canceled: "Cancelada",
  cancelled: "Cancelada",
};

export function rotuloStatusSpedy(status: string | undefined): string {
  return status ? (SPEDY_STATUS_LABELS[status] ?? status) : "Desconhecido";
}

export type EmitirNotaParams = {
  aluno: {
    nome: string;
    cpf: string;
    email?: string | null;
    telefone?: string | null;
    endereco?: {
      logradouro: string;
      numero?: string | null;
      bairro?: string | null;
      cep: string;
      cidade: string;
      estado: string;
      complemento?: string | null;
    } | null;
  };
  curso: { id?: string | null; nome: string; valor?: number | null };
  parcela: {
    id: string;
    valor: number;
    // YYYY-MM-DD: data de competência da nota (normalmente a do pagamento).
    data: string;
    numero?: number | null;
    total?: number | null;
  };
  // Integração já escolhida; sem ela, busca a ativa para o curso.
  integracao?: IntegracaoSpedy;
};

export type ResultadoNota = {
  ok: boolean;
  notaId?: string;
  // null enquanto a prefeitura não autoriza.
  numeroNota?: number | null;
  status?: string;
  erro?: string;
  // true quando não há integração ativa pro curso (não é uma falha — só não se aplica).
  semIntegracao?: boolean;
};

type CorpoNotaSpedy = {
  id?: string;
  status?: string;
  number?: number | null;
  processingDetail?: { message?: string | null } | null;
};

function mensagemDeErro(status: number, corpo: unknown): string {
  if (status === 401 || status === 403) return "A Spedy recusou a chave de API (inválida, ou de outro ambiente).";
  const c = corpo as { message?: unknown; error?: unknown; errors?: unknown } | null;
  const candidatos: unknown[] = [c?.message, c?.error];
  if (Array.isArray(c?.errors)) {
    for (const item of c.errors as unknown[]) candidatos.push(typeof item === "string" ? item : (item as { message?: unknown })?.message);
  }
  const texto = candidatos.find((valor): valor is string => typeof valor === "string" && valor.length > 0);
  return texto ? `Spedy: ${texto.slice(0, 300)}` : `Erro na API da Spedy (${status}).`;
}

async function chamarSpedy(
  integracao: IntegracaoSpedy,
  metodo: "GET" | "POST",
  caminho: string,
  corpo?: unknown,
): Promise<{ status: number; corpo: unknown }> {
  const resposta = await fetch(`${BASE_URL[integracao.ambiente]}${caminho}`, {
    method: metodo,
    headers: {
      "X-Api-Key": integracao.chaveApi,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    // Não segue redirecionamentos (não vaza a chave pra outro host).
    redirect: "manual",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: resposta.status, corpo: await resposta.json().catch(() => null) };
}

function erroDeRede(erro: unknown): string {
  const mensagem = erro instanceof Error ? erro.message : "";
  return /timeout|aborted/i.test(mensagem) ? "A Spedy não respondeu a tempo. Tente novamente." : mensagem || "Falha ao falar com a Spedy.";
}

// Nunca lança e nunca bloqueia quem chama: devolve { ok, ... }.
export async function emitirNotaFiscal(params: EmitirNotaParams): Promise<ResultadoNota> {
  try {
    const integracao = params.integracao ?? escolherIntegracao(await carregarIntegracoesAtivas(), params.curso.id);
    if (!integracao) {
      return { ok: false, semIntegracao: true, erro: "Nenhuma integração Spedy ativa para este curso." };
    }

    const cpf = params.aluno.cpf.replace(/\D/g, "");
    const rotuloParcela =
      params.parcela.numero && params.parcela.total && params.parcela.total > 1
        ? ` - Parcela ${params.parcela.numero}/${params.parcela.total}`
        : "";
    const endereco = params.aluno.endereco;
    const enderecoValido = !!endereco && !!endereco.logradouro && !!endereco.cep && !!endereco.cidade && !!endereco.estado;

    const corpo = {
      // Idempotência: a mesma parcela nunca gera duas notas.
      integrationId: params.parcela.id,
      description: `Curso ${params.curso.nome}${rotuloParcela}`,
      effectiveDate: `${params.parcela.data}T12:00:00`,
      receiver: {
        name: params.aluno.nome,
        ...(cpf ? { federalTaxNumber: cpf } : {}),
        ...(params.aluno.email ? { email: params.aluno.email } : {}),
        ...(params.aluno.telefone ? { phoneNumber: params.aluno.telefone.replace(/\D/g, "") } : {}),
        // Só a cidade por nome + UF: a tabela de alunos não guarda o código IBGE do município.
        ...(enderecoValido && endereco
          ? {
              address: {
                street: endereco.logradouro,
                ...(endereco.numero ? { number: endereco.numero } : {}),
                ...(endereco.bairro ? { district: endereco.bairro } : {}),
                postalCode: endereco.cep.replace(/\D/g, ""),
                ...(endereco.complemento ? { additionalInformation: endereco.complemento } : {}),
                city: { name: endereco.cidade, state: endereco.estado },
              },
            }
          : {}),
      },
      total: { invoiceAmount: Number(params.parcela.valor.toFixed(2)) },
      sendEmailToCustomer: !!params.aluno.email,
      issue: true,
    };

    const { status, corpo: resposta } = await chamarSpedy(integracao, "POST", "/service-invoices", corpo);
    if (status < 200 || status >= 300) return { ok: false, erro: mensagemDeErro(status, resposta) };

    const nota = resposta as CorpoNotaSpedy | null;
    if (!nota?.id) return { ok: false, erro: "A Spedy aceitou a nota, mas não devolveu o identificador." };
    return { ok: true, notaId: nota.id, numeroNota: nota.number ?? null, status: nota.status };
  } catch (erro) {
    return { ok: false, erro: erroDeRede(erro) };
  }
}

export type ConsultaNota = { ok: boolean; status?: string; numeroNota?: number | null; mensagem?: string | null; erro?: string };

// Situação atual da nota na Spedy (o número só aparece depois de autorizada).
export async function consultarNotaFiscal(notaId: string, integracao: IntegracaoSpedy): Promise<ConsultaNota> {
  try {
    const { status, corpo } = await chamarSpedy(integracao, "GET", `/service-invoices/${encodeURIComponent(notaId)}`);
    if (status < 200 || status >= 300) return { ok: false, erro: mensagemDeErro(status, corpo) };
    const nota = corpo as CorpoNotaSpedy | null;
    return {
      ok: true,
      status: nota?.status,
      numeroNota: nota?.number ?? null,
      mensagem: nota?.processingDetail?.message ?? null,
    };
  } catch (erro) {
    return { ok: false, erro: erroDeRede(erro) };
  }
}

// ===== Emissão a partir de uma parcela paga =====

type LinhaParcela = {
  id: string;
  valor: number;
  numero_parcela: number;
  status: string;
  data_pagamento: string | null;
  data_vencimento: string | null;
  spedy_nota_id: string | null;
  alunos: {
    full_name: string | null;
    cpf: string;
    email: string | null;
    telefone: string | null;
    endereco: string | null;
    numero: string | null;
    bairro: string | null;
    cep: string | null;
    cidade: string | null;
    estado: string | null;
    complemento: string | null;
  } | null;
  matriculas: {
    num_parcelas: number | null;
    turmas: { curso_id: string; cursos: { nome: string } | null } | null;
  } | null;
};

const SELECT_PARCELA =
  "id, valor, numero_parcela, status, data_pagamento, data_vencimento, spedy_nota_id, alunos(full_name, cpf, email, telefone, endereco, numero, bairro, cep, cidade, estado, complemento), matriculas(num_parcelas, turmas(curso_id, cursos(nome)))";

async function carregarParcela(parcelaId: string): Promise<{ parcela: LinhaParcela | null; erro: boolean }> {
  const { data, error } = await createAdminClient().from("parcelas").select(SELECT_PARCELA).eq("id", parcelaId).maybeSingle();
  return { parcela: data as unknown as LinhaParcela | null, erro: !!error };
}

// Emite a nota de uma parcela PAGA e guarda o id em parcelas.spedy_nota_id. Nunca lança.
export async function emitirNotaFiscalDaParcela(parcelaId: string): Promise<ResultadoNota> {
  try {
    const { parcela, erro: erroLeitura } = await carregarParcela(parcelaId);
    if (erroLeitura) {
      return { ok: false, erro: "Não foi possível ler a parcela (a migration parcelas_spedy_nota_id foi aplicada?)." };
    }
    if (!parcela) return { ok: false, erro: "Parcela não encontrada." };
    if (parcela.status !== "pago") return { ok: false, erro: "A nota só pode ser emitida para parcelas pagas." };
    if (parcela.spedy_nota_id) return { ok: true, notaId: parcela.spedy_nota_id, erro: undefined };
    if (!parcela.alunos) return { ok: false, erro: "Aluno da parcela não encontrado." };

    const aluno = parcela.alunos;
    const cursoId = parcela.matriculas?.turmas?.curso_id ?? null;
    const resultado = await emitirNotaFiscal({
      aluno: {
        nome: aluno.full_name ?? aluno.email ?? "Aluno",
        cpf: aluno.cpf,
        email: aluno.email,
        telefone: aluno.telefone,
        endereco: aluno.endereco
          ? {
              logradouro: aluno.endereco,
              numero: aluno.numero,
              bairro: aluno.bairro,
              cep: aluno.cep ?? "",
              cidade: aluno.cidade ?? "",
              estado: aluno.estado ?? "",
              complemento: aluno.complemento,
            }
          : null,
      },
      curso: { id: cursoId, nome: parcela.matriculas?.turmas?.cursos?.nome ?? "curso" },
      parcela: {
        id: parcela.id,
        valor: Number(parcela.valor),
        data: parcela.data_pagamento ?? parcela.data_vencimento ?? new Date().toISOString().slice(0, 10),
        numero: parcela.numero_parcela,
        total: parcela.matriculas?.num_parcelas ?? null,
      },
    });
    if (!resultado.ok || !resultado.notaId) return resultado;

    const { error } = await createAdminClient().from("parcelas").update({ spedy_nota_id: resultado.notaId }).eq("id", parcelaId);
    if (error) {
      // A nota JÁ foi enviada; reenviar é seguro (idempotente por integrationId).
      return {
        ok: false,
        notaId: resultado.notaId,
        erro: "A nota foi enviada à Spedy, mas não foi possível salvar a referência na parcela (a migration parcelas_spedy_nota_id foi aplicada?). Clique de novo para tentar salvar.",
      };
    }
    return resultado;
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falha ao emitir a nota." };
  }
}

// Situação da nota de uma parcela (usa a integração do curso da parcela).
export async function consultarNotaDaParcela(parcelaId: string): Promise<ConsultaNota> {
  try {
    const { parcela } = await carregarParcela(parcelaId);
    if (!parcela?.spedy_nota_id) return { ok: false, erro: "Esta parcela não tem nota emitida pela Spedy." };
    const integracao = escolherIntegracao(await carregarIntegracoesAtivas(), parcela.matriculas?.turmas?.curso_id);
    if (!integracao) return { ok: false, erro: "Nenhuma integração Spedy ativa para o curso desta parcela." };
    return await consultarNotaFiscal(parcela.spedy_nota_id, integracao);
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Falha ao consultar a nota." };
  }
}

// Emissão AUTOMÁTICA ao confirmar um pagamento: roda depois da resposta (after) e
// engole qualquer falha — nunca atrasa nem impede a confirmação do pagamento. Sem
// integração ativa pro curso, não faz nada.
export function emitirNotaAutomatica(parcelaId: string): void {
  const tarefa = async () => {
    try {
      const resultado = await emitirNotaFiscalDaParcela(parcelaId);
      if (!resultado.ok && !resultado.semIntegracao) {
        console.error(`[spedy] emissão automática da parcela ${parcelaId} falhou: ${resultado.erro}`);
      }
    } catch (erro) {
      console.error(`[spedy] emissão automática da parcela ${parcelaId} falhou`, erro);
    }
  };
  try {
    after(tarefa);
  } catch {
    void tarefa();
  }
}
