"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { premioFormSchema } from "@/lib/premios/schema";
import { uploadImagem, validarImagem } from "@/lib/storage/validar-imagem";
import { dispararEvento } from "@/lib/automacoes/motor";

const PREMIOS_BUCKET = "premios";

type PremioFormValuesEcho = {
  nome: string;
  descricao: string;
  custo_creditos: string;
  estoque: string;
  estoque_minimo: string;
  ativo: string;
};

export type PremioFormState =
  | {
      errors?: Partial<
        Record<"nome" | "descricao" | "custo_creditos" | "estoque" | "estoque_minimo" | "foto", string[]>
      >;
      error?: string;
      values?: PremioFormValuesEcho;
    }
  | undefined;

function echoValues(formData: FormData): PremioFormValuesEcho {
  return {
    nome: String(formData.get("nome") ?? ""),
    descricao: String(formData.get("descricao") ?? ""),
    custo_creditos: String(formData.get("custo_creditos") ?? ""),
    estoque: String(formData.get("estoque") ?? ""),
    estoque_minimo: String(formData.get("estoque_minimo") ?? ""),
    ativo: String(formData.get("ativo") ?? ""),
  };
}

function parsePremioForm(formData: FormData) {
  return premioFormSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    custo_creditos: formData.get("custo_creditos"),
    estoque: formData.get("estoque"),
    estoque_minimo: formData.get("estoque_minimo"),
    ativo: formData.get("ativo") === "on",
  });
}

export async function createPremio(
  _prevState: PremioFormState,
  formData: FormData,
): Promise<PremioFormState> {
  await requireRole("admin");

  const parsed = parsePremioForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const { erro: erroFoto, arquivo: arquivoFoto } = validarImagem(formData.get("foto"));
  if (erroFoto) {
    return { errors: { foto: [erroFoto] }, values: echoValues(formData) };
  }

  const supabase = await createClient();

  let fotoPath: string | null = null;
  if (arquivoFoto) {
    const { path, error: uploadError } = await uploadImagem(supabase, PREMIOS_BUCKET, arquivoFoto);
    if (uploadError || !path) {
      return {
        error: "Não foi possível enviar a foto. Tente novamente.",
        values: echoValues(formData),
      };
    }
    fotoPath = path;
  }

  const { error } = await supabase.from("premios").insert({
    nome: parsed.data.nome,
    descricao: parsed.data.descricao ?? null,
    foto_url: fotoPath,
    custo_creditos: parsed.data.custo_creditos,
    estoque: parsed.data.estoque ?? null,
    estoque_minimo: parsed.data.estoque_minimo,
    ativo: parsed.data.ativo,
  });

  if (error) {
    if (fotoPath) await supabase.storage.from(PREMIOS_BUCKET).remove([fotoPath]);
    return {
      error: "Não foi possível criar o prêmio. Tente novamente.",
      values: echoValues(formData),
    };
  }

  revalidatePath("/admin/premios");
  redirect("/admin/premios");
}

export async function updatePremio(
  id: string,
  fotoAtual: string | null,
  _prevState: PremioFormState,
  formData: FormData,
): Promise<PremioFormState> {
  await requireRole("admin");

  const parsed = parsePremioForm(formData);
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors, values: echoValues(formData) };
  }

  const { erro: erroFoto, arquivo: arquivoFoto } = validarImagem(formData.get("foto"));
  if (erroFoto) {
    return { errors: { foto: [erroFoto] }, values: echoValues(formData) };
  }

  const supabase = await createClient();

  let fotoPath = fotoAtual;
  let novoPath: string | null = null;
  if (arquivoFoto) {
    const { path, error: uploadError } = await uploadImagem(supabase, PREMIOS_BUCKET, arquivoFoto);
    if (uploadError || !path) {
      return {
        error: "Não foi possível enviar a foto. Tente novamente.",
        values: echoValues(formData),
      };
    }
    novoPath = path;
    fotoPath = path;
  }

  const { error } = await supabase
    .from("premios")
    .update({
      nome: parsed.data.nome,
      descricao: parsed.data.descricao ?? null,
      foto_url: fotoPath,
      custo_creditos: parsed.data.custo_creditos,
      estoque: parsed.data.estoque ?? null,
      estoque_minimo: parsed.data.estoque_minimo,
      ativo: parsed.data.ativo,
    })
    .eq("id", id);

  if (error) {
    if (novoPath) await supabase.storage.from(PREMIOS_BUCKET).remove([novoPath]);
    return {
      error: "Não foi possível salvar as alterações. Tente novamente.",
      values: echoValues(formData),
    };
  }

  // Só remove a foto antiga depois que a nova já está salva — evita
  // ficar sem foto nenhuma se o remove() falhar no meio do caminho.
  if (novoPath && fotoAtual && fotoAtual !== novoPath) {
    await supabase.storage.from(PREMIOS_BUCKET).remove([fotoAtual]);
  }

  // Notificação imediata (TAREFA 1C) — best-effort via dispararEvento, não
  // deve nunca bloquear o salvamento (já concluído acima). Diferente do
  // resumo diário (que também lista prêmios com estoque baixo, mas 1x/dia),
  // essa é disparada a cada edição que deixa o prêmio nessa condição —
  // por isso a idempotencyKey inclui o timestamp, não deduplica por dia.
  if (
    parsed.data.ativo &&
    parsed.data.estoque !== undefined &&
    parsed.data.estoque <= parsed.data.estoque_minimo
  ) {
    await dispararEvento(
      "premio.estoque_baixo",
      { id, nome: parsed.data.nome, estoque: parsed.data.estoque, estoque_minimo: parsed.data.estoque_minimo },
      `premio-estoque-baixo-${id}-${Date.now()}`,
    );
  }

  revalidatePath("/admin/premios");
  redirect("/admin/premios");
}

export async function deletePremio(id: string, fotoUrl: string | null): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  // resgates.premio_id é "on delete set null" (não restrict) — excluir
  // um prêmio com histórico de resgate não é bloqueado; o nome fica
  // preservado em resgates.item_nome (congelado no momento do resgate).
  const { error } = await supabase.from("premios").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o prêmio." };
  }

  if (fotoUrl) {
    await supabase.storage.from(PREMIOS_BUCKET).remove([fotoUrl]);
  }

  revalidatePath("/admin/premios");
  return {};
}
