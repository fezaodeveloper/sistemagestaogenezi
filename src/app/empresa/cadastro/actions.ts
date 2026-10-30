"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispararEvento } from "@/lib/automacoes/motor";
import {
  buscarCobrancasAssinaturaConecta,
  cancelarAssinaturaConecta,
  criarAssinaturaConecta,
  criarClienteAsaasConecta,
} from "@/lib/asaas/client";
import { empresaCadastroSchema, limparNomeReceita, VALOR_ASSINATURA_EMPRESA } from "@/lib/conecta/schema";
import { notificarNovaEmpresaTelegram } from "@/lib/conecta/telegram";
import { enviarWhatsappCadastroEmpresa } from "@/lib/conecta/whatsapp";
import { enviarCadastroRecebidoEmpresa } from "@/lib/resend/emails";

export type CadastroEmpresaState = { error?: string } | undefined;

export type ConsultaCnpjResultado =
  | { ok: true; nomeEmpresa: string; cidade: string; estado: string }
  // bloqueante diferencia "CNPJ realmente inativo/inválido" (impede o
  // cadastro, REGRA da tarefa) de "serviço indisponível agora" (rate limit,
  // rede) — nesse segundo caso o formulário continua liberado pra
  // preenchimento manual, best-effort.
  | { ok: false; error: string; bloqueante: boolean };

// ReceitaWS (gratuita, sem key) — consulta roda no servidor pra evitar CORS
// e não expor a URL de terceiro no client. Best-effort: qualquer falha de
// rede ou 5xx apenas deixa o formulário como preenchimento manual, sem
// travar o cadastro. Só o caso explícito "empresa não ativa" bloqueia de
// verdade (REGRA da tarefa).
export async function consultarCnpj(cnpjBruto: string): Promise<ConsultaCnpjResultado> {
  const cnpj = cnpjBruto.replace(/\D/g, "");
  if (cnpj.length !== 14) {
    return { ok: false, error: "CNPJ inválido.", bloqueante: true };
  }

  try {
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`);

    if (response.status === 429) {
      return {
        ok: false,
        error: "Muitas consultas de CNPJ agora. Tente novamente em instantes.",
        bloqueante: false,
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: "Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.",
        bloqueante: false,
      };
    }

    const data = (await response.json()) as {
      status?: string;
      message?: string;
      nome?: string;
      municipio?: string;
      uf?: string;
      situacao?: string;
    };

    if (data.status === "ERROR") {
      return { ok: false, error: data.message ?? "CNPJ não encontrado.", bloqueante: true };
    }
    if (data.situacao && data.situacao.toUpperCase() !== "ATIVA") {
      return {
        ok: false,
        error: "CNPJ inativo ou inválido. Apenas empresas ativas podem se cadastrar.",
        bloqueante: true,
      };
    }

    return {
      ok: true,
      nomeEmpresa: data.nome ? limparNomeReceita(data.nome) : "",
      cidade: data.municipio ?? "",
      estado: data.uf ?? "",
    };
  } catch {
    return {
      ok: false,
      error: "Não foi possível consultar o CNPJ agora. Preencha os dados manualmente.",
      bloqueante: false,
    };
  }
}

// Fluxo análogo a createAluno (src/app/admin/alunos/actions.ts): cria o
// usuário já confirmado via client admin (sem etapa de verificação de
// e-mail — a empresa precisa poder acessar o painel na hora, mesmo que o
// cadastro em si fique "pendente" até um admin aprovar).
//
// Desvio do pedido original (que descrevia supabase.auth.signUp +
// UPDATE profiles direto): profiles.role só tem grant de update pra
// full_name/avatar_url no client autenticado (ver CLAUDE.md/
// 20260731180000_add_role_to_profiles.sql) — setar role exige o client
// admin (service_role), que já tem grant total em profiles desde
// 20260731150000_grant_service_role_profiles.sql. Por isso todo o
// provisionamento (createUser, UPDATE role, INSERT empresas_conecta) roda
// no client admin, e só o sign-in final (pra estabelecer a sessão do
// navegador) usa o client autenticado normal.
export async function cadastrarEmpresa(
  _prevState: CadastroEmpresaState,
  formData: FormData,
): Promise<CadastroEmpresaState> {
  // Código de acesso REMOVIDO (TAREFA: remover código de acesso, qualquer empresa pode se
  // cadastrar; aprovação é feita manualmente pelo admin via ativarEmpresa, que já existia).
  const parsed = empresaCadastroSchema.safeParse({
    nome_empresa: formData.get("nome_empresa"),
    cnpj: formData.get("cnpj") || undefined,
    setor: formData.get("setor") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    site: formData.get("site") || undefined,
    endereco: formData.get("endereco") || undefined,
    numero: formData.get("numero"),
    link_maps: formData.get("link_maps") || undefined,
    nome_responsavel: formData.get("nome_responsavel"),
    email: formData.get("email"),
    whatsapp: formData.get("whatsapp"),
    telefone: formData.get("telefone") || undefined,
    senha: formData.get("senha"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const confirmarSenha = formData.get("confirmar_senha");
  if (confirmarSenha !== parsed.data.senha) {
    return { error: "As senhas não coincidem." };
  }

  if (formData.get("aceite_termos") !== "on") {
    return { error: "É necessário concordar com os termos de uso." };
  }

  const data = parsed.data;
  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.senha,
    email_confirm: true,
    user_metadata: { full_name: data.nome_responsavel },
  });

  if (createError || !created.user) {
    const message =
      createError?.code === "email_exists"
        ? "Já existe uma conta com esse e-mail."
        : "Não foi possível criar a conta. Tente novamente.";
    return { error: message };
  }

  const userId = created.user.id;

  const { error: roleError } = await admin.from("profiles").update({ role: "empresa" }).eq("id", userId);
  if (roleError) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível concluir o cadastro. Tente novamente." };
  }

  // TAREFA: empresa deixou de ser gratuita — assinatura anual R$ 29,90 via Asaas, mesmo padrão
  // (customer + subscription recorrente) já usado por candidatos externos em
  // cadastrarCandidatoExterno (src/app/conecta/cadastro/actions.ts). Criado ANTES do INSERT em
  // empresas_conecta pra já salvar os ids na mesma linha, sem precisar de um UPDATE separado.
  let asaasCustomerId: string;
  try {
    const cliente = await criarClienteAsaasConecta({
      name: data.nome_empresa,
      email: data.email,
      cpfCnpj: data.cnpj,
      phone: data.whatsapp,
    });
    asaasCustomerId = cliente.id;
  } catch {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível processar o pagamento agora. Tente novamente." };
  }

  let asaasSubscriptionId: string;
  try {
    const assinatura = await criarAssinaturaConecta({
      customer: asaasCustomerId,
      billingType: "UNDEFINED",
      value: VALOR_ASSINATURA_EMPRESA,
      nextDueDate: amanhaISO(),
      cycle: "YEARLY",
      description: "Gênezi Conecta - Assinatura anual (empresa)",
    });
    asaasSubscriptionId = assinatura.id;
  } catch {
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível criar a assinatura agora. Tente novamente." };
  }

  const { data: empresa, error: empresaError } = await admin
    .from("empresas_conecta")
    .insert({
      profile_id: userId,
      nome_empresa: data.nome_empresa,
      cnpj: data.cnpj ?? null,
      nome_responsavel: data.nome_responsavel,
      email: data.email,
      whatsapp: data.whatsapp,
      telefone: data.telefone ?? null,
      site: data.site ?? null,
      endereco: data.endereco ?? null,
      numero: data.numero,
      link_maps: data.link_maps ?? null,
      setor: data.setor ?? null,
      cidade: data.cidade ?? null,
      estado: data.estado ?? null,
      status: "pendente",
      asaas_customer_id: asaasCustomerId,
      asaas_subscription_id: asaasSubscriptionId,
    })
    .select("id")
    .single();

  if (empresaError || !empresa) {
    try {
      await cancelarAssinaturaConecta(asaasSubscriptionId);
    } catch {
      // Best-effort — a conta já vai ser removida de qualquer forma abaixo.
    }
    await admin.auth.admin.deleteUser(userId);
    return { error: "Não foi possível salvar os dados da empresa. Tente novamente." };
  }

  // Best-effort — o cadastro já foi concluído com sucesso acima, uma falha
  // aqui (notificação) não deve impedir o fluxo de pagamento a seguir.
  try {
    await dispararEvento(
      "empresa.cadastro",
      {
        nome_empresa: data.nome_empresa,
        nome_responsavel: data.nome_responsavel,
        whatsapp: data.whatsapp,
        cidade: data.cidade ?? "—",
        estado: data.estado ?? "—",
      },
      `empresa-cadastro-${empresa.id}`,
    );
  } catch {
    // Best-effort — ver comentário acima.
  }

  // Notificação Telegram do CONECTA (chat dedicado, ver src/lib/conecta/telegram.ts) — "alguém
  // se cadastrou", diferente de notificarEmpresaPagamentoConfirmado (webhook, "empresa pagou").
  await notificarNovaEmpresaTelegram({
    nome: data.nome_empresa,
    cidade: data.cidade ?? null,
    email: data.email,
  });

  // Email + WhatsApp "cadastro recebido" pra EMPRESA (diferente da notificação Telegram acima,
  // que é pro ADMIN) — best-effort, mesmo motivo dos demais.
  await enviarCadastroRecebidoEmpresa(data.email, data.nome_empresa);
  await enviarWhatsappCadastroEmpresa(data.whatsapp, data.nome_empresa, data.email);

  // Sem sign-in aqui (diferente da versão anterior, que logava a empresa direto no painel) —
  // igual ao candidato externo: o acesso só é liberado de fato quando o pagamento + aprovação do
  // admin confirmarem (ver empresa/(protegido)/layout.tsx), então a empresa loga por conta
  // própria em /empresa/login depois, com a senha que ela mesma cadastrou aqui.
  let paymentId: string | undefined;
  try {
    const cobrancas = await buscarCobrancasAssinaturaConecta(asaasSubscriptionId);
    paymentId = cobrancas[0]?.id;
  } catch {
    // Best-effort — sem o id a página de espera só cai no estado sem QR Code/link direto.
  }

  redirect(
    paymentId
      ? `/empresa/aguardando-pagamento?payment=${encodeURIComponent(paymentId)}`
      : "/empresa/aguardando-pagamento",
  );
}

function amanhaISO(): string {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  return data.toISOString().slice(0, 10);
}
