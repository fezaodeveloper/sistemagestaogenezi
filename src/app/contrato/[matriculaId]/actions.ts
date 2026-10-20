"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMinor, onlyDigits } from "@/lib/alunos/schema";
import { dispararEvento } from "@/lib/automacoes/motor";

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
    .select("id, cpf, data_nascimento")
    .eq("id", contrato.aluno_id)
    .maybeSingle();

  if (!aluno) {
    return { error: "Contrato não encontrado ou já assinado." };
  }

  const cpfNormalizado = onlyDigits(cpfDigitado);
  const menor = isMinor(aluno.data_nascimento);

  let tipoAssinante: "aluno" | "responsavel";

  if (!menor) {
    if (cpfNormalizado !== onlyDigits(aluno.cpf)) {
      return { error: "CPF não confere com o cadastro do aluno." };
    }
    tipoAssinante = "aluno";
  } else {
    const { data: responsaveis } = await admin.from("responsaveis").select("cpf").eq("aluno_id", aluno.id);

    const bateComAlgumResponsavel = (responsaveis ?? []).some((r) => onlyDigits(r.cpf) === cpfNormalizado);
    if (!bateComAlgumResponsavel) {
      return { error: "CPF não confere com nenhum responsável cadastrado." };
    }
    tipoAssinante = "responsavel";
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
  // duplicidade pra uma mesma matrícula.
  await dispararEvento("contrato.assinado", { matriculaId }, `contrato-assinado-${matriculaId}`);

  return { success: true };
}
