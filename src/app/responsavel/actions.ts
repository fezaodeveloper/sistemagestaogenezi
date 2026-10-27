"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { onlyDigits } from "@/lib/alunos/schema";
import { adicionarDias, hojeISO } from "@/lib/datas/util";

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

// Dados públicos da escola (nome/logo) pra a própria tela de CPF, ANTES de qualquer validação —
// mesmo client admin, mas sem nenhum dado de aluno envolvido.
export type ConfigEscolaPublica = { nome: string | null; logoUrl: string | null };

export async function getConfigEscolaPublicaGlobal(): Promise<ConfigEscolaPublica> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("configuracoes")
    .select("escola_nome, escola_logo_url")
    .eq("id", true)
    .maybeSingle();

  return { nome: data?.escola_nome ?? null, logoUrl: data?.escola_logo_url ?? null };
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

// Uma ocorrência de presença já lançada (qualquer status) — base da seção Frequência (histórico
// por mês + tabela de ocorrências) no dashboard novo.
export type DadosPortalPresenca = {
  id: string;
  data: string;
  status: string;
  dataReposicao: string | null;
  justificativa: string | null;
};

export type DadosPortalAula = { id: string; numero: number; titulo: string; concluida: boolean };

export type DadosPortalModulo = {
  id: string;
  numero: number;
  titulo: string;
  aulas: DadosPortalAula[];
};

// Sessão futura calculada por calendario_aulas_turma (RPC já existente, mesma usada pelo
// cronograma/liberação de conteúdo do aluno — ver src/lib/cronograma/liberacao.ts). "aulas" não
// tem campo de data própria: a data de cada sessão é sempre derivada de
// turmas.cadencia_dias_semana + turmas.data_inicio, nunca armazenada.
export type DadosPortalProximaAula = { aulaId: string; numeroSessao: number; data: string };

export type DadosPortalTurma = {
  nome: string;
  professor: string | null;
  horarioAula: string | null;
  horarioFim: string | null;
  cadenciaDiasSemana: string[] | null;
  turno: string | null;
  localSala: string | null;
};

export type DadosPortalCertificado = {
  status: string;
  liberado: boolean;
  aproveitamentoPercentual: number | null;
  frequenciaPercentual: number | null;
  arquivoUrl: string | null;
  emitidoEm: string | null;
};

export type DadosPortalMatricula = {
  id: string;
  status: string;
  data_matricula: string;
  previsaoConclusao: string | null;
  nomeCurso: string;
  nomeTurma: string;
  cargaHorariaHoras: number | null;
  turma: DadosPortalTurma;
  progresso: DadosPortalProgresso;
  frequencia: DadosPortalFrequencia;
  presencas: DadosPortalPresenca[];
  modulos: DadosPortalModulo[];
  proximasAulas: DadosPortalProximaAula[];
  // null = nenhum contrato gerado ainda pra esta matrícula (não confundir com "pendente", que é
  // um status real de contratos_assinados.status).
  statusContrato: string | null;
  contratoAssinadoEm: string | null;
  termoImagemAssinado: boolean;
  termoImagemAssinadoEm: string | null;
  parcelas: DadosPortalParcela[];
  certificado: DadosPortalCertificado | null;
};

// Feriado/prova/evento que afeta alguma das turmas/cursos do aluno, nos próximos 30 dias — ver
// seção Agenda. Mesmo critério de abrangência de getFeriadosTurma (src/lib/calendario/feriados-turma.ts):
// "todos" sempre conta, "curso"/"turma" só quando bate com alguma matrícula deste aluno.
export type DadosPortalEvento = {
  id: string;
  nome: string;
  tipo: string;
  dataInicio: string;
  dataFim: string | null;
  horarioInicio: string | null;
  horarioFim: string | null;
};

// Medalhas (tabela badges/badges_conquistados, Fase 8) — por ALUNO, não por matrícula: um badge
// como "Curso Concluído" é concedido olhando todas as matrículas do aluno de uma vez.
export type DadosPortalBadge = {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  conquistadoEm: string;
};

export type DadosPortal = {
  aluno: { full_name: string | null; status_aluno: string | null; fotoUrl: string | null };
  matriculas: DadosPortalMatricula[];
  eventosCalendario: DadosPortalEvento[];
  badges: DadosPortalBadge[];
  escola: { nome: string | null; logoUrl: string | null; telefone: string | null; email: string | null };
};

type LinhaMatricula = {
  id: string;
  status: string;
  data_matricula: string;
  previsao_conclusao: string | null;
  turma_id: string;
  turmas: {
    nome: string;
    professor: string | null;
    horario_aula: string | null;
    horario_fim: string | null;
    cadencia_dias_semana: string[] | null;
    turno: string | null;
    local_sala: string | null;
    cursos: { id: string; nome: string; carga_horaria_horas: number | null } | null;
  } | null;
};

// % de presença: "presente" e "reposicao" contam como aula cursada; "falta" e "justificada" não
// (justificada ainda é uma ausência pra fins de frequência, só não gera punição disciplinar —
// isso é regra de outra tela, não desta). Denominador é toda linha de presenças já lançada pro
// professor pra essa matrícula (aulas ainda não dadas não entram, porque nunca geram linha).
function calcularFrequencia(statuses: string[]): DadosPortalFrequencia {
  const presentes = statuses.filter((s) => s === "presente" || s === "reposicao").length;
  return { totalAulas: statuses.length, presentes };
}

type LinhaAulaEmbed = { id: string; numero: number; titulo: string };
type LinhaModuloEmbed = { id: string; numero: number; titulo: string; aulas: LinhaAulaEmbed[] | null };

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
    .select(
      "id, status, data_matricula, previsao_conclusao, turma_id, " +
        "turmas(nome, professor, horario_aula, horario_fim, cadencia_dias_semana, turno, local_sala, cursos(id, nome, carga_horaria_horas))",
    )
    .eq("aluno_id", alunoId)
    .eq("status", "ativa")
    .order("created_at", { ascending: false });

  const matriculasBrutas = (matriculasData ?? []) as unknown as LinhaMatricula[];

  const hoje = hojeISO();
  const em30Dias = adicionarDias(hoje, 30);

  const turmaIds = new Set(matriculasBrutas.map((m) => m.turma_id));
  const cursoIds = new Set(
    matriculasBrutas.map((m) => m.turmas?.cursos?.id).filter((id): id is string => !!id),
  );

  const [{ data: eventosData }, { data: badgesData }] = await Promise.all([
    // Folga de 60 dias pra trás (mesmo critério de getFeriadosTurma): cobre um evento de vários
    // dias cujo data_fim se estenda até dentro da janela, mesmo com data_inicio anterior a ela.
    admin
      .from("eventos_calendario")
      .select("id, nome, tipo, data_inicio, data_fim, horario_inicio, horario_fim, abrangencia, curso_id, turma_id")
      .lte("data_inicio", em30Dias)
      .gte("data_inicio", adicionarDias(hoje, -60)),
    admin
      .from("badges_conquistados")
      .select("badge_id, conquistado_em, badges(nome, descricao, icone)")
      .eq("aluno_id", alunoId)
      .order("conquistado_em", { ascending: false }),
  ]);

  const eventosCalendario: DadosPortalEvento[] = ((eventosData ?? []) as unknown as {
    id: string;
    nome: string;
    tipo: string;
    data_inicio: string;
    data_fim: string | null;
    horario_inicio: string | null;
    horario_fim: string | null;
    abrangencia: string;
    curso_id: string | null;
    turma_id: string | null;
  }[])
    .filter((evento) => {
      const fimEfetivo = evento.data_fim ?? evento.data_inicio;
      if (fimEfetivo < hoje || evento.data_inicio > em30Dias) return false;
      if (evento.abrangencia === "curso") return !!evento.curso_id && cursoIds.has(evento.curso_id);
      if (evento.abrangencia === "turma") return !!evento.turma_id && turmaIds.has(evento.turma_id);
      return true;
    })
    .map((evento) => ({
      id: evento.id,
      nome: evento.nome,
      tipo: evento.tipo,
      dataInicio: evento.data_inicio,
      dataFim: evento.data_fim,
      horarioInicio: evento.horario_inicio,
      horarioFim: evento.horario_fim,
    }))
    .sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));

  const badges: DadosPortalBadge[] = (
    (badgesData ?? []) as unknown as {
      badge_id: string;
      conquistado_em: string;
      badges: { nome: string; descricao: string; icone: string } | null;
    }[]
  )
    .filter((linha) => linha.badges !== null)
    .map((linha) => ({
      id: linha.badge_id,
      nome: linha.badges!.nome,
      descricao: linha.badges!.descricao,
      icone: linha.badges!.icone,
      conquistadoEm: linha.conquistado_em,
    }));

  const matriculas: DadosPortalMatricula[] = await Promise.all(
    matriculasBrutas.map(async (matricula) => {
      const cursoId = matricula.turmas?.cursos?.id ?? null;

      const [
        { data: parcelasData },
        { data: contrato },
        { data: termoImagem },
        { data: modulosData },
        { data: presencasData },
        { data: certificadoData },
        { data: calendarioTurma },
      ] = await Promise.all([
        admin
          .from("parcelas")
          .select(
            "id, numero_parcela, valor, data_vencimento, data_pagamento, status, asaas_invoice_url, asaas_bank_slip_url",
          )
          .eq("matricula_id", matricula.id)
          .order("numero_parcela"),
        admin.from("contratos_assinados").select("status, aceito_em").eq("matricula_id", matricula.id).maybeSingle(),
        admin.from("termos_imagem_assinados").select("aceito_em").eq("matricula_id", matricula.id).maybeSingle(),
        // Progresso/módulos: todas as aulas do curso (via módulos), comparadas contra
        // aulas_concluidas desta matrícula — mesmo cálculo de getCursoProgresso
        // (src/lib/aulas-concluidas/progresso.ts), mas reescrito aqui porque aquele helper lê
        // aulas_concluidas via RLS do próprio aluno autenticado (auth.uid()); este portal não
        // tem sessão, roda só com createAdminClient().
        cursoId
          ? admin
              .from("modulos")
              .select("id, numero, titulo, aulas(id, numero, titulo)")
              .eq("curso_id", cursoId)
              .order("numero")
              .order("numero", { referencedTable: "aulas" })
          : Promise.resolve({ data: [] as LinhaModuloEmbed[] }),
        admin
          .from("presencas")
          .select("id, data, status, data_reposicao, justificativa")
          .eq("matricula_id", matricula.id)
          .order("data", { ascending: false }),
        admin
          .from("certificados")
          .select("status, liberado, aproveitamento_percentual, frequencia_percentual, arquivo_url, emitido_em")
          .eq("matricula_id", matricula.id)
          .maybeSingle(),
        matricula.turma_id
          ? admin.rpc("calendario_aulas_turma", { p_turma_id: matricula.turma_id })
          : Promise.resolve({ data: [] as { aula_id: string; numero_sessao: number; data_liberacao: string }[] }),
      ]);

      const modulosBrutos = (modulosData ?? []) as unknown as LinhaModuloEmbed[];
      const aulaIds = modulosBrutos.flatMap((m) => (m.aulas ?? []).map((a) => a.id));
      const { data: concluidasData } =
        aulaIds.length > 0
          ? await admin.from("aulas_concluidas").select("aula_id").eq("matricula_id", matricula.id).in("aula_id", aulaIds)
          : { data: [] as { aula_id: string }[] };
      const concluidasUnicas = new Set((concluidasData ?? []).map((c) => c.aula_id));

      const modulos: DadosPortalModulo[] = modulosBrutos.map((modulo) => ({
        id: modulo.id,
        numero: modulo.numero,
        titulo: modulo.titulo,
        aulas: (modulo.aulas ?? []).map((aula) => ({
          id: aula.id,
          numero: aula.numero,
          titulo: aula.titulo,
          concluida: concluidasUnicas.has(aula.id),
        })),
      }));

      const proximasAulas: DadosPortalProximaAula[] = (
        (calendarioTurma ?? []) as { aula_id: string; numero_sessao: number; data_liberacao: string }[]
      )
        .filter((sessao) => sessao.data_liberacao >= hoje)
        .sort((a, b) => a.data_liberacao.localeCompare(b.data_liberacao))
        .slice(0, 10)
        .map((sessao) => ({ aulaId: sessao.aula_id, numeroSessao: sessao.numero_sessao, data: sessao.data_liberacao }));

      return {
        id: matricula.id,
        status: matricula.status,
        data_matricula: matricula.data_matricula,
        previsaoConclusao: matricula.previsao_conclusao,
        nomeCurso: matricula.turmas?.cursos?.nome ?? "—",
        nomeTurma: matricula.turmas?.nome ?? "—",
        cargaHorariaHoras: matricula.turmas?.cursos?.carga_horaria_horas ?? null,
        turma: {
          nome: matricula.turmas?.nome ?? "—",
          professor: matricula.turmas?.professor ?? null,
          horarioAula: matricula.turmas?.horario_aula ?? null,
          horarioFim: matricula.turmas?.horario_fim ?? null,
          cadenciaDiasSemana: matricula.turmas?.cadencia_dias_semana ?? null,
          turno: matricula.turmas?.turno ?? null,
          localSala: matricula.turmas?.local_sala ?? null,
        },
        progresso: { total: aulaIds.length, concluidas: concluidasUnicas.size },
        frequencia: calcularFrequencia((presencasData ?? []).map((p) => p.status as string)),
        presencas: ((presencasData ?? []) as unknown as {
          id: string;
          data: string;
          status: string;
          data_reposicao: string | null;
          justificativa: string | null;
        }[]).map((p) => ({
          id: p.id,
          data: p.data,
          status: p.status,
          dataReposicao: p.data_reposicao,
          justificativa: p.justificativa,
        })),
        modulos,
        proximasAulas,
        statusContrato: contrato?.status ?? null,
        contratoAssinadoEm: contrato?.aceito_em ?? null,
        termoImagemAssinado: !!termoImagem,
        termoImagemAssinadoEm: termoImagem?.aceito_em ?? null,
        parcelas: (parcelasData ?? []) as DadosPortalParcela[],
        certificado: certificadoData
          ? {
              status: certificadoData.status,
              liberado: certificadoData.liberado,
              aproveitamentoPercentual: certificadoData.aproveitamento_percentual,
              frequenciaPercentual: certificadoData.frequencia_percentual,
              arquivoUrl: certificadoData.arquivo_url,
              emitidoEm: certificadoData.emitido_em,
            }
          : null,
      };
    }),
  );

  return {
    aluno: { full_name: aluno.full_name, status_aluno: aluno.status_aluno, fotoUrl: aluno.foto_url ?? null },
    matriculas,
    eventosCalendario,
    badges,
    escola: {
      nome: config?.escola_nome ?? null,
      logoUrl: config?.escola_logo_url ?? null,
      telefone: config?.escola_telefone ?? null,
      email: config?.escola_email ?? null,
    },
  };
}
