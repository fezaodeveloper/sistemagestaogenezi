"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CONQUISTA_BUCKET,
  CONQUISTA_GATILHO_VALOR,
  CONQUISTA_GATILHOS,
  LIMITE_DESCRICAO_CONQUISTA,
  LIMITE_EMOJI_CONQUISTA,
  LIMITE_TITULO_CONQUISTA,
} from "@/lib/conquistas/tipos";

type Resultado = { success: true } | { error: string };

const uuid = z.uuid({ error: "Identificador inválido." });

function revalidarTudo() {
  revalidatePath("/admin/configuracoes/portal-aluno/gamificacao");
  revalidatePath("/aluno/conquistas");
  // O menu "Conquistas" da sidebar vive no layout do aluno.
  revalidatePath("/aluno", "layout");
}

// ===== imagem do badge =====

function prefixoPublicoBucket(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/${CONQUISTA_BUCKET}/`;
}

// Só aceita imagem que esteja MESMO no bucket público das conquistas (a URL vai parar num
// <img src>): sem URL externa, sem caracteres que escapariam do atributo.
function urlDeImagemValida(url: string): boolean {
  const prefixo = prefixoPublicoBucket();
  return url.startsWith(prefixo) && url.length > prefixo.length && /^[^\s"'()\\<>]+$/.test(url);
}

// Remove o arquivo do bucket, se estava lá e NENHUMA outra conquista (ex.: uma duplicata) ainda
// usa a mesma imagem. Best-effort: o arquivo órfão é só lixo, nunca deve barrar a ação.
async function removerImagemSeOrfa(url: string | null): Promise<void> {
  try {
    if (!url || !url.startsWith(prefixoPublicoBucket())) return;
    const { count } = await createAdminClient()
      .from("conquistas")
      .select("id", { count: "exact", head: true })
      .eq("badge_url", url);
    if ((count ?? 0) > 0) return;
    await createAdminClient()
      .storage.from(CONQUISTA_BUCKET)
      .remove([url.slice(prefixoPublicoBucket().length)]);
  } catch {
    // Ignora.
  }
}

// ===== configuração =====

export async function salvarConfigConquistas(ativo: boolean): Promise<Resultado> {
  const user = await requireRole("admin");

  if (typeof ativo !== "boolean") return { error: "Dados inválidos." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes")
    .update({ portal_conquistas_ativo: ativo, updated_by: user.id })
    .eq("id", true)
    .select("id");

  if (error || !data?.length) {
    return { error: "Não foi possível salvar. Confira se a migration conquistas_personalizadas foi aplicada." };
  }

  revalidarTudo();
  return { success: true };
}

// ===== CRUD =====

const conquistaSchema = z
  .object({
    id: uuid.optional(),
    titulo: z
      .string()
      .trim()
      .min(1, { error: "Informe o título." })
      .max(LIMITE_TITULO_CONQUISTA, { error: `O título pode ter no máximo ${LIMITE_TITULO_CONQUISTA} caracteres.` }),
    descricao: z
      .string()
      .trim()
      .max(LIMITE_DESCRICAO_CONQUISTA, { error: `A descrição pode ter no máximo ${LIMITE_DESCRICAO_CONQUISTA} caracteres.` }),
    gatilho: z.enum(CONQUISTA_GATILHOS, { error: "Escolha o gatilho." }),
    // Só vale nos gatilhos que pedem valor.
    gatilhoValor: z.number().int().nullable(),
    badgeUrl: z.string().trim().max(2000),
    badgeEmoji: z
      .string()
      .trim()
      .max(LIMITE_EMOJI_CONQUISTA, { error: `O emoji pode ter no máximo ${LIMITE_EMOJI_CONQUISTA} caracteres.` }),
    ativo: z.boolean(),
  })
  .refine(
    (d) => {
      const regra = CONQUISTA_GATILHO_VALOR[d.gatilho];
      if (!regra) return true;
      return d.gatilhoValor !== null && d.gatilhoValor >= regra.min && d.gatilhoValor <= regra.max;
    },
    { error: "Informe um valor válido para o gatilho.", path: ["gatilhoValor"] },
  );

export type DadosConquistaForm = z.input<typeof conquistaSchema>;

export async function salvarConquista(dados: DadosConquistaForm): Promise<Resultado> {
  await requireRole("admin");

  const parsed = conquistaSchema.safeParse(dados);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Mensagem específica do gatilho (a regra dinâmica) quando o campo é o valor.
    if (issue?.path[0] === "gatilhoValor") {
      const regra = CONQUISTA_GATILHO_VALOR[dados.gatilho as keyof typeof CONQUISTA_GATILHO_VALOR];
      if (regra) return { error: `${regra.rotulo}: informe um número entre ${regra.min} e ${regra.max}.` };
    }
    return { error: issue?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;

  if (d.badgeUrl && !urlDeImagemValida(d.badgeUrl)) {
    return { error: "A imagem do badge é inválida. Envie o arquivo pelo botão de upload." };
  }
  if (!d.badgeUrl && !d.badgeEmoji) return { error: "Escolha uma imagem ou um emoji para o badge." };

  const campos = {
    titulo: d.titulo,
    descricao: d.descricao || null,
    gatilho: d.gatilho,
    gatilho_valor: CONQUISTA_GATILHO_VALOR[d.gatilho] ? d.gatilhoValor : null,
    // Imagem tem prioridade sobre o emoji (guarda só um dos dois).
    badge_url: d.badgeUrl || null,
    badge_emoji: d.badgeUrl ? null : d.badgeEmoji || null,
    ativo: d.ativo,
  };

  const supabase = await createClient();

  if (d.id) {
    const { data: anterior } = await supabase.from("conquistas").select("badge_url").eq("id", d.id).maybeSingle();
    if (!anterior) return { error: "Conquista não encontrada." };

    const { error } = await supabase.from("conquistas").update(campos).eq("id", d.id);
    if (error) return { error: "Não foi possível salvar a conquista." };

    // Trocou/removeu a imagem: limpa a antiga.
    if (anterior.badge_url && anterior.badge_url !== campos.badge_url) {
      await removerImagemSeOrfa(anterior.badge_url as string);
    }
  } else {
    const { data: ultima } = await supabase
      .from("conquistas")
      .select("ordem")
      .order("ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("conquistas")
      .insert({ ...campos, ordem: ((ultima?.ordem as number | undefined) ?? 0) + 1 });
    if (error) return { error: "Não foi possível criar a conquista." };
  }

  revalidarTudo();
  return { success: true };
}

// Cópia INATIVA (o admin revisa antes de ligar), no fim da ordem, reaproveitando a mesma
// imagem (por isso a limpeza de arquivo confere se alguém mais ainda a usa).
export async function duplicarConquista(id: string): Promise<Resultado> {
  await requireRole("admin");

  if (!uuid.safeParse(id).success) return { error: "Conquista inválida." };

  const supabase = await createClient();
  const { data: original } = await supabase
    .from("conquistas")
    .select("titulo, descricao, gatilho, gatilho_valor, badge_url, badge_emoji")
    .eq("id", id)
    .maybeSingle();
  if (!original) return { error: "Conquista não encontrada." };

  const sufixo = " (cópia)";
  const titulo = `${(original.titulo as string).slice(0, LIMITE_TITULO_CONQUISTA - sufixo.length)}${sufixo}`;

  const { data: ultima } = await supabase
    .from("conquistas")
    .select("ordem")
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("conquistas").insert({
    titulo,
    descricao: original.descricao,
    gatilho: original.gatilho,
    gatilho_valor: original.gatilho_valor,
    badge_url: original.badge_url,
    badge_emoji: original.badge_emoji,
    ativo: false,
    ordem: ((ultima?.ordem as number | undefined) ?? 0) + 1,
  });
  if (error) return { error: "Não foi possível duplicar a conquista." };

  revalidarTudo();
  return { success: true };
}

// Exclui a conquista E os desbloqueios dos alunos (cascade). Irreversível — a UI confirma.
export async function excluirConquista(id: string): Promise<Resultado> {
  await requireRole("admin");

  if (!uuid.safeParse(id).success) return { error: "Conquista inválida." };

  const supabase = await createClient();
  const { data: existente } = await supabase.from("conquistas").select("badge_url").eq("id", id).maybeSingle();
  if (!existente) return { error: "Conquista não encontrada." };

  const { error } = await supabase.from("conquistas").delete().eq("id", id);
  if (error) return { error: "Não foi possível excluir a conquista." };

  await removerImagemSeOrfa(existente.badge_url as string | null);

  revalidarTudo();
  return { success: true };
}

// Recebe TODOS os ids na nova ordem e grava ordem = posição (1..n).
export async function reordenarConquistas(ids: string[]): Promise<Resultado> {
  await requireRole("admin");

  const parsed = z.array(uuid).min(1).max(500).safeParse(ids);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return { error: "Ordem inválida." };

  const supabase = await createClient();
  const resultados = await Promise.all(
    parsed.data.map((id, indice) => supabase.from("conquistas").update({ ordem: indice + 1 }).eq("id", id)),
  );
  if (resultados.some((r) => r.error)) return { error: "Não foi possível salvar a nova ordem." };

  revalidarTudo();
  return { success: true };
}
