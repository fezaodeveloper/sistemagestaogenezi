"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarConvitePainelAdmin } from "@/lib/resend/emails";
import { solicitarRecuperacaoSenhaAction } from "@/app/recuperar-senha/actions";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sistemagestaogenezi.vercel.app").replace(/\/+$/, "");

// Roles geridos nesta tela — "aluno" nunca aparece aqui (tem tela própria em /admin/alunos).
const ROLES_GERENCIAVEIS = ["admin", "empresa"] as const;
export type RoleGerenciavel = (typeof ROLES_GERENCIAVEIS)[number];

export type UsuarioAdmin = {
  id: string;
  email: string;
  full_name: string | null;
  role: RoleGerenciavel;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
};

// profiles não guarda email/last_sign_in_at/email_confirmed_at (isso mora em auth.users) —
// cruza com auth.admin.listUsers() em memória. O volume de admin+empresa é pequeno (dezenas,
// não milhares), então paginar listUsers() inteiro é mais simples que N chamadas a
// getUserById(); o limite de 25 páginas (até 5000 usuários) é só uma rede de segurança contra
// loop infinito, não um limite esperado na prática.
export async function listarUsuarios(): Promise<UsuarioAdmin[]> {
  await requireRole("admin");
  const admin = createAdminClient();

  const { data: perfis } = await admin
    .from("profiles")
    .select("id, full_name, role, created_at")
    .in("role", ROLES_GERENCIAVEIS)
    .order("created_at", { ascending: false });

  if (!perfis || perfis.length === 0) return [];

  const idsDesejados = new Set(perfis.map((perfil) => perfil.id));
  const authPorId = new Map<string, { email: string; last_sign_in_at: string | null; email_confirmed_at: string | null }>();

  let page = 1;
  const perPage = 200;
  while (authPorId.size < idsDesejados.size && page <= 25) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data || data.users.length === 0) break;
    for (const usuario of data.users) {
      if (idsDesejados.has(usuario.id)) {
        authPorId.set(usuario.id, {
          email: usuario.email ?? "—",
          last_sign_in_at: usuario.last_sign_in_at ?? null,
          email_confirmed_at: usuario.email_confirmed_at ?? null,
        });
      }
    }
    if (data.users.length < perPage) break;
    page++;
  }

  return perfis.map((perfil) => {
    const dadosAuth = authPorId.get(perfil.id);
    return {
      id: perfil.id,
      email: dadosAuth?.email ?? "—",
      full_name: perfil.full_name,
      role: perfil.role as RoleGerenciavel,
      created_at: perfil.created_at,
      last_sign_in_at: dadosAuth?.last_sign_in_at ?? null,
      email_confirmed_at: dadosAuth?.email_confirmed_at ?? null,
    };
  });
}

// Gera o link de acesso (recovery) e envia o email de convite — reaproveitado tanto por
// convidarUsuario (primeiro envio) quanto por reenviarConvite (reenvio).
async function enviarLinkDeAcesso(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  nome: string,
  role: RoleGerenciavel,
): Promise<boolean> {
  try {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${SITE_URL}/nova-senha` },
    });

    const hashedToken = linkData?.properties?.hashed_token;
    if (!hashedToken) return false;

    // token_hash na query (não o action_link cru) — mesmo motivo de
    // src/app/recuperar-senha/actions.ts e src/lib/conecta/acesso.ts: o action_link aponta pro
    // endpoint hospedado do Supabase, que o Chrome bloqueia como bounce tracking protection.
    const link = `${SITE_URL}/nova-senha?token_hash=${hashedToken}&type=recovery`;
    return await enviarConvitePainelAdmin(email, nome, link, role);
  } catch {
    return false;
  }
}

const convidarUsuarioSchema = z.object({
  fullName: z.string().trim().min(2, "Informe o nome completo.").max(200),
  email: z.email("Informe um e-mail válido.").max(254),
  role: z.enum(ROLES_GERENCIAVEIS),
});

export type ConvidarUsuarioResultado = { ok: true } | { ok: false; erro: string };

export async function convidarUsuario(formData: FormData): Promise<ConvidarUsuarioResultado> {
  await requireRole("admin");

  const parsed = convidarUsuarioSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { ok: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { fullName, email, role } = parsed.data;

  const admin = createAdminClient();

  // Senha temporária aleatória: nunca é usada de fato — o acesso real acontece pelo link de
  // recovery enviado por email a seguir (mesmo padrão de criarAluno em
  // src/app/admin/alunos/actions.ts, que também cria com senha temporária + email_confirm).
  const senhaTemporaria = crypto.randomUUID();

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email,
    password: senhaTemporaria,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (erroCriar || !criado.user) {
    const mensagem =
      erroCriar?.code === "email_exists" ? "Já existe uma conta com esse e-mail." : "Não foi possível criar o usuário. Tente novamente.";
    return { ok: false, erro: mensagem };
  }

  // O trigger handle_new_user (migration 20260731120000) já criou a linha em profiles com
  // role padrão 'aluno' — corrige para o role escolhido no convite.
  const { error: erroRole } = await admin.from("profiles").update({ role }).eq("id", criado.user.id);
  if (erroRole) {
    return { ok: false, erro: "Usuário criado, mas não foi possível definir o perfil. Ajuste manualmente em Usuários." };
  }

  const linkOk = await enviarLinkDeAcesso(admin, email, fullName, role);
  if (!linkOk) {
    return { ok: false, erro: "Usuário criado, mas o e-mail de convite não pôde ser enviado. Use \"Reenviar convite\"." };
  }

  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

export async function alterarRole(
  userId: string,
  novoRole: RoleGerenciavel,
): Promise<{ ok: boolean; erro?: string }> {
  const usuarioAtual = await requireRole("admin");

  if (userId === usuarioAtual.id) {
    return { ok: false, erro: "Você não pode alterar o seu próprio perfil." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role: novoRole }).eq("id", userId);
  if (error) {
    return { ok: false, erro: "Não foi possível alterar o perfil. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

// auth.admin.deleteUser cascateia pra profiles via "on delete cascade" na FK (migration
// 20260731120000_create_profiles.sql) — não precisa de delete separado na tabela.
export async function removerUsuario(userId: string): Promise<{ ok: boolean; erro?: string }> {
  const usuarioAtual = await requireRole("admin");

  if (userId === usuarioAtual.id) {
    return { ok: false, erro: "Você não pode remover o seu próprio usuário." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    return { ok: false, erro: "Não foi possível remover o usuário. Tente novamente." };
  }

  revalidatePath("/admin/configuracoes");
  return { ok: true };
}

export async function reenviarConvite(userId: string): Promise<{ ok: boolean; erro?: string }> {
  await requireRole("admin");

  const admin = createAdminClient();
  const { data: usuarioData, error: erroUsuario } = await admin.auth.admin.getUserById(userId);
  if (erroUsuario || !usuarioData.user?.email) {
    return { ok: false, erro: "Usuário não encontrado." };
  }

  const { data: perfil } = await admin.from("profiles").select("full_name, role").eq("id", userId).maybeSingle();
  const nome = perfil?.full_name ?? "usuário";
  const role: RoleGerenciavel = perfil?.role === "empresa" ? "empresa" : "admin";

  const ok = await enviarLinkDeAcesso(admin, usuarioData.user.email, nome, role);
  if (!ok) {
    return { ok: false, erro: "Não foi possível reenviar o convite. Tente novamente." };
  }

  return { ok: true };
}

// Reaproveita o fluxo de "Esqueci minha senha" (gera link de recovery + envia pelo template
// editável "recuperacao_senha" em /admin/configuracoes/email) — essa action sempre retorna ok
// (nunca revela se o email existe, mesma regra de segurança de solicitarRecuperacaoSenhaAction),
// então não há erro de fato a propagar daqui.
export async function resetarSenha(email: string): Promise<{ ok: boolean }> {
  await requireRole("admin");
  await solicitarRecuperacaoSenhaAction(email);
  return { ok: true };
}
