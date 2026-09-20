"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ChaveCriptografiaAusenteError, criptografar } from "@/lib/gateways/crypto";

export type DadosSpedyForm = {
  nome: string;
  // Vazia ao editar = manter a chave salva (ela nunca volta pra tela).
  chaveApi: string;
  ambiente: string;
  ativo: boolean;
  // Vazio = todos os cursos.
  cursosIds: string[];
};

export type SalvarSpedyResultado = { success: true } | { error: string };

const dadosSchema = z.object({
  nome: z.string().trim().min(1, { error: "Informe o nome da integração." }).max(100, { error: "O nome pode ter no máximo 100 caracteres." }),
  chaveApi: z.string().max(2000, { error: "Chave de API longa demais." }),
  ambiente: z.enum(["sandbox", "producao"], { error: "Escolha o ambiente." }),
  ativo: z.boolean(),
  cursosIds: z.array(z.uuid({ error: "Curso inválido." })).max(500),
});

export async function salvarSpedy(id: string | null, dadosBrutos: DadosSpedyForm): Promise<SalvarSpedyResultado> {
  await requireRole("admin");

  if (id !== null && !z.uuid().safeParse(id).success) return { error: "Integração inválida." };

  const parsed = dadosSchema.safeParse(dadosBrutos);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const dados = parsed.data;

  const chaveNova = dados.chaveApi.trim();
  if (id === null && !chaveNova) return { error: "Informe a chave de API da Spedy." };

  const supabase = await createClient();
  const cursos = [...new Set(dados.cursosIds)];

  // Uma nota por pagamento: duas integrações ATIVAS não podem cobrir o mesmo curso
  // (ou ambas "todos os cursos").
  if (dados.ativo) {
    const { data: outras, error: erroLeitura } = await supabase
      .from("spedy_integracoes")
      .select("id, nome, cursos_ids")
      .eq("ativo", true);
    if (erroLeitura) {
      return { error: "Não foi possível ler as integrações. Confira se a migration spedy_integracoes foi aplicada." };
    }
    const conflito = (outras ?? []).find((outra) => {
      if (outra.id === id) return false;
      const dela = (outra.cursos_ids as string[] | null) ?? [];
      if (dela.length === 0 && cursos.length === 0) return true;
      return cursos.some((curso) => dela.includes(curso));
    });
    if (conflito) {
      return {
        error: `A integração "${conflito.nome}" já está ativa para ${cursos.length === 0 ? "todos os cursos" : "algum desses cursos"}. Desative-a ou ajuste os cursos, para não emitir duas notas do mesmo pagamento.`,
      };
    }
  }

  const campos: Record<string, unknown> = {
    nome: dados.nome,
    ambiente: dados.ambiente,
    ativo: dados.ativo,
    cursos_ids: cursos,
  };
  if (chaveNova) {
    try {
      campos.chave_api = criptografar(chaveNova);
    } catch (erro) {
      if (erro instanceof ChaveCriptografiaAusenteError) return { error: erro.message };
      return { error: "Não foi possível proteger a chave de API. Tente novamente." };
    }
  }

  const { error } =
    id === null
      ? await supabase.from("spedy_integracoes").insert(campos)
      : await supabase.from("spedy_integracoes").update(campos).eq("id", id);
  if (error) return { error: "Não foi possível salvar a integração. Confira se a migration spedy_integracoes foi aplicada." };

  revalidar();
  return { success: true };
}

export async function alternarAtivoSpedy(id: string, ativo: boolean): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Integração inválida." };

  const supabase = await createClient();

  if (ativo) {
    // Mesma regra de não duplicar nota ao ativar pela lista.
    const { data: alvo } = await supabase.from("spedy_integracoes").select("cursos_ids").eq("id", id).maybeSingle();
    const cursos = (alvo?.cursos_ids as string[] | null) ?? [];
    const { data: outras } = await supabase.from("spedy_integracoes").select("id, nome, cursos_ids").eq("ativo", true).neq("id", id);
    const conflito = (outras ?? []).find((outra) => {
      const dela = (outra.cursos_ids as string[] | null) ?? [];
      if (dela.length === 0 && cursos.length === 0) return true;
      return cursos.some((curso) => dela.includes(curso));
    });
    if (conflito) return { error: `A integração "${conflito.nome}" já está ativa para os mesmos cursos.` };
  }

  const { error } = await supabase.from("spedy_integracoes").update({ ativo }).eq("id", id);
  if (error) return { error: "Não foi possível alterar a integração." };

  revalidar();
  return {};
}

// Notas já emitidas continuam existindo na Spedy; só a integração (e a chave) saem daqui.
export async function excluirSpedy(id: string): Promise<{ error?: string }> {
  await requireRole("admin");
  if (!z.uuid().safeParse(id).success) return { error: "Integração inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("spedy_integracoes").delete().eq("id", id).select("id");
  if (error || !data?.length) return { error: "Não foi possível excluir a integração." };

  revalidar();
  return {};
}

function revalidar() {
  revalidatePath("/admin/configuracoes/apps/spedy");
  revalidatePath("/admin/configuracoes/apps");
  revalidatePath("/admin/financeiro");
}
