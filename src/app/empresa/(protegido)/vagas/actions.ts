"use server";

import { revalidatePath } from "next/cache";
import { requireEmpresa } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { dispararEvento } from "@/lib/automacoes/motor";
import { getEmpresaPorProfileId, getVagasDaEmpresa } from "@/lib/conecta/empresas";
import { VAGA_MODALIDADE_LABELS, vagaFormSchema, type VagaConecta, type VagaStatus } from "@/lib/conecta/schema";

type VagaActionResult = { success: true } | { error: string };

function parseVagaForm(formData: FormData) {
  return vagaFormSchema.safeParse({
    titulo: formData.get("titulo"),
    descricao: formData.get("descricao"),
    requisitos: formData.get("requisitos") || undefined,
    cidade: formData.get("cidade"),
    estado: formData.get("estado"),
    modalidade: formData.get("modalidade"),
    tipo: formData.get("tipo"),
    salario_min: formData.get("salario_min") || undefined,
    salario_max: formData.get("salario_max") || undefined,
    salario_oculto: formData.get("salario_oculto") === "on",
    carga_horaria: formData.get("carga_horaria") || undefined,
    prazo_candidatura: formData.get("prazo_candidatura") || undefined,
  });
}

export async function getMinhasVagas(): Promise<VagaConecta[]> {
  const user = await requireEmpresa();
  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);
  if (!empresa) return [];
  return getVagasDaEmpresa(supabase, empresa.id);
}

export async function criarVaga(formData: FormData): Promise<VagaActionResult> {
  const user = await requireEmpresa();

  const parsed = parseVagaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados da vaga." };
  }

  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);
  if (!empresa) {
    return { error: "Não foi possível identificar sua empresa." };
  }

  const data = parsed.data;
  const { error } = await supabase.from("vagas_conecta").insert({
    empresa_id: empresa.id,
    titulo: data.titulo,
    descricao: data.descricao,
    requisitos: data.requisitos ?? null,
    cidade: data.cidade,
    estado: data.estado,
    modalidade: data.modalidade,
    tipo: data.tipo,
    salario_min: data.salario_min ?? null,
    salario_max: data.salario_max ?? null,
    salario_oculto: data.salario_oculto,
    carga_horaria: data.carga_horaria ?? null,
    prazo_candidatura: data.prazo_candidatura ?? null,
  });

  if (error) {
    return { error: "Não foi possível publicar a vaga. Tente novamente." };
  }

  // Best-effort — a vaga já foi publicada com sucesso acima.
  try {
    await dispararEvento(
      "conecta.vaga.nova",
      {
        nome_empresa: empresa.nome_empresa,
        titulo: data.titulo,
        cidade: data.cidade,
        estado: data.estado,
        modalidade: VAGA_MODALIDADE_LABELS[data.modalidade],
      },
      `conecta-vaga-nova-${empresa.id}-${Date.now()}`,
    );
  } catch {
    // Best-effort — ver comentário acima.
  }

  revalidatePath("/empresa/vagas");
  return { success: true };
}

export async function atualizarVaga(id: string, formData: FormData): Promise<VagaActionResult> {
  await requireEmpresa();

  const parsed = parseVagaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados da vaga." };
  }

  const data = parsed.data;
  const supabase = await createClient();
  // Sem checagem manual de "essa vaga é da minha empresa" — a policy
  // "Empresa gerencia proprias vagas" (RLS) já escopa o UPDATE.
  const { error } = await supabase
    .from("vagas_conecta")
    .update({
      titulo: data.titulo,
      descricao: data.descricao,
      requisitos: data.requisitos ?? null,
      cidade: data.cidade,
      estado: data.estado,
      modalidade: data.modalidade,
      tipo: data.tipo,
      salario_min: data.salario_min ?? null,
      salario_max: data.salario_max ?? null,
      salario_oculto: data.salario_oculto,
      carga_horaria: data.carga_horaria ?? null,
      prazo_candidatura: data.prazo_candidatura ?? null,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações. Tente novamente." };
  }

  revalidatePath("/empresa/vagas");
  return { success: true };
}

export async function atualizarStatusVaga(id: string, status: VagaStatus): Promise<VagaActionResult> {
  await requireEmpresa();

  const supabase = await createClient();
  const { error } = await supabase.from("vagas_conecta").update({ status }).eq("id", id);

  if (error) {
    return { error: "Não foi possível atualizar o status da vaga. Tente novamente." };
  }

  revalidatePath("/empresa/vagas");
  return { success: true };
}

// Sem checagem manual de "essa vaga é da minha empresa" — a policy "Empresa
// gerencia proprias vagas" (RLS) já escopa o SELECT/INSERT: se a vaga não
// for da empresa autenticada, o select abaixo simplesmente não encontra
// nada e a função retorna erro.
export async function duplicarVaga(vagaId: string): Promise<VagaActionResult> {
  const user = await requireEmpresa();

  const supabase = await createClient();
  const empresa = await getEmpresaPorProfileId(supabase, user.id);
  if (!empresa) {
    return { error: "Não foi possível identificar sua empresa." };
  }

  const { data: original } = await supabase
    .from("vagas_conecta")
    .select(
      "titulo, descricao, requisitos, cidade, estado, modalidade, tipo, salario_min, salario_max, salario_oculto, carga_horaria, prazo_candidatura",
    )
    .eq("id", vagaId)
    .maybeSingle();

  if (!original) {
    return { error: "Vaga não encontrada." };
  }

  const { error } = await supabase.from("vagas_conecta").insert({
    ...original,
    empresa_id: empresa.id,
    titulo: `${original.titulo} (cópia)`,
    status: "ativa",
  });

  if (error) {
    return { error: "Não foi possível duplicar a vaga. Tente novamente." };
  }

  revalidatePath("/empresa/vagas");
  return { success: true };
}

export async function excluirVaga(vagaId: string): Promise<VagaActionResult> {
  await requireEmpresa();

  const supabase = await createClient();
  const { error } = await supabase.from("vagas_conecta").delete().eq("id", vagaId);

  if (error) {
    return { error: "Não foi possível excluir a vaga. Tente novamente." };
  }

  revalidatePath("/empresa/vagas");
  return { success: true };
}
