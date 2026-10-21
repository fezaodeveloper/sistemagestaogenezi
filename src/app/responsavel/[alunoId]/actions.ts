"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { onlyDigits } from "@/lib/alunos/schema";

// Portal do Responsável — acesso SEM login. alunoId na URL funciona como bearer token
// implícito (mesmo modelo de risco já aceito nos itens 6/7: contrato e termo de imagem por
// CPF), e a identidade de quem acessa é validada por CPF contra responsaveis.cpf. Sempre via
// createAdminClient() — não há sessão nenhuma neste fluxo.

export async function validarCpfResponsavel(
  alunoId: string,
  cpfDigitado: string,
): Promise<{ valido: true; nomeResponsavel: string } | { valido: false; erro: string }> {
  const admin = createAdminClient();

  const { data: responsaveis } = await admin.from("responsaveis").select("nome, cpf").eq("aluno_id", alunoId);

  if (!responsaveis || responsaveis.length === 0) {
    return { valido: false, erro: "Nenhum responsável cadastrado para este aluno." };
  }

  const cpfNormalizado = onlyDigits(cpfDigitado);
  const encontrado = responsaveis.find((r) => onlyDigits(r.cpf) === cpfNormalizado);

  if (!encontrado) {
    return { valido: false, erro: "CPF não confere com nenhum responsável cadastrado." };
  }

  return { valido: true, nomeResponsavel: encontrado.nome };
}

export type DadosPortalParcela = {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  asaas_invoice_url: string | null;
  asaas_bank_slip_url: string | null;
};

export type DadosPortalMatricula = {
  id: string;
  status: string;
  data_matricula: string;
  nomeCurso: string;
  nomeTurma: string;
  // null = nenhum contrato gerado ainda pra esta matrícula (não confundir com "pendente", que é
  // um status real de contratos_assinados.status).
  statusContrato: string | null;
  termoImagemAssinado: boolean;
  parcelas: DadosPortalParcela[];
};

export type DadosPortal = {
  aluno: { full_name: string | null; status_aluno: string | null };
  matriculas: DadosPortalMatricula[];
};

type LinhaMatricula = {
  id: string;
  status: string;
  data_matricula: string;
  turmas: { nome: string; cursos: { nome: string } | null } | null;
};

// IMPORTANTE: esta function NÃO re-valida CPF — a autenticação acontece uma única vez em
// validarCpfResponsavel(), chamada pelo componente client ANTES de este ser chamado. Mesmo
// modelo de segurança (bearer token implícito via UUID) já aceito nas rotas públicas de PDF
// (/api/contratos/[matriculaId]/pdf, /api/comprovantes/parcela/[parcelaId]/pdf) — não é um gap
// novo introduzido aqui.
export async function getDadosPortalResponsavel(alunoId: string): Promise<DadosPortal | null> {
  const admin = createAdminClient();

  const { data: aluno } = await admin.from("alunos").select("full_name, status_aluno").eq("id", alunoId).maybeSingle();
  if (!aluno) return null;

  // Só matrículas ATIVAS (seção "Matrículas Ativas" do portal) — concluídas/canceladas/
  // transferidas não aparecem aqui.
  const { data: matriculasData } = await admin
    .from("matriculas")
    .select("id, status, data_matricula, turmas(nome, cursos(nome))")
    .eq("aluno_id", alunoId)
    .eq("status", "ativa")
    .order("created_at", { ascending: false });

  const matriculasBrutas = (matriculasData ?? []) as unknown as LinhaMatricula[];

  const matriculas: DadosPortalMatricula[] = await Promise.all(
    matriculasBrutas.map(async (matricula) => {
      const [{ data: parcelasData }, { data: contrato }, { data: termoImagem }] = await Promise.all([
        admin
          .from("parcelas")
          .select("id, numero_parcela, valor, data_vencimento, data_pagamento, status, asaas_invoice_url, asaas_bank_slip_url")
          .eq("matricula_id", matricula.id)
          .order("numero_parcela"),
        admin.from("contratos_assinados").select("status").eq("matricula_id", matricula.id).maybeSingle(),
        admin.from("termos_imagem_assinados").select("id").eq("matricula_id", matricula.id).maybeSingle(),
      ]);

      return {
        id: matricula.id,
        status: matricula.status,
        data_matricula: matricula.data_matricula,
        nomeCurso: matricula.turmas?.cursos?.nome ?? "—",
        nomeTurma: matricula.turmas?.nome ?? "—",
        statusContrato: contrato?.status ?? null,
        termoImagemAssinado: !!termoImagem,
        parcelas: (parcelasData ?? []) as DadosPortalParcela[],
      };
    }),
  );

  return {
    aluno: { full_name: aluno.full_name, status_aluno: aluno.status_aluno },
    matriculas,
  };
}
