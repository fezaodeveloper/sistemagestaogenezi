"use server";

import crypto from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarEmail, resendConfigurado } from "@/lib/resend/client";
import {
  criarAssinaturaConecta,
  criarClienteAsaasConecta,
  cancelarAssinaturaConecta,
} from "@/lib/asaas/client";
import { candidatoExternoCadastroSchema, PLANO_CONECTA_INFO } from "@/lib/conecta/schema";

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
      cycle: "MONTHLY",
      description: `Gênezi Conecta — Plano ${planoInfo.label}`,
    });
    asaasSubscriptionId = assinatura.id;
  } catch (erro) {
    await admin.auth.admin.deleteUser(userId);
    const mensagemErro = erro instanceof Error ? erro.message : JSON.stringify(erro);
    console.error("[CONECTA ASSINATURA]", mensagemErro);
    return { error: `Erro ao criar assinatura: ${mensagemErro}` };
  }

  const { error: perfilError } = await admin.from("perfis_conecta").insert({
    aluno_id: userId,
    tipo: "externo",
    nome: data.nome,
    email: data.email,
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

  // Best-effort — o cadastro já foi concluído com sucesso acima.
  if (resendConfigurado()) {
    try {
      await enviarEmail({
        to: data.email,
        subject: "Gênezi Conecta — Seu acesso ao portal de empregos",
        html: `
          <p>Olá, ${data.nome}!</p>
          <p>Seu cadastro no Gênezi Conecta (plano ${planoInfo.label}) foi recebido.</p>
          <p>Assim que seu pagamento for confirmado, seu perfil será ativado automaticamente.</p>
          <p><strong>Seus dados de acesso:</strong><br>
          E-mail: ${data.email}<br>
          Senha temporária: ${senhaTemporaria}</p>
          <p>Acesse em <a href="https://sistemagestaogenezi.vercel.app/entrar">sistemagestaogenezi.vercel.app/entrar</a> e troque sua senha no primeiro acesso.</p>
        `,
      });
    } catch {
      // Best-effort — ver comentário acima.
    }
  }

  redirect("/conecta/aguardando-pagamento");
}
