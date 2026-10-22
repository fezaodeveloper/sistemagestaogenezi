"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { onlyDigits } from "@/lib/alunos/schema";

// Portal do Responsável — acesso SEM login, SEM id de aluno na URL: o responsável entra só com
// o próprio CPF (/responsavel), e o sistema acha TODOS os alunos vinculados automaticamente via
// responsaveis.cpf (um responsável pode ter várias linhas em `responsaveis`, uma por aluno —
// é assim que o vínculo suporta múltiplos filhos, ver TAREFA/PERGUNTA 1). Sempre via
// createAdminClient() — não há sessão nenhuma neste fluxo.
//
// Substitui a rota antiga /responsavel/[alunoId] (mantida só como redirect, ver
// src/app/responsavel/[alunoId]/page.tsx) — este arquivo reúne a lógica que vivia em
// src/app/responsavel/[alunoId]/actions.ts (removido).

export type FilhoResponsavel = { alunoId: string; nomeAluno: string | null; fotoUrl: string | null };

export type ValidarCpfResponsavelResult = { nomeResponsavel: string; filhos: FilhoResponsavel[] } | { error: string };

export async function validarCpfResponsavelGlobal(cpfDigitado: string): Promise<ValidarCpfResponsavelResult> {
  const admin = createAdminClient();

  // Compara CPF normalizando em JS (onlyDigits de ambos os lados), não por igualdade direta no
  // SQL — mesmo critério já usado em todo o resto do projeto pra esse tipo de comparação (ver
  // assinarContratoPorCpf, assinarTermoImagemPorCpf): o valor salvo em responsaveis.cpf não tem
  // garantia de estar sempre só em dígitos puros (máscara aplicada só no formulário, não no
  // banco), então um `.eq("cpf", onlyDigits(cpfDigitado))` arriscaria não bater com uma linha
  // salva com pontuação.
  const { data: responsaveis } = await admin.from("responsaveis").select("aluno_id, nome, cpf");

  const cpfNormalizado = onlyDigits(cpfDigitado);
  // filter (não find): o mesmo CPF pode aparecer em mais de uma linha de `responsaveis`, uma por
  // filho — é o único jeito de ter múltiplos filhos com o modelo de dados atual (sem tabela pivot
  // própria, sem migration pedida pela tarefa).
  const encontrados = (responsaveis ?? []).filter((r) => onlyDigits(r.cpf) === cpfNormalizado);

  if (encontrados.length === 0) {
    return { error: "CPF não encontrado como responsável." };
  }

  const alunoIds = Array.from(new Set(encontrados.map((r) => r.aluno_id)));
  const { data: alunosData } = await admin.from("alunos").select("id, full_name, foto_url").in("id", alunoIds);
  const alunosPorId = new Map((alunosData ?? []).map((a) => [a.id, a]));

  const filhos: FilhoResponsavel[] = alunoIds.map((alunoId) => {
    const aluno = alunosPorId.get(alunoId);
    return { alunoId, nomeAluno: aluno?.full_name ?? null, fotoUrl: aluno?.foto_url ?? null };
  });
  filhos.sort((a, b) => (a.nomeAluno ?? "").localeCompare(b.nomeAluno ?? ""));

  return { nomeResponsavel: encontrados[0].nome, filhos };
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

export type DadosPortalProgresso = { total: number; concluidas: number };
export type DadosPortalFrequencia = { totalAulas: number; presentes: number };

export type DadosPortalMatricula = {
  id: string;
  status: string;
  data_matricula: string;
  nomeCurso: string;
  nomeTurma: string;
  progresso: DadosPortalProgresso;
  frequencia: DadosPortalFrequencia;
  // null = nenhum contrato gerado ainda pra esta matrícula (não confundir com "pendente", que é
  // um status real de contratos_assinados.status).
  statusContrato: string | null;
  contratoAssinadoEm: string | null;
  termoImagemAssinado: boolean;
  termoImagemAssinadoEm: string | null;
  parcelas: DadosPortalParcela[];
};

export type DadosPortal = {
  aluno: { full_name: string | null; status_aluno: string | null; fotoUrl: string | null };
  matriculas: DadosPortalMatricula[];
  escola: { nome: string | null; logoUrl: string | null; telefone: string | null; email: string | null };
};

type LinhaMatricula = {
  id: string;
  status: string;
  data_matricula: string;
  turmas: { nome: string; cursos: { id: string; nome: string } | null } | null;
};

// % de presença: "presente" e "reposicao" contam como aula cursada; "falta" e "justificada" não
// (justificada ainda é uma ausência pra fins de frequência, só não gera punição disciplinar —
// isso é regra de outra tela, não desta). Denominador é toda linha de presenças já lançada pro
// professor pra essa matrícula (aulas ainda não dadas não entram, porque nunca geram linha).
function calcularFrequencia(statuses: string[]): DadosPortalFrequencia {
  const presentes = statuses.filter((s) => s === "presente" || s === "reposicao").length;
  return { totalAulas: statuses.length, presentes };
}

// IMPORTANTE: esta function NÃO re-valida CPF — a autenticação acontece uma única vez em
// validarCpfResponsavelGlobal(), chamada pelo componente client ANTES de este ser chamado.
// Mesmo modelo de segurança (bearer token implícito via UUID) já aceito nas rotas públicas de
// PDF (/api/contratos/[matriculaId]/pdf, /api/comprovantes/parcela/[parcelaId]/pdf) — não é um
// gap novo introduzido aqui.
export async function getDadosPortalResponsavelGlobal(alunoId: string): Promise<DadosPortal | null> {
  const admin = createAdminClient();

  const [{ data: aluno }, { data: config }] = await Promise.all([
    admin.from("alunos").select("full_name, status_aluno, foto_url").eq("id", alunoId).maybeSingle(),
    admin
      .from("configuracoes")
      .select("escola_nome, escola_logo_url, escola_telefone, escola_email")
      .eq("id", true)
      .maybeSingle(),
  ]);
  if (!aluno) return null;

  // Só matrículas ATIVAS (seção "Matrículas Ativas" do portal) — concluídas/canceladas/
  // transferidas não aparecem aqui.
  const { data: matriculasData } = await admin
    .from("matriculas")
    .select("id, status, data_matricula, turmas(nome, cursos(id, nome))")
    .eq("aluno_id", alunoId)
    .eq("status", "ativa")
    .order("created_at", { ascending: false });

  const matriculasBrutas = (matriculasData ?? []) as unknown as LinhaMatricula[];

  const matriculas: DadosPortalMatricula[] = await Promise.all(
    matriculasBrutas.map(async (matricula) => {
      const cursoId = matricula.turmas?.cursos?.id ?? null;

      const [{ data: parcelasData }, { data: contrato }, { data: termoImagem }, { data: modulosData }, { data: presencasData }] =
        await Promise.all([
          admin
            .from("parcelas")
            .select(
              "id, numero_parcela, valor, data_vencimento, data_pagamento, status, asaas_invoice_url, asaas_bank_slip_url",
            )
            .eq("matricula_id", matricula.id)
            .order("numero_parcela"),
          admin.from("contratos_assinados").select("status, aceito_em").eq("matricula_id", matricula.id).maybeSingle(),
          admin.from("termos_imagem_assinados").select("aceito_em").eq("matricula_id", matricula.id).maybeSingle(),
          // Progresso: todas as aulas do curso (via módulos), comparadas contra aulas_concluidas
          // desta matrícula — mesmo cálculo de getCursoProgresso (src/lib/aulas-concluidas/
          // progresso.ts), mas reescrito aqui porque aquele helper lê aulas_concluidas via RLS do
          // próprio aluno autenticado (auth.uid()); este portal não tem sessão, roda só com
          // createAdminClient(), então precisa filtrar por matricula_id explicitamente.
          cursoId
            ? admin.from("modulos").select("aulas(id)").eq("curso_id", cursoId)
            : Promise.resolve({ data: [] as { aulas: { id: string }[] | null }[] }),
          admin.from("presencas").select("status").eq("matricula_id", matricula.id),
        ]);

      const aulaIds = ((modulosData ?? []) as unknown as { aulas: { id: string }[] | null }[]).flatMap(
        (m) => m.aulas?.map((a) => a.id) ?? [],
      );
      const { data: concluidasData } =
        aulaIds.length > 0
          ? await admin.from("aulas_concluidas").select("aula_id").eq("matricula_id", matricula.id).in("aula_id", aulaIds)
          : { data: [] as { aula_id: string }[] };
      const concluidasUnicas = new Set((concluidasData ?? []).map((c) => c.aula_id));

      return {
        id: matricula.id,
        status: matricula.status,
        data_matricula: matricula.data_matricula,
        nomeCurso: matricula.turmas?.cursos?.nome ?? "—",
        nomeTurma: matricula.turmas?.nome ?? "—",
        progresso: { total: aulaIds.length, concluidas: concluidasUnicas.size },
        frequencia: calcularFrequencia((presencasData ?? []).map((p) => p.status as string)),
        statusContrato: contrato?.status ?? null,
        contratoAssinadoEm: contrato?.aceito_em ?? null,
        termoImagemAssinado: !!termoImagem,
        termoImagemAssinadoEm: termoImagem?.aceito_em ?? null,
        parcelas: (parcelasData ?? []) as DadosPortalParcela[],
      };
    }),
  );

  return {
    aluno: { full_name: aluno.full_name, status_aluno: aluno.status_aluno, fotoUrl: aluno.foto_url ?? null },
    matriculas,
    escola: {
      nome: config?.escola_nome ?? null,
      logoUrl: config?.escola_logo_url ?? null,
      telefone: config?.escola_telefone ?? null,
      email: config?.escola_email ?? null,
    },
  };
}
