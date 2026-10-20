"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMinor, onlyDigits } from "@/lib/alunos/schema";
import { getTermoLegalPublico } from "@/lib/termos-legais/get-termo";
import { dispararEvento } from "@/lib/automacoes/motor";

// Assinatura SEM login — mesmo padrão de assinarContratoPorCpf (src/app/contrato/[matriculaId]/
// actions.ts): validação por CPF em vez de sessão, sempre via createAdminClient() (service_role
// bypassa a RLS "aluno_id = auth.uid()", que não se aplica aqui). Não existe fluxo equivalente
// com login pra regenerar/tocar — src/app/aluno/legal/imagem/page.tsx é só leitura, sem aceite,
// e continua intocado.
export async function assinarTermoImagemPorCpf(
  matriculaId: string,
  cpfDigitado: string,
): Promise<{ success: true } | { error: string }> {
  const admin = createAdminClient();

  const { data: jaAssinado } = await admin
    .from("termos_imagem_assinados")
    .select("id")
    .eq("matricula_id", matriculaId)
    .maybeSingle();

  if (jaAssinado) {
    return { error: "Termo de imagem já assinado." };
  }

  const { data: matricula } = await admin.from("matriculas").select("aluno_id").eq("id", matriculaId).maybeSingle();

  if (!matricula?.aluno_id) {
    return { error: "Matrícula não encontrada." };
  }

  const { data: aluno } = await admin
    .from("alunos")
    .select("id, full_name, cpf, data_nascimento")
    .eq("id", matricula.aluno_id)
    .maybeSingle();

  if (!aluno) {
    return { error: "Matrícula não encontrada." };
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

  const termo = await getTermoLegalPublico("imagem");

  const { error } = await admin.from("termos_imagem_assinados").insert({
    matricula_id: matriculaId,
    aluno_id: aluno.id,
    cpf_assinante: cpfNormalizado,
    tipo_assinante: tipoAssinante,
    aceito_ip: ip,
    versao_texto: termo?.conteudo ?? null,
  });

  if (error) {
    return { error: "Não foi possível registrar a assinatura. Tente novamente." };
  }

  // "termo.aceito" já existe no vocabulário de eventos (src/lib/automacoes/schema.ts) com
  // handler no Telegram (notificarTermoAceito) — confirmado sem nenhum disparo real em todo o
  // projeto até esta tarefa, então não há risco de notificação duplicada reaproveitando-o aqui.
  await dispararEvento(
    "termo.aceito",
    { nome_aluno: aluno.full_name ?? "aluno(a)", nome_termo: "Termo de Uso de Imagem" },
    `termo-imagem-aceito-${matriculaId}`,
  );

  return { success: true };
}
