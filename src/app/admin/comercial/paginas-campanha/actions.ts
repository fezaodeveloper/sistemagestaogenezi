"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, LIMITE_PADRAO } from "@/lib/paginacao";
import {
  getCampanhaPagina as getCampanhaPaginaLib,
  getCampanhaPaginas as getCampanhaPaginasLib,
  getCampanhaRespostas as getCampanhaRespostasLib,
  type CampanhaPaginaComContagem,
} from "@/lib/campanha-paginas/campanha-paginas";
import { campanhaPaginaFormSchema, type CampanhaPagina, type CampanhaResposta } from "@/lib/campanha-paginas/schema";

export type CampanhaPaginasResultado = {
  itens: CampanhaPaginaComContagem[];
  total: number;
  totalPaginas: number;
};

export async function getCampanhaPaginas(
  query: string,
  status: string,
  page: number,
): Promise<CampanhaPaginasResultado> {
  await requireRole("admin");
  const supabase = await createClient();
  const offset = calcularOffset(page, LIMITE_PADRAO);
  const { itens, total } = await getCampanhaPaginasLib(supabase, {
    query: query || undefined,
    status: status || undefined,
    offset,
    limite: LIMITE_PADRAO,
  });
  return { itens, total, totalPaginas: calcularTotalPaginas(total, LIMITE_PADRAO) };
}

export async function getCampanhaPagina(id: string): Promise<CampanhaPagina | null> {
  await requireRole("admin");
  const supabase = await createClient();
  return getCampanhaPaginaLib(supabase, id);
}

function parseCampanhaPaginaForm(formData: FormData) {
  const etapasRaw = formData.get("etapas");
  const cardsRaw = formData.get("cards_destaque");
  const tipografiaRaw = formData.get("tipografia");

  return campanhaPaginaFormSchema.safeParse({
    titulo: formData.get("titulo"),
    slug: formData.get("slug"),
    subtitulo: formData.get("subtitulo") || undefined,
    descricao: formData.get("descricao") || undefined,
    curso_id: formData.get("curso_id") || undefined,
    cor_primaria: formData.get("cor_primaria"),
    cor_fundo: formData.get("cor_fundo"),
    cor_fonte: formData.get("cor_fonte"),
    logo_url: formData.get("logo_url") || undefined,
    imagem_topo_url: formData.get("imagem_topo_url") || undefined,
    tema: formData.get("tema"),
    status: formData.get("status"),
    data_inicio: formData.get("data_inicio") || undefined,
    data_fim: formData.get("data_fim") || undefined,
    vagas_limite: formData.get("vagas_limite") || undefined,
    mostrar_contador: formData.get("mostrar_contador") === "true",
    contador_data_fim: formData.get("contador_data_fim") || undefined,
    coletar_email: formData.get("coletar_email") === "true",
    coletar_cidade: formData.get("coletar_cidade") === "true",
    cards_destaque: cardsRaw ? JSON.parse(String(cardsRaw)) : [],
    tipografia: tipografiaRaw ? JSON.parse(String(tipografiaRaw)) : undefined,
    etapas: etapasRaw ? JSON.parse(String(etapasRaw)) : [],
    mostrar_lgpd: formData.get("mostrar_lgpd") === "true",
    texto_lgpd: formData.get("texto_lgpd") || undefined,
    mostrar_declaracao: formData.get("mostrar_declaracao") === "true",
    texto_declaracao: formData.get("texto_declaracao") || undefined,
    titulo_sucesso: formData.get("titulo_sucesso"),
    mensagem_sucesso: formData.get("mensagem_sucesso") || undefined,
    notificar_telegram: formData.get("notificar_telegram") === "true",
  });
}

export async function criarCampanhaPagina(formData: FormData): Promise<{ error?: string; id?: string }> {
  const user = await requireRole("admin");

  const parsed = parseCampanhaPaginaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campanha_paginas")
    .insert({
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      subtitulo: parsed.data.subtitulo ?? null,
      descricao: parsed.data.descricao ?? null,
      curso_id: parsed.data.curso_id ?? null,
      cor_primaria: parsed.data.cor_primaria,
      cor_fundo: parsed.data.cor_fundo,
      cor_fonte: parsed.data.cor_fonte,
      logo_url: parsed.data.logo_url ?? null,
      imagem_topo_url: parsed.data.imagem_topo_url ?? null,
      tema: parsed.data.tema,
      status: parsed.data.status,
      data_inicio: parsed.data.data_inicio ?? null,
      data_fim: parsed.data.data_fim ?? null,
      vagas_limite: parsed.data.vagas_limite ?? null,
      mostrar_contador: parsed.data.mostrar_contador,
      contador_data_fim: parsed.data.contador_data_fim ?? null,
      coletar_email: parsed.data.coletar_email,
      coletar_cidade: parsed.data.coletar_cidade,
      cards_destaque: parsed.data.cards_destaque,
      tipografia: parsed.data.tipografia,
      etapas: parsed.data.etapas,
      mostrar_lgpd: parsed.data.mostrar_lgpd,
      texto_lgpd: parsed.data.texto_lgpd ?? null,
      mostrar_declaracao: parsed.data.mostrar_declaracao,
      texto_declaracao: parsed.data.texto_declaracao ?? null,
      titulo_sucesso: parsed.data.titulo_sucesso,
      mensagem_sucesso: parsed.data.mensagem_sucesso ?? null,
      notificar_telegram: parsed.data.notificar_telegram,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "Já existe uma página com esse slug." };
    }
    console.error("[CAMPANHA] Erro ao criar página:", error);
    return { error: `Erro: ${error?.code} — ${error?.message}` };
  }

  revalidatePath("/admin/comercial/paginas-campanha");
  return { id: data.id };
}

export async function atualizarCampanhaPagina(id: string, formData: FormData): Promise<{ error?: string; id?: string }> {
  await requireRole("admin");

  const parsed = parseCampanhaPaginaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("campanha_paginas")
    .update({
      titulo: parsed.data.titulo,
      slug: parsed.data.slug,
      subtitulo: parsed.data.subtitulo ?? null,
      descricao: parsed.data.descricao ?? null,
      curso_id: parsed.data.curso_id ?? null,
      cor_primaria: parsed.data.cor_primaria,
      cor_fundo: parsed.data.cor_fundo,
      cor_fonte: parsed.data.cor_fonte,
      logo_url: parsed.data.logo_url ?? null,
      imagem_topo_url: parsed.data.imagem_topo_url ?? null,
      tema: parsed.data.tema,
      status: parsed.data.status,
      data_inicio: parsed.data.data_inicio ?? null,
      data_fim: parsed.data.data_fim ?? null,
      vagas_limite: parsed.data.vagas_limite ?? null,
      mostrar_contador: parsed.data.mostrar_contador,
      contador_data_fim: parsed.data.contador_data_fim ?? null,
      coletar_email: parsed.data.coletar_email,
      coletar_cidade: parsed.data.coletar_cidade,
      cards_destaque: parsed.data.cards_destaque,
      tipografia: parsed.data.tipografia,
      etapas: parsed.data.etapas,
      mostrar_lgpd: parsed.data.mostrar_lgpd,
      texto_lgpd: parsed.data.texto_lgpd ?? null,
      mostrar_declaracao: parsed.data.mostrar_declaracao,
      texto_declaracao: parsed.data.texto_declaracao ?? null,
      titulo_sucesso: parsed.data.titulo_sucesso,
      mensagem_sucesso: parsed.data.mensagem_sucesso ?? null,
      notificar_telegram: parsed.data.notificar_telegram,
    })
    .eq("id", id);

  if (error) {
    const mensagem = error.code === "23505" ? "Já existe uma página com esse slug." : "Não foi possível salvar as alterações. Tente novamente.";
    return { error: mensagem };
  }

  revalidatePath("/admin/comercial/paginas-campanha");
  revalidatePath(`/admin/comercial/paginas-campanha/${id}`);
  return { id };
}

export async function duplicarCampanhaPagina(id: string): Promise<{ error?: string; id?: string }> {
  const user = await requireRole("admin");

  const supabase = await createClient();
  const { data: original } = await supabase.from("campanha_paginas").select("*").eq("id", id).single();
  if (!original) {
    return { error: "Página não encontrada." };
  }

  const slugCopia = `${original.slug}-copia-${Date.now().toString(36)}`;

  const { data, error } = await supabase
    .from("campanha_paginas")
    .insert({
      titulo: `${original.titulo} (cópia)`,
      slug: slugCopia,
      subtitulo: original.subtitulo,
      descricao: original.descricao,
      curso_id: original.curso_id,
      cor_primaria: original.cor_primaria,
      cor_fundo: original.cor_fundo,
      cor_fonte: original.cor_fonte,
      logo_url: original.logo_url,
      imagem_topo_url: original.imagem_topo_url,
      tema: original.tema,
      status: "inativa",
      data_inicio: original.data_inicio,
      data_fim: original.data_fim,
      vagas_limite: original.vagas_limite,
      mostrar_contador: original.mostrar_contador,
      contador_data_fim: original.contador_data_fim,
      coletar_email: original.coletar_email,
      coletar_cidade: original.coletar_cidade,
      cards_destaque: original.cards_destaque,
      tipografia: original.tipografia ?? {},
      etapas: original.etapas,
      mostrar_lgpd: original.mostrar_lgpd,
      texto_lgpd: original.texto_lgpd,
      mostrar_declaracao: original.mostrar_declaracao,
      texto_declaracao: original.texto_declaracao,
      titulo_sucesso: original.titulo_sucesso,
      mensagem_sucesso: original.mensagem_sucesso,
      notificar_telegram: original.notificar_telegram,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Não foi possível duplicar a página. Tente novamente." };
  }

  revalidatePath("/admin/comercial/paginas-campanha");
  return { id: data.id };
}

export async function excluirCampanhaPagina(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("campanha_paginas").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir a página. Tente novamente." };
  }

  revalidatePath("/admin/comercial/paginas-campanha");
  return {};
}

export async function alternarStatusCampanhaPagina(id: string, ativa: boolean): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase
    .from("campanha_paginas")
    .update({ status: ativa ? "ativa" : "inativa" })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível alterar o status." };
  }

  revalidatePath("/admin/comercial/paginas-campanha");
  return {};
}

export type CampanhaRespostasResultado = { itens: CampanhaResposta[]; total: number; totalPaginas: number };

export async function getCampanhaRespostas(
  paginaId: string,
  page: number,
  data?: string,
): Promise<CampanhaRespostasResultado> {
  await requireRole("admin");
  const supabase = await createClient();
  const offset = calcularOffset(page, LIMITE_PADRAO);
  const { itens, total } = await getCampanhaRespostasLib(supabase, paginaId, { data, offset, limite: LIMITE_PADRAO });
  return { itens, total, totalPaginas: calcularTotalPaginas(total, LIMITE_PADRAO) };
}
