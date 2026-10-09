"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/dal";
import { loginHome } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export type NovaSenhaState = { error?: string } | undefined;

const schema = z
  .object({
    senha: z.string().min(6, "A senha precisa ter pelo menos 6 caracteres."),
    confirmarSenha: z.string(),
  })
  .refine((dados) => dados.senha === dados.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export async function atualizarNovaSenha(
  _prevState: NovaSenhaState,
  formData: FormData,
): Promise<NovaSenhaState> {
  const parsed = schema.safeParse({
    senha: formData.get("senha"),
    confirmarSenha: formData.get("confirmarSenha"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // A sessão de recovery é estabelecida no CLIENT (NovaSenhaForm, a partir do #access_token que
  // o Supabase devolve na URL — nunca chega ao servidor, navegador não envia fragmento em
  // requisição nenhuma) e persistida via cookie pelo createBrowserClient (@supabase/ssr
  // compartilha o mesmo storage entre client e server). Por isso dá pra confiar nela aqui,
  // mesmo essa action nunca tendo visto o token em si.
  const profile = await getCurrentProfile();
  if (!profile) {
    return { error: "Sessão de recuperação expirada. Peça um novo link em \"Esqueci minha senha\"." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.senha });
  if (error) {
    return { error: "Não foi possível salvar a nova senha. Tente novamente." };
  }

  // Encerra a sessão de recovery ANTES de redirecionar — senão o proxy (src/proxy.ts) reconhece
  // a pessoa como já logada ao chegar em /login ou /entrar e manda direto pra área dela, sem
  // nunca mostrar a mensagem de sucesso abaixo.
  await supabase.auth.signOut();
  redirect(`${loginHome(profile.role)}?mensagem=senha-alterada`);
}
