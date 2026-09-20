import "server-only";

import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail } from "@/lib/email/provedor";
import { renderizarTemplate } from "@/lib/email/templates";
import type { EmailTemplateId } from "@/lib/email/templates-padrao";
import type { Variaveis } from "@/lib/email/renderizar";
import { diaSemanaExtenso } from "@/lib/datas/util";

// E-mails automáticos do sistema (matrícula, cobrança, agendamento, campanha). Cada
// função agenda o envio pra DEPOIS da resposta (after) e engole qualquer falha —
// nunca atrasa nem quebra o fluxo que chamou. Sem provedor configurado, o
// enviarEmail só devolve { ok: false } e nada acontece.

const URL_SITE_PADRAO = "https://sistemagestaogenezi.vercel.app";

function emSegundoPlano(tarefa: () => Promise<void>): void {
  const executar = async () => {
    try {
      await tarefa();
    } catch (erro) {
      console.error("[email] falha ao preparar e-mail", erro);
    }
  };
  try {
    after(executar);
  } catch {
    void executar();
  }
}

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || URL_SITE_PADRAO;
}

// Renderiza o template e envia (template desativado pelo admin = não envia).
async function enviarTemplate(id: EmailTemplateId, para: string | null | undefined, variaveis: Variaveis): Promise<void> {
  const email = para?.trim();
  if (!email) return;
  const renderizado = await renderizarTemplate(id, variaveis);
  if (!renderizado) return;

  const resultado = await enviarEmail({ para: email, assunto: renderizado.assunto, html: renderizado.html, texto: renderizado.texto });
  if (!resultado.ok) console.error(`[email] "${id}" para ${email} não enviado: ${resultado.erro}`);
}

const REAIS = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dataBR(iso: string | null | undefined): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

// ----- Matrícula criada: ACESSO + BOAS_VINDAS -----

type LinhaMatricula = {
  alunos: { full_name: string | null; email: string | null } | null;
  turmas: { cursos: { nome: string } | null } | null;
};

export function notificarEmailMatriculaCriada(matriculaId: string): void {
  emSegundoPlano(async () => {
    const { data } = await createAdminClient()
      .from("matriculas")
      .select("alunos(full_name, email), turmas(cursos(nome))")
      .eq("id", matriculaId)
      .maybeSingle();
    const matricula = data as unknown as LinhaMatricula | null;
    const aluno = matricula?.alunos;
    if (!aluno?.email) return;

    const nome = aluno.full_name ?? "aluno(a)";
    await enviarTemplate("acesso", aluno.email, {
      nome_cliente: nome,
      email_cliente: aluno.email,
      // A senha não é conhecida aqui (a conta do aluno já existia, com a senha entregue no cadastro).
      senha: "a senha definida no seu cadastro (se não lembrar, use “Esqueci minha senha” na tela de login)",
      nome_produto: matricula?.turmas?.cursos?.nome ?? "seu curso",
      link_acesso: `${siteBase()}/entrar`,
    });
    await enviarTemplate("boas_vindas", aluno.email, { nome_cliente: nome });
  });
}

// ----- Cobrança gerada -----

type LinhaParcela = {
  valor: number;
  numero_parcela: number;
  data_vencimento: string | null;
  alunos: { full_name: string | null; email: string | null } | null;
  matriculas: { num_parcelas: number | null; turmas: { cursos: { nome: string } | null } | null } | null;
};

export type LinksCobranca = { boleto?: string | null; pix?: string | null; codigoPix?: string | null };

// Chamada sempre que uma cobrança é gerada (hoje: Asaas, na tela do financeiro; os
// demais gateways devem chamar aqui quando passarem a gerar cobrança pelo sistema).
export function notificarEmailCobrancaGerada(parcelaId: string, links: LinksCobranca): void {
  emSegundoPlano(async () => {
    const { data } = await createAdminClient()
      .from("parcelas")
      .select("valor, numero_parcela, data_vencimento, alunos(full_name, email), matriculas(num_parcelas, turmas(cursos(nome)))")
      .eq("id", parcelaId)
      .maybeSingle();
    const parcela = data as unknown as LinhaParcela | null;
    const aluno = parcela?.alunos;
    if (!parcela || !aluno?.email) return;

    const total = parcela.matriculas?.num_parcelas;
    const rotulo = total && total > 1 ? `Parcela ${parcela.numero_parcela}/${total}` : "Parcela";
    const curso = parcela.matriculas?.turmas?.cursos?.nome;
    await enviarTemplate("cobranca", aluno.email, {
      nome_cliente: aluno.full_name ?? "aluno(a)",
      descricao: curso ? `${rotulo} — ${curso}` : rotulo,
      valor: REAIS.format(Number(parcela.valor)),
      vencimento: dataBR(parcela.data_vencimento),
      link_boleto: links.boleto ?? "",
      link_pix: links.pix ?? "",
      codigo_pix: links.codigoPix ?? "",
    });
  });
}

// ----- Agendamento criado -----

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function notificarEmailAgendamento(dados: {
  nome: string;
  camposExtras: Record<string, unknown> | null | undefined;
  dataISO: string;
  horario: string;
  tituloPagina: string;
}): void {
  // O formulário público de agendamento só pede nome e WhatsApp: o e-mail existe só se
  // a página tiver um campo extra com e-mail — procura um valor com cara de e-mail.
  const email = Object.values(dados.camposExtras ?? {}).find(
    (valor): valor is string => typeof valor === "string" && REGEX_EMAIL.test(valor.trim()),
  );
  if (!email) return;

  emSegundoPlano(async () => {
    await enviarTemplate("agendamento", email.trim(), {
      nome_cliente: dados.nome,
      data: dataBR(dados.dataISO),
      horario: dados.horario,
      dia_semana: diaSemanaExtenso(dados.dataISO),
      nome_pagina: dados.tituloPagina,
    });
  });
}

// ----- Lead criado (formulário de campanha) -----

export function notificarEmailLeadCampanha(dados: { nome: string; email: string | null | undefined; nomeCampanha: string }): void {
  if (!dados.email) return;
  const email = dados.email;
  emSegundoPlano(async () => {
    await enviarTemplate("lead_confirmacao", email, { nome_cliente: dados.nome, nome_campanha: dados.nomeCampanha });
  });
}
