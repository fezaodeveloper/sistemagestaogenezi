"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, LIMITE_PADRAO } from "@/lib/paginacao";
import {
  fornecedorFormSchema,
  type Fornecedor,
  type FornecedorCategoria,
} from "@/lib/fornecedores/schema";

export type FornecedorOrderBy = "nome" | "empresa" | "recente";

export async function getFornecedores(options?: {
  query?: string;
  categoria?: FornecedorCategoria;
  orderBy?: FornecedorOrderBy;
  page?: number;
  limit?: number;
}): Promise<{ fornecedores: Fornecedor[]; total: number }> {
  await requireRole("admin");

  const pagina = options?.page ?? 1;
  const limite = options?.limit ?? LIMITE_PADRAO;
  const offset = calcularOffset(pagina, limite);

  const supabase = await createClient();
  let query = supabase.from("fornecedores").select("*", { count: "exact" });

  if (options?.categoria) {
    query = query.eq("categoria", options.categoria);
  }

  if (options?.query) {
    // PostgREST usa vírgula e parênteses como delimitadores da sintaxe do
    // próprio .or() — removidos do termo antes de montar o filtro pra não
    // quebrá-lo (mesmo padrão de buscarAlunosParaWizard em matriculas/actions.ts).
    const termoSeguro = options.query.replace(/[,()]/g, "").trim();
    if (termoSeguro) {
      const termoLike = `%${termoSeguro}%`;
      query = query.or(
        `nome_contato.ilike.${termoLike},nome_empresa.ilike.${termoLike},telefone.ilike.${termoLike}`,
      );
    }
  }

  const orderBy = options?.orderBy ?? "nome";
  if (orderBy === "empresa") {
    query = query.order("nome_empresa", { ascending: true });
  } else if (orderBy === "recente") {
    query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("nome_contato", { ascending: true });
  }

  const { data, count } = await query.range(offset, offset + limite - 1);

  return { fornecedores: (data as Fornecedor[] | null) ?? [], total: count ?? 0 };
}

export type FornecedorActionResult = { success: true } | { error: string };

function parseFornecedorForm(formData: FormData) {
  return fornecedorFormSchema.safeParse({
    nome_contato: formData.get("nome_contato"),
    nome_empresa: formData.get("nome_empresa"),
    categoria: formData.get("categoria"),
    telefone: formData.get("telefone") || undefined,
    email: formData.get("email") || undefined,
    whatsapp: formData.get("whatsapp") || undefined,
    site: formData.get("site") || undefined,
    cep: formData.get("cep") || undefined,
    endereco: formData.get("endereco") || undefined,
    cidade: formData.get("cidade") || undefined,
    estado: formData.get("estado") || undefined,
    observacoes: formData.get("observacoes") || undefined,
    ativo: formData.get("ativo") === "on",
  });
}

export async function criarFornecedor(formData: FormData): Promise<FornecedorActionResult> {
  await requireRole("admin");

  const parsed = parseFornecedorForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert({
    nome_contato: parsed.data.nome_contato,
    nome_empresa: parsed.data.nome_empresa,
    categoria: parsed.data.categoria,
    telefone: parsed.data.telefone ?? null,
    email: parsed.data.email ?? null,
    whatsapp: parsed.data.whatsapp ?? null,
    site: parsed.data.site ?? null,
    cep: parsed.data.cep ?? null,
    endereco: parsed.data.endereco ?? null,
    cidade: parsed.data.cidade ?? null,
    estado: parsed.data.estado ?? null,
    observacoes: parsed.data.observacoes ?? null,
    ativo: parsed.data.ativo,
  });

  if (error) {
    return { error: "Não foi possível cadastrar o fornecedor. Tente novamente." };
  }

  revalidatePath("/admin/fornecedores");
  return { success: true };
}

export async function atualizarFornecedor(
  id: string,
  formData: FormData,
): Promise<FornecedorActionResult> {
  await requireRole("admin");

  const parsed = parseFornecedorForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("fornecedores")
    .update({
      nome_contato: parsed.data.nome_contato,
      nome_empresa: parsed.data.nome_empresa,
      categoria: parsed.data.categoria,
      telefone: parsed.data.telefone ?? null,
      email: parsed.data.email ?? null,
      whatsapp: parsed.data.whatsapp ?? null,
      site: parsed.data.site ?? null,
      cep: parsed.data.cep ?? null,
      endereco: parsed.data.endereco ?? null,
      cidade: parsed.data.cidade ?? null,
      estado: parsed.data.estado ?? null,
      observacoes: parsed.data.observacoes ?? null,
      ativo: parsed.data.ativo,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/admin/fornecedores");
  return { success: true };
}

export async function excluirFornecedor(id: string): Promise<FornecedorActionResult> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").delete().eq("id", id);

  if (error) {
    return { error: "Não foi possível excluir o fornecedor. Tente novamente." };
  }

  revalidatePath("/admin/fornecedores");
  return { success: true };
}

type ViaCepResponse = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export type CepFornecedorResultado =
  | { endereco: string; cidade: string; estado: string }
  | { error: string };

// Mesmo provedor (ViaCEP) usado no formulário de alunos — aqui como Server
// Action porque o formulário de fornecedores é um Dialog (client) que só
// tem acesso a Server Actions, não a rotas de API próprias. fornecedores
// não tem uma coluna de bairro separada (só "endereco" livre), por isso
// logradouro+bairro do ViaCEP são combinados num único campo aqui.
export async function buscarCepFornecedor(cep: string): Promise<CepFornecedorResultado> {
  await requireRole("admin");

  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) {
    return { error: "CEP inválido." };
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = (await response.json()) as ViaCepResponse;

    if (data.erro) {
      return { error: "CEP não encontrado." };
    }

    const endereco = [data.logradouro, data.bairro].filter(Boolean).join(", ");
    return { endereco, cidade: data.localidade ?? "", estado: data.uf ?? "" };
  } catch {
    return { error: "Não foi possível buscar o CEP agora." };
  }
}
