"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarBoasVindas } from "@/lib/resend/emails";
import {
  criarAssinaturaConecta,
  criarClienteAsaasConecta,
  cancelarAssinaturaConecta,
  buscarCobrancasAssinaturaConecta,
} from "@/lib/asaas/client";
import { calculateAge } from "@/lib/alunos/schema";
import { candidatoExternoCadastroSchema, PLANO_CONECTA_INFO } from "@/lib/conecta/schema";
import { notificarNovoCandidatoTelegram } from "@/lib/conecta/telegram";

const IDADE_MINIMA_CONECTA = 16;

export type CadastroCandidatoExternoState = { error?: string } | undefined;

// Gerado no servidor (node:crypto, não window.crypto) — candidato nunca
// escolhe a própria senha aqui, ela é enviada por e-mail e trocada no
// primeiro acesso.
function gerarSenhaTemporaria(): string {
  return crypto.randomBytes(9).toString("base64url");
}

function amanhaISO(): string {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  return data.toISOString().slice(0, 10);
}

// Fluxo análogo a cadastrarEmpresa (src/app/empresa/cadastro/actions.ts),
// mas sem sign-in automático ao final: o perfil só é ativado quando o
// webhook asaas-conecta confirmar o primeiro pagamento, então o candidato
// acessa por conta própria em /entrar depois (REGRA da tarefa).
// Todo o provisionamento roda no client admin (service_role) porque não há
// sessão autenticada nesta página pública.
export async function cadastrarCandidatoExterno(
  _prevState: CadastroCandidatoExternoState,
  formData: FormData,
): Promise<CadastroCandidatoExternoState> {
  const parsed = candidatoExternoCadastroSchema.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    data_nascimento: formData.get("data_nascimento"),
    whatsapp: formData.get("whatsapp"),
    cpf: formData.get("cpf") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    plano: formData.get("plano"),
    forma_pagamento: formData.get("forma_pagamento"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const data = parsed.data;

  // Proteção de idade (TAREFA 1) — nunca confia só na checagem do client (cadastro-externo-
  // form.tsx): refaz o cálculo aqui com a data de nascimento validada pelo Zod.
  const idade = calculateAge(data.data_nascimento);
  if (idade < IDADE_MINIMA_CONECTA) {
    return { error: "Você precisa ter no mínimo 16 anos para se cadastrar no Gênezi Conecta." };
  }
  const menorComTermo = idade < 18;
  if (menorComTermo && formData.get("menor_com_termo") !== "on") {
    return {
      error:
        "É necessário declarar que será acompanhado por um dos pais ou responsável legal em qualquer entrevista.",
    };
  }

  const admin = createAdminClient();

  const { data: perfilExistente } = await admin
    .from("perfis_conecta")
    .select("id")
    .eq("email", data.email)
    .maybeSingle();

  if (perfilExistente) {
    return { error: "Email já cadastrado. Faça login." };
  }

  const senhaTemporaria = gerarSenhaTemporaria();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: senhaTemporaria,
    email_confirm: true,
    user_metadata: { full_name: data.nome },
  });

  if (createError || !created.user) {
    const message =
      createError?.code === "email_exists"
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar a conta. Tente novamente.";
    return { error: message };
  }

  const userId = created.user.id;

  // profiles.role já nasce 'aluno' por default (ver handle_new_user) —
  // update explícito aqui só documenta a intenção (REGRA: externos usam
  // role 'aluno' pra simplificar acesso ao portal), sem depender do valor
  // default silenciosamente.
  const { error: roleError } = await admin.from("profiles").update({ role: "aluno" }).eq("id", userId);
  if (roleError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }

  let asaasCustomerId: string;
  try {
    const cliente = await criarClienteAsaasConecta({
      name: data.nome,
      email: data.email,
      cpfCnpj: data.cpf,
      phone: data.whatsapp,
    });
    asaasCustomerId = cliente.id;
  } catch {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível processar o pagamento agora. Tente novamente." };
  }

  const planoInfo = PLANO_CONECTA_INFO[data.plano];
  let asaasSubscriptionId: string;
  try {
    const assinatura = await criarAssinaturaConecta({
      customer: asaasCustomerId,
      billingType: data.forma_pagamento,
      value: planoInfo.valor,
      nextDueDate: amanhaISO(),
      // TAREFA: candidato passou de mensal pra anual (R$ 9,90/ano, era R$ 9,90/mês).
      cycle: "YEARLY",
      description: "Gênezi Conecta - Acesso anual",
    });
    asaasSubscriptionId = assinatura.id;
  } catch {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível criar a assinatura agora. Tente novamente." };
  }

  const { error: perfilError } = await admin.from("perfis_conecta").insert({
    aluno_id: userId,
    tipo: "externo",
    nome: data.nome,
    email: data.email,
    data_nascimento: data.data_nascimento,
    menor_com_termo: menorComTermo,
    whatsapp: data.whatsapp,
    cidade: data.cidade ?? null,
    estado: data.estado ?? null,
    plano: data.plano,
    asaas_subscription_id: asaasSubscriptionId,
    esta_ativo: false,
    visivel: false,
  });

  if (perfilError) {
    try {
      await cancelarAssinaturaConecta(asaasSubscriptionId);
    } catch {
      // Best-effort — a conta já vai ser removida de qualquer forma abaixo.
    }
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível salvar seu cadastro. Tente novamente." };
  }

  // Best-effort — o cadastro já foi concluído com sucesso acima, antes mesmo da confirmação de
  // pagamento (que dispara sua própria notificação, de "perfil ativado", no webhook
  // asaas-conecta). Esta aqui é "alguém se cadastrou", não "pagou".
  await notificarNovoCandidatoTelegram({
    nome: data.nome,
    tipo: "externo",
    cidade: data.cidade ?? null,
    estado: data.estado ?? null,
  });

  // Best-effort — o cadastro já foi concluído com sucesso acima; sem o link
  // de pagamento o candidato só cai na página de espera sem o atalho
  // direto, mas a assinatura já existe e ele consegue pagar por outra via
  // (ex.: e-mail de cobrança que o Asaas envia por conta própria).
  let paymentId: string | undefined;
  try {
    const cobrancas = await buscarCobrancasAssinaturaConecta(asaasSubscriptionId);
    paymentId = cobrancas[0]?.id;
  } catch {
    // Best-effort — ver comentário acima.
  }

  // Best-effort — o cadastro já foi concluído com sucesso acima.
  await enviarBoasVindas(data.email, data.nome, senhaTemporaria);

  redirect(
    paymentId
      ? `/conecta/aguardando-pagamento?payment=${encodeURIComponent(paymentId)}`
      : "/conecta/aguardando-pagamento",
  );
}
