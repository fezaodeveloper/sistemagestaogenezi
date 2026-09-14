"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { VagaAdminConecta, VagasAdminFiltro, VagasAdminResultado } from "@/lib/conecta/schema";

const LIMITE_PADRAO = 20;

type VagaRow = {
  id: string;
  titulo: string;
  descricao: string;
  requisitos: string | null;
  cidade: string;
  estado: string;
  modalidade: VagaAdminConecta["modalidade"];
  tipo: VagaAdminConecta["tipo"];
  status: VagaAdminConecta["status"];
  salario_min: number | null;
  salario_max: number | null;
  salario_oculto: boolean;
  carga_horaria: string | null;
  created_at: string;
  empresas_conecta: { nome_empresa: string } | null;
};

// Filtro por status/tipo/modalidade vai direto na query (mesma tabela);
// busca por título OU empresa é aplicada em JS depois de buscar tudo que já
// bate com os filtros de coluna — mesmo padrão (e mesmo motivo) de
// buscarVagasConecta: filtrar por uma coluna de tabela EMBUTIDA
// (empresas_conecta.nome_empresa) misturado com filtro de texto na tabela
// principal é um ponto frágil conhecido do supabase-js/PostgREST neste
// projeto. Paginação também em JS, sobre a lista já filtrada.
export async function getVagasAdminConecta(filtro: VagasAdminFiltro = {}): Promise<VagasAdminResultado> {
  await requireRole("admin");

  const page = filtro.page && filtro.page > 0 ? filtro.page : 1;
  const limit = filtro.limit && filtro.limit > 0 ? filtro.limit : LIMITE_PADRAO;

  const supabase = await createClient();
  let query = supabase
    .from("vagas_conecta")
    .select(
      "id, titulo, descricao, requisitos, cidade, estado, modalidade, tipo, status, salario_min, salario_max, salario_oculto, carga_horaria, created_at, empresas_conecta(nome_empresa)",
    );

  if (filtro.status) query = query.eq("status", filtro.status);
  if (filtro.tipo) query = query.eq("tipo", filtro.tipo);
  if (filtro.modalidade) query = query.eq("modalidade", filtro.modalidade);

  const { data } = await query.order("created_at", { ascending: false });

  const todas: VagaAdminConecta[] = ((data as unknown as VagaRow[] | null) ?? []).map((vaga) => ({
    id: vaga.id,
    titulo: vaga.titulo,
    descricao: vaga.descricao,
    requisitos: vaga.requisitos,
    cidade: vaga.cidade,
    estado: vaga.estado,
    modalidade: vaga.modalidade,
    tipo: vaga.tipo,
    status: vaga.status,
    salario_min: vaga.salario_min,
    salario_max: vaga.salario_max,
    salario_oculto: vaga.salario_oculto,
    carga_horaria: vaga.carga_horaria,
    created_at: vaga.created_at,
    empresaNome: vaga.empresas_conecta?.nome_empresa ?? "—",
  }));

  const termo = filtro.query?.trim().toLowerCase();
  const filtradas = termo
    ? todas.filter(
        (vaga) => vaga.titulo.toLowerCase().includes(termo) || vaga.empresaNome.toLowerCase().includes(termo),
      )
    : todas;

  const total = filtradas.length;
  const offset = (page - 1) * limit;

  return { vagas: filtradas.slice(offset, offset + limit), total };
}

// Grant/policy de UPDATE em vagas_conecta já libera "authenticated" +
// "Admins gerenciam vagas" (FOR ALL via is_admin()) — sem checagem manual de
// dono, mesmo padrão de atualizarStatusVaga no portal da empresa.
export async function encerrarVagaAdmin(id: string): Promise<{ error?: string }> {
  await requireRole("admin");

  const supabase = await createClient();
  const { error } = await supabase.from("vagas_conecta").update({ status: "encerrada" }).eq("id", id);

  if (error) {
    return { error: "Não foi possível encerrar a vaga. Tente novamente." };
  }

  revalidatePath("/admin/conecta/vagas");
  return {};
}
