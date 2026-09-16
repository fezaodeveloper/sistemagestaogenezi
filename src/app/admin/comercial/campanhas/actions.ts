"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset } from "@/lib/paginacao";
import { CAMPANHA_BUCKET } from "@/lib/storage/campanhas";
import {
  campanhaFormSchema,
  type CampanhaLink,
  type CampanhaMarketing,
  type CampanhaStatus,
} from "@/lib/campanhas/schema";

export async function getCampanhas(options?: {
  query?: string;
  status?: CampanhaStatus;
  page?: number;
  limit?: number;
}): Promise<{ campanhas: CampanhaMarketing[]; total: number }> {
  await requireRole("admin");

  const pagina = options?.page ?? 1;
  const limite = options?.limit ?? 12;
  const offset = calcularOffset(pagina, limite);

  const supabase = await createClient();
  let query = supabase.from("campanhas_marketing").select("*", { count: "exact" });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  if (options?.query) {
    const termoSeguro = options.query.replace(/[,()]/g, "").trim();
    if (termoSeguro) {
      query = query.ilike("nome", `%${termoSeguro}%`);
    }
  }

  const { data, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);

  return { campanhas: (data as CampanhaMarketing[] | null) ?? [], total: count ?? 0 };
}

export type CampanhaActionResult = { success: true } | { error: string };

function parseCampanhaForm(formData: FormData) {
  let links: unknown = [];
  let tags: unknown = [];
  try {
    links = JSON.parse(String(formData.get("links") ?? "[]"));
  } catch {
    links = [];
  }
  try {
    tags = JSON.parse(String(formData.get("tags") ?? "[]"));
  } catch {
    tags = [];
  }

  return campanhaFormSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao") || undefined,
    como_fazer: formData.get("como_fazer") || undefined,
    status: formData.get("status"),
    data_inicio: formData.get("data_inicio") || undefined,
    data_fim: formData.get("data_fim") || undefined,
    orcamento_trafego: formData.get("orcamento_trafego") || undefined,
    orcamento_impressao: formData.get("orcamento_impressao") || undefined,
    links,
    tags,
    foto_url: formData.get("foto_url") || undefined,
    foto_path: formData.get("foto_path") || undefined,
  });
}

function camposCampanha(dados: {
  nome: string;
  descricao?: string;
  como_fazer?: string;
  status: CampanhaStatus;
  data_inicio?: string;
  data_fim?: string;
  orcamento_trafego?: number;
  orcamento_impressao?: number;
  links?: CampanhaLink[];
  tags?: string[];
  foto_url?: string;
  foto_path?: string;
}) {
  return {
    nome: dados.nome,
    descricao: dados.descricao ?? null,
    como_fazer: dados.como_fazer ?? null,
    status: dados.status,
    data_inicio: dados.data_inicio ?? null,
    data_fim: dados.data_fim ?? null,
    orcamento_trafego: dados.orcamento_trafego ?? null,
    orcamento_impressao: dados.orcamento_impressao ?? null,
    links: dados.links ?? [],
    tags: dados.tags ?? [],
    foto_url: dados.foto_url ?? null,
    foto_path: dados.foto_path ?? null,
  };
}

export async function criarCampanha(formData: FormData): Promise<CampanhaActionResult> {
  await requireRole("admin");

  const parsed = parseCampanhaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("campanhas_marketing").insert(camposCampanha(parsed.data));

  if (error) {
    return { error: "Não foi possível cadastrar a campanha. Tente novamente." };
  }

  revalidatePath("/admin/comercial/campanhas");
  return { success: true };
}

export async function atualizarCampanha(id: string, formData: FormData): Promise<CampanhaActionResult> {
  await requireRole("admin");

  const parsed = parseCampanhaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("campanhas_marketing")
    .update(camposCampanha(parsed.data))
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/comercial/campanhas");
  return { success: true };
}

// Cópia rasa: reaproveita o mesmo arquivo de foto já no Storage (não
// re-envia bytes) — mesmo padrão de duplicarBannerLogin
// (src/app/admin/configuracoes/actions.ts). Se o original for excluído
// depois, a cópia perde a foto junto (mesmo storage_path).
export async function duplicarCampanha(id: string): Promise<CampanhaActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: original } = await supabase
    .from("campanhas_marketing")
    .select("*")
    .eq("id", id)
    .single();

  if (!original) {
    return { error: "Campanha não encontrada." };
  }

  const { error } = await supabase.from("campanhas_marketing").insert({
    nome: `${original.nome} (cópia)`,
    descricao: original.descricao,
    como_fazer: original.como_fazer,
    status: original.status,
    data_inicio: original.data_inicio,
    data_fim: original.data_fim,
    orcamento_trafego: original.orcamento_trafego,
    orcamento_impressao: original.orcamento_impressao,
    links: original.links,
    tags: original.tags,
    foto_url: original.foto_url,
    foto_path: original.foto_path,
  });

  if (error) {
    return { error: "Não foi possível duplicar a campanha. Tente novamente." };
  }

  revalidatePath("/admin/comercial/campanhas");
  return { success: true };
}

// Remove o arquivo do Storage antes de apagar a linha (mesmo padrão de
// deleteBannerLogin em src/app/admin/configuracoes/actions.ts) — evita
// acumular fotos órfãs no bucket a cada exclusão.
export async function excluirCampanha(id: string): Promise<CampanhaActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { data: campanha } = await supabase
    .from("campanhas_marketing")
    .select("foto_path")
    .eq("id", id)
    .single();

  if (campanha?.foto_path) {
    await supabase.storage.from(CAMPANHA_BUCKET).remove([campanha.foto_path]);
  }

  const { error } = await supabase.from("campanhas_marketing").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a campanha. Tente novamente." };
  }

  revalidatePath("/admin/comercial/campanhas");
  return { success: true };
}
