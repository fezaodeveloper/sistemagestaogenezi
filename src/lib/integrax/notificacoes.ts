import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarSMS, normalizarTextoSms, SMS_LIMITE_CARACTERES } from "@/lib/integrax/sms";

// SMS automáticos do sistema (matrícula criada, pagamento recebido, cobrança
// gerada) pela IntegraX. Cada função agenda o envio pra DEPOIS da resposta (after)
// e engole qualquer erro — nunca atrasa nem quebra o fluxo que chamou.
//
// Enquanto a integração não estiver configurada e ativa em
// /admin/configuracoes/apps/integrax, enviarSMS() só registra no console o que SERIA
// enviado (destino, tamanho e texto) — é o "stub" pedido. Ligar a integração passa a
// enviar de verdade nesses três pontos.

type Aluno = { full_name: string | null; email: string | null; telefone: string | null } | null;

function emSegundoPlano(tarefa: () => Promise<void>): void {
  const executar = async () => {
    try {
      await tarefa();
    } catch (erro) {
      console.error("[integrax] falha ao preparar SMS", erro);
    }
  };
  try {
    after(executar);
  } catch {
    void executar();
  }
}

function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] || "aluno(a)";
}

function encurtar(texto: string | null | undefined, maximo: number): string {
  const limpo = normalizarTextoSms(texto ?? "");
  return limpo.length <= maximo ? limpo : `${limpo.slice(0, maximo - 1).trimEnd()}.`;
}

function reais(valor: number): string {
  return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`;
}

function dataBR(iso: string | null): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// Garante o teto de 160 (o helper também corta, mas aqui o corte cai no nome do
// curso e não no meio de um dado importante).
function caber(prefixo: string, sufixo: string, variavel: string): string {
  const sobra = SMS_LIMITE_CARACTERES - prefixo.length - sufixo.length;
  return `${prefixo}${encurtar(variavel, Math.max(8, sobra))}${sufixo}`;
}

// ----- Matrícula criada: boas-vindas com os dados de acesso -----

type LinhaMatricula = {
  alunos: Aluno;
  turmas: { cursos: { nome: string } | null } | null;
};

export function notificarSmsMatriculaCriada(matriculaId: string): void {
  emSegundoPlano(async () => {
    const { data } = await createAdminClient()
      .from("matriculas")
      .select("alunos(full_name, email, telefone), turmas(cursos(nome))")
      .eq("id", matriculaId)
      .maybeSingle();
    const matricula = data as unknown as LinhaMatricula | null;
    const aluno = matricula?.alunos;
    if (!aluno?.telefone) return;

    // A senha não é conhecida aqui (a conta do aluno já existia); o SMS traz o
    // login (e-mail) — a senha continua sendo entregue pelo fluxo de acesso.
    const prefixo = `GENEZI: Ola, ${primeiroNome(aluno.full_name)}! Matricula confirmada em `;
    const sufixo = `. Acesse a plataforma com o e-mail ${aluno.email ?? "cadastrado"}.`;
    const mensagem = caber(prefixo, sufixo, matricula?.turmas?.cursos?.nome ?? "seu curso");
    await enviarSMS(aluno.telefone, mensagem);
  });
}

// ----- Parcela: pagamento recebido / cobrança gerada -----

type LinhaParcela = {
  valor: number;
  numero_parcela: number;
  data_vencimento: string | null;
  alunos: Aluno;
  matriculas: { num_parcelas: number | null; turmas: { cursos: { nome: string } | null } | null } | null;
};

async function carregarParcela(parcelaId: string): Promise<LinhaParcela | null> {
  const { data } = await createAdminClient()
    .from("parcelas")
    .select(
      "valor, numero_parcela, data_vencimento, alunos(full_name, email, telefone), matriculas(num_parcelas, turmas(cursos(nome)))",
    )
    .eq("id", parcelaId)
    .maybeSingle();
  return data as unknown as LinhaParcela | null;
}

function rotuloParcela(parcela: LinhaParcela): string {
  const total = parcela.matriculas?.num_parcelas;
  return total && total > 1 ? `${parcela.numero_parcela}/${total}` : String(parcela.numero_parcela);
}

export function notificarSmsPagamentoRecebido(parcelaId: string): void {
  emSegundoPlano(async () => {
    const parcela = await carregarParcela(parcelaId);
    const aluno = parcela?.alunos;
    if (!parcela || !aluno?.telefone) return;

    const prefixo = `GENEZI: Ola, ${primeiroNome(aluno.full_name)}! Recebemos o pagamento da parcela ${rotuloParcela(parcela)} (${reais(parcela.valor)}) de `;
    const mensagem = caber(prefixo, ". Obrigado!", parcela.matriculas?.turmas?.cursos?.nome ?? "seu curso");
    await enviarSMS(aluno.telefone, mensagem);
  });
}

export function notificarSmsCobrancaGerada(parcelaId: string): void {
  emSegundoPlano(async () => {
    const parcela = await carregarParcela(parcelaId);
    const aluno = parcela?.alunos;
    if (!parcela || !aluno?.telefone) return;

    const venc = dataBR(parcela.data_vencimento);
    const prefixo = `GENEZI: ${primeiroNome(aluno.full_name)}, parcela ${rotuloParcela(parcela)} de ${reais(parcela.valor)} vence em ${venc}. Curso: `;
    const mensagem = caber(prefixo, ".", parcela.matriculas?.turmas?.cursos?.nome ?? "");
    await enviarSMS(aluno.telefone, mensagem);
  });
}
