"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMinor, onlyDigits } from "@/lib/alunos/schema";
import { dispararEvento } from "@/lib/automacoes/motor";
import { gerarContratoPdf } from "@/lib/contratos/pdf";
import { getTermoLegalPublico } from "@/lib/termos-legais/get-termo";
import type { TermoLegal } from "@/lib/termos-legais/schema";

// Assinatura SEM login — validação por CPF em vez de sessão. Por isso sem requireRole() (não há
// usuário autenticado neste fluxo) e sempre via createAdminClient() (service_role bypassa a RLS
// "aluno_id = auth.uid()" das policies existentes, que não se aplicam aqui). O fluxo COM login
// (src/app/aluno/contrato/actions.ts::assinarContrato) continua intacto e não é tocado por esta
// function.
export async function assinarContratoPorCpf(
  matriculaId: string,
  cpfDigitado: string,
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient();

  const { data: contrato } = await admin
    .from("contratos_assinados")
    .select("id, aluno_id")
    .eq("matricula_id", matriculaId)
    .eq("status", "pendente")
    .maybeSingle();

  if (!contrato) {
    return { error: "Contrato não encontrado ou já assinado." };
  }

  const { data: aluno } = await admin
    .from("alunos")
    .select("id, full_name, cpf, data_nascimento")
    .eq("id", contrato.aluno_id)
    .maybeSingle();

  if (!aluno) {
    return { error: "Contrato não encontrado ou já assinado." };
  }

  const cpfNormalizado = onlyDigits(cpfDigitado);
  const menor = isMinor(aluno.data_nascimento);

  let tipoAssinante: "aluno" | "responsavel";
  // Nome exibido no rodapé de assinatura do PDF regenerado abaixo — do aluno, ou do responsável
  // específico cujo CPF bateu (não "um responsável qualquer").
  let nomeAssinante: string;

  if (!menor) {
    if (cpfNormalizado !== onlyDigits(aluno.cpf)) {
      return { error: "CPF não confere com o cadastro do aluno." };
    }
    tipoAssinante = "aluno";
    nomeAssinante = aluno.full_name ?? "aluno(a)";
  } else {
    const { data: responsaveis } = await admin.from("responsaveis").select("nome, cpf").eq("aluno_id", aluno.id);

    const responsavelEncontrado = (responsaveis ?? []).find((r) => onlyDigits(r.cpf) === cpfNormalizado);
    if (!responsavelEncontrado) {
      return { error: "CPF não confere com nenhum responsável cadastrado." };
    }
    tipoAssinante = "responsavel";
    nomeAssinante = responsavelEncontrado.nome;
  }

  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { error } = await admin
    .from("contratos_assinados")
    .update({
      status: "aceito",
      aceito_em: new Date().toISOString(),
      aceito_ip: ip,
      cpf_assinante: cpfNormalizado,
      tipo_assinante: tipoAssinante,
    })
    .eq("id", contrato.id);

  if (error) {
    return { error: "Não foi possível registrar a assinatura. Tente novamente." };
  }

  // Mesmo evento do fluxo com login (ver assinarContrato em src/app/aluno/contrato/actions.ts)
  // — mesma idempotency_key (matriculaId), então os dois caminhos nunca disparam o evento em
  // duplicidade pra uma mesma matrícula. nome_aluno/alunoId já estão em escopo (aluno buscado
  // acima pra validar o CPF) — só nome_curso precisa de uma consulta nova, mesmo padrão da
  // versão com login.
  const { data: matriculaInfo } = await admin
    .from("matriculas")
    .select("turmas(cursos(nome))")
    .eq("id", matriculaId)
    .maybeSingle();
  const nomeCurso =
    (matriculaInfo as unknown as { turmas: { cursos: { nome: string } | null } | null } | null)?.turmas?.cursos
      ?.nome ?? "—";

  await dispararEvento(
    "contrato.assinado",
    {
      nome_aluno: aluno.full_name ?? "—",
      nome_curso: nomeCurso,
      matricula_id: matriculaId,
      matriculaId,
      alunoId: aluno.id,
    },
    `contrato-assinado-${matriculaId}`,
  );

  // Best-effort: regenera o PDF com o rodapé de aceite digital, mesmo padrão de
  // assinarContrato() em src/app/aluno/contrato/actions.ts. Se falhar, a assinatura já
  // registrada acima continua válida — só o PDF ficaria sem o rodapé.
  try {
    const agora = new Date();
    const dataFormatada = `${agora.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${agora.toLocaleTimeString(
      "pt-BR",
      { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" },
    )}`;
    const pdfBuffer = await gerarContratoPdf(matriculaId, { assinatura: { nome: nomeAssinante, dataFormatada } });
    await admin.from("contratos_assinados").update({ conteudo_pdf_base64: pdfBuffer.toString("base64") }).eq("id", contrato.id);
  } catch {
    // Best-effort — a assinatura já foi registrada com sucesso acima.
  }

  return { success: true };
}

// Usada pelo estado de sucesso de ContratoAssinarForm pra decidir se mostra o formulário do
// Termo de Imagem em seguida (fluxo sequencial no mesmo link, sem precisar ir pra
// /termo-imagem/[matriculaId]/assinar) ou a mensagem final de "tudo assinado".
export async function verificarTermoImagemAssinado(matriculaId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("termos_imagem_assinados")
    .select("id")
    .eq("matricula_id", matriculaId)
    .maybeSingle();
  return !!data;
}

// Conteúdo do Termo de Imagem pra exibição ANTES da assinatura, usado pelo fluxo inline em
// ContratoAssinarForm (mostra o termo logo após assinar o contrato, sem navegar pra
// /termo-imagem/[matriculaId]/assinar). matriculaId é recebido por consistência com o resto
// deste arquivo (todo fluxo aqui é "sem login, escopado a uma matrícula"), mas o termo em si é
// um texto único por chave ("imagem"), não por matrícula — não é usado na consulta.
export async function getConteudoTermoImagem(_matriculaId: string): Promise<TermoLegal | null> {
  return getTermoLegalPublico("imagem");
}
