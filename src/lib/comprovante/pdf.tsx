import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { carregarLogoEscolaParaPdf } from "@/lib/pdf/logo-escola";
import { isMinor } from "@/lib/alunos/schema";
import { MatriculaComprovantePdf, type ResumoMatricula } from "@/components/admin/matricula-comprovante-pdf";
import { CURSO_TIPOS } from "@/lib/cursos/schema";
import type { DIAS_SEMANA } from "@/lib/turmas/schema";
import type { DescontoFormato, DescontoTipo, FormaPagamento, TaxaMatriculaFormaPagamento } from "@/lib/matriculas/schema";

// .tsx (não .ts): precisa de JSX pra renderToBuffer(<MatriculaComprovantePdf .../>) mais abaixo.
// MatriculaComprovantePdf (src/components/admin/matricula-comprovante-pdf.tsx) não tem
// "use client" nem usa nenhuma API de browser — é importável direto aqui, sem precisar de uma
// cópia "server-safe" separada (diferente do que a tarefa previu como possível necessidade).

type LinhaMatricula = {
  id: string;
  aluno_id: string;
  valor_original: number | null;
  desconto_tipo: DescontoTipo;
  desconto_formato: DescontoFormato | null;
  desconto_valor: number;
  valor_final: number | null;
  num_parcelas: number;
  valor_parcela: number | null;
  forma_pagamento: FormaPagamento;
  data_primeira_mensalidade: string;
  data_inicio: string | null;
  previsao_conclusao: string | null;
  apostila_entregue: boolean;
  farda_entregue: boolean;
  kit_entregue: boolean;
  observacoes: string | null;
  taxa_matricula_final: number | null;
  taxa_matricula_forma_pagamento: TaxaMatriculaFormaPagamento | null;
  taxa_matricula_paga: boolean;
  alunos: {
    full_name: string | null;
    email: string;
    cpf: string;
    telefone: string;
    data_nascimento: string | null;
  } | null;
  turmas: {
    nome: string;
    cadencia_dias_semana: (typeof DIAS_SEMANA)[number][] | null;
    horario_aula: string | null;
    cursos: {
      id: string;
      nome: string;
      tipo: (typeof CURSO_TIPOS)[number];
      carga_horaria_horas: number | null;
      descricao: string | null;
    } | null;
  } | null;
};

// Único caminho de geração deste PDF — mesmo padrão de gerarContratoPdf (src/lib/contratos/
// pdf.tsx): client admin (service_role), nunca requireRole aqui (quem usa é tanto a Server
// Action autenticada do botão "Enviar comprovante" quanto a rota pública de PDF, que roda sem
// sessão nenhuma — ver src/app/api/comprovantes/[matriculaId]/pdf/route.ts).
export async function gerarComprovantePdf(matriculaId: string): Promise<Buffer> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("matriculas")
    .select(
      "id, aluno_id, valor_original, desconto_tipo, desconto_formato, desconto_valor, valor_final, num_parcelas, valor_parcela, forma_pagamento, data_primeira_mensalidade, data_inicio, previsao_conclusao, apostila_entregue, farda_entregue, kit_entregue, observacoes, taxa_matricula_final, taxa_matricula_forma_pagamento, taxa_matricula_paga, alunos(full_name, email, cpf, telefone, data_nascimento), turmas(nome, cadencia_dias_semana, horario_aula, cursos(id, nome, tipo, carga_horaria_horas, descricao))",
    )
    .eq("id", matriculaId)
    .maybeSingle();

  const matricula = data as unknown as LinhaMatricula | null;
  if (!matricula) {
    throw new Error("Matrícula não encontrada para gerar o comprovante.");
  }

  const cursoId = matricula.turmas?.cursos?.id;
  const [{ count: totalModulos }, { count: totalAulas }, { data: configuracoes }, escolaLogo] = await Promise.all([
    cursoId
      ? admin.from("modulos").select("id", { count: "exact", head: true }).eq("curso_id", cursoId)
      : Promise.resolve({ count: 0 }),
    cursoId
      ? admin
          .from("aulas")
          .select("id, modulos!inner(curso_id)", { count: "exact", head: true })
          .eq("modulos.curso_id", cursoId)
      : Promise.resolve({ count: 0 }),
    admin
      .from("configuracoes")
      .select("escola_nome, escola_endereco, escola_telefone, escola_email")
      .eq("id", true)
      .maybeSingle(),
    carregarLogoEscolaParaPdf(),
  ]);

  // Mesmo critério de gerarContratoPdf: responsável só é buscado (tabela responsaveis) quando o
  // aluno é menor — aqui não tem admin presente pra responder o dialog manual que
  // matricula-detalhes.tsx usa (ResponsavelMenorDialog), então o lookup precisa ser automático.
  let responsavel: { nome: string; cpf: string } | null = null;
  if (matricula.alunos?.data_nascimento && isMinor(matricula.alunos.data_nascimento)) {
    const { data: resp } = await admin
      .from("responsaveis")
      .select("nome, cpf")
      .eq("aluno_id", matricula.aluno_id)
      .maybeSingle();
    responsavel = resp ?? null;
  }

  const resumo: ResumoMatricula = {
    aluno: {
      full_name: matricula.alunos?.full_name ?? null,
      email: matricula.alunos?.email ?? "—",
      cpf: matricula.alunos?.cpf ?? "",
      telefone: matricula.alunos?.telefone ?? "",
    },
    curso: {
      nome: matricula.turmas?.cursos?.nome ?? "—",
      tipo: matricula.turmas?.cursos?.tipo ?? CURSO_TIPOS[0],
      carga_horaria_horas: matricula.turmas?.cursos?.carga_horaria_horas ?? null,
      descricao: matricula.turmas?.cursos?.descricao ?? null,
      totalModulos: totalModulos ?? 0,
      totalAulas: totalAulas ?? 0,
    },
    turma: {
      nome: matricula.turmas?.nome ?? "—",
      cadencia_dias_semana: matricula.turmas?.cadencia_dias_semana ?? null,
      horario_aula: matricula.turmas?.horario_aula ?? null,
    },
    valorOriginal: matricula.valor_original,
    descontoTipo: matricula.desconto_tipo ?? "sem_bolsa",
    descontoFormato: matricula.desconto_formato,
    descontoValor: matricula.desconto_valor ?? 0,
    valorFinal: matricula.valor_final,
    numParcelas: matricula.num_parcelas ?? 1,
    valorParcela: matricula.valor_parcela,
    formaPagamento: matricula.forma_pagamento ?? "outro",
    dataPrimeiraMensalidade: matricula.data_primeira_mensalidade ?? "",
    dataInicio: matricula.data_inicio ?? "",
    previsaoConclusao: matricula.previsao_conclusao,
    apostilaEntregue: matricula.apostila_entregue,
    fardaEntregue: matricula.farda_entregue,
    kitEntregue: matricula.kit_entregue,
    observacoes: matricula.observacoes ?? "",
    taxaMatriculaFinal: matricula.taxa_matricula_final,
    taxaMatriculaFormaPagamento: matricula.taxa_matricula_forma_pagamento,
    taxaMatriculaPaga: matricula.taxa_matricula_paga,
    escola_nome: configuracoes?.escola_nome ?? undefined,
    escola_logo_url: escolaLogo,
    escola_endereco: configuracoes?.escola_endereco ?? undefined,
    escola_telefone: configuracoes?.escola_telefone ?? undefined,
    escola_email: configuracoes?.escola_email ?? undefined,
    responsavelNome: responsavel?.nome,
    responsavelCpf: responsavel?.cpf,
  };

  const geradoEm = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  return renderToBuffer(<MatriculaComprovantePdf resumo={resumo} geradoEm={geradoEm} />);
}
