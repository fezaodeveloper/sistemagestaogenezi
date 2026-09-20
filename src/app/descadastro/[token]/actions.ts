"use server";

import { redirect } from "next/navigation";
import { lerTokenDescadastro, reativarEmail } from "@/lib/email/descadastro";
import { createAdminClient } from "@/lib/supabase/admin";

// Ações da página PÚBLICA de descadastro. Sem requireRole de propósito — quem chega é um
// destinatário do e-mail, sem conta. A autorização é o próprio token (o e-mail
// criptografado e autenticado): sem ele não dá pra agir sobre nenhum endereço.

const MOTIVO_MAXIMO = 500;

export async function informarMotivo(token: string, formData: FormData): Promise<void> {
  const email = lerTokenDescadastro(token);
  if (email) {
    const motivo = String(formData.get("motivo") ?? "").trim().slice(0, MOTIVO_MAXIMO);
    if (motivo) {
      await createAdminClient().from("email_descadastros").update({ motivo }).eq("email", email);
    }
  }
  redirect(`/descadastro/${token}?estado=motivo`);
}

// "Foi engano": volta a receber. O redirecionamento leva ?estado=reinscrito — sem isso a
// própria página (que descadastra ao ser aberta) descadastraria de novo.
export async function reinscrever(token: string): Promise<void> {
  const email = lerTokenDescadastro(token);
  if (email) await reativarEmail(email);
  redirect(`/descadastro/${token}?estado=reinscrito`);
}
