"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  criarConversa,
  editarMensagem as editarMensagemChat,
  enviarMensagem,
  excluirMensagem as excluirMensagemChat,
  marcarComoLidas,
  getConversaPorAluno,
} from "@/lib/chat/chat";
import { mensagemComArquivoFormSchema, mensagemFormSchema, type ArquivoAnexo } from "@/lib/chat/schema";

// Abre a conversa existente do aluno, ou cria na hora se ainda não
// houver uma — o Select de "nova conversa" na listagem e o atalho do
// painel do professor levam pro mesmo lugar (/admin/chat/[alunoId]),
// então esse ponto de entrada precisa lidar com os dois casos.
export async function iniciarOuAbrirConversaAdmin(alunoId: string): Promise<{ error?: string }> {
  await requireRole("admin");
  const supabase = await createClient();

  const existente = await getConversaPorAluno(supabase, alunoId);
  if (!existente) {
    const result = await criarConversa(supabase, alunoId);
    if ("error" in result) return result;
    revalidatePath("/admin/chat");
  }

  redirect(`/admin/chat/${alunoId}`);
}

export async function enviarMensagemAdmin(
  conversaId: string,
  texto: string,
  arquivo?: ArquivoAnexo,
): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  // Mensagem com anexo pode ter legenda vazia (mensagemComArquivoFormSchema
  // não exige mínimo) — sem anexo, continua exigindo texto (comportamento
  // inalterado).
  const schema = arquivo ? mensagemComArquivoFormSchema : mensagemFormSchema;
  const parsed = schema.safeParse({ texto });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  const supabase = await createClient();
  return enviarMensagem(supabase, conversaId, user.id, parsed.data.texto, arquivo);
}

export async function marcarConversaLidaAdmin(conversaId: string): Promise<void> {
  await requireRole("admin");
  const supabase = await createClient();
  await marcarComoLidas(supabase, conversaId);
  revalidatePath("/admin/chat");
}

export async function editarMensagem(
  mensagemId: string,
  novoConteudo: string,
): Promise<{ error?: string }> {
  const user = await requireRole("admin");

  const parsed = mensagemFormSchema.safeParse({ texto: novoConteudo });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mensagem inválida." };
  }

  const supabase = await createClient();
  return editarMensagemChat(supabase, mensagemId, user.id, parsed.data.texto);
}

export async function excluirMensagem(mensagemId: string): Promise<{ error?: string }> {
  const user = await requireRole("admin");
  const supabase = await createClient();
  return excluirMensagemChat(supabase, mensagemId, user.id);
}

// Best-effort por aluno (TAREFA 2C): continua mesmo se algum envio
// falhar (matrícula que virou inativa entre a lista carregada e o clique,
// erro de rede pontual) — o admin recebe a contagem final de
// sucessos/falhas, não uma falha total por causa de um único aluno.
export async function enviarMensagemEmMassa(
  alunoIds: string[],
  mensagem: string,
): Promise<{ enviadas: number; falhas: number }> {
  const user = await requireRole("admin");

  const parsed = mensagemFormSchema.safeParse({ texto: mensagem });
  if (!parsed.success) {
    return { enviadas: 0, falhas: alunoIds.length };
  }

  const supabase = await createClient();
  let enviadas = 0;
  let falhas = 0;

  for (const alunoId of alunoIds) {
    try {
      const existente = await getConversaPorAluno(supabase, alunoId);
      let conversaId = existente?.id;
      if (!conversaId) {
        const result = await criarConversa(supabase, alunoId);
        if ("error" in result) {
          falhas++;
          continue;
        }
        conversaId = result.id;
      }

      const envio = await enviarMensagem(supabase, conversaId, user.id, parsed.data.texto);
      if (envio.error) {
        falhas++;
      } else {
        enviadas++;
      }
    } catch {
      falhas++;
    }
  }

  revalidatePath("/admin/chat");
  return { enviadas, falhas };
}
