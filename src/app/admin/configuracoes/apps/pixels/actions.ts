"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PIXEL_TIPOS, validarScriptPixel } from "@/lib/pixels/tipos";

export type DadosPixelForm = {
  nome: string;
  tipo: string;
  script: string;
  ativo: boolean;
  // Vazio = todas as páginas públicas.
  cursosIds: string[];
};

export type SalvarPixelResultado = { success: true } | { error: string };

const dadosSchema = z.object({
  nome: z.string().trim().min(1, { error: "Informe o nome do pixel." }).max(100, { error: "O nome pode ter no máximo 100 caracteres." }),
  tipo: z.enum(PIXEL_TIPOS, { error: "Escolha o tipo do pixel." }),
  script: z.string(),
  ativo: z.boolean(),
  cursosIds: z.array(z.uuid({ error: "Curso inválido." })).max(500),
});

export async function salvarPixel(id: string | null, dadosBrutos: DadosPixelForm): Promise<SalvarPixelResultado> {
  await requireRole("admin");

  if (id !== null && !z.uuid().safeParse(id).success) return { error: "Pixel inválido." };

  const parsed = dadosSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const script = validarScriptPixel(dados.tipo, dados.script);
  if (!script.ok) return { error: script.erro };

  const campos = {
    nome: dados.nome,
    tipo: dados.tipo,
    script: dados.script.trim(),
    ativo: dados.ativo,
    cursos_ids: [...new Set(dados.cursosIds)],
  };

  const supabase = await createClient();
  const { error } =
    id === null
      ? await supabase.from("pixels_config").insert(campos)
      : await supabase.from("pixels_config").update(campos).eq("id", id);
  if (error) return { error: "Não foi possível salvar o pixel. Confira se a migration pixels_config foi aplicada." };

  revalidar();
  return { success: true };
}

export async function alternarAtivoPixel(id: string, ativo: boolean): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Pixel inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("pixels_config").update({ ativo }).eq("id", id);
  if (error) return { error: "Não foi possível alterar o pixel." };

  revalidar();
  return {};
}

export async function excluirPixel(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Pixel inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("pixels_config").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Não foi possível excluir o pixel." };

  revalidar();
  return {};
}

function revalidar() {
  revalidatePath("/admin/configuracoes/apps/pixels");
  revalidatePath("/admin/configuracoes/apps");
}
