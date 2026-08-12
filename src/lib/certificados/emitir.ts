import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { gerarCertificadoPdf } from "./pdf";
import type { CertificadoTemplate } from "./schema";

const CERTIFICADOS_BUCKET = "certificados";

type MatriculaComCurso = {
  aluno_id: string;
  turmas: { data_inicio: string; cursos: { nome: string; tipo: string } | null } | null;
  alunos: { cpf: string | null } | null;
};

// Único caminho de geração de PDF + upload + atualização de status —
// reaproveitado tanto pela emissão automática (EAD, chamada logo após a
// aula/prova que completou o curso) quanto pela emissão manual do admin
// (presencial/híbrido, botão "Emitir" na fila). Sempre roda com o client
// admin (service_role): a decisão de "tem direito ao certificado" já foi
// tomada pela function SQL avaliar_certificado, não por nada calculado
// aqui — este código só monta o PDF com dados já validados no banco.
export async function emitirCertificado(
  certificadoId: string,
  emitidoPor: string | null,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  const { data: certificado } = await admin
    .from("certificados")
    .select("id, matricula_id, status, carga_horaria_horas, aproveitamento_percentual")
    .eq("id", certificadoId)
    .single();

  if (!certificado) {
    return { error: "Certificado não encontrado." };
  }
  if (certificado.status === "emitido") {
    return {};
  }

  const { data: matriculaData } = await admin
    .from("matriculas")
    .select("aluno_id, turmas(data_inicio, cursos(nome, tipo)), alunos(cpf)")
    .eq("id", certificado.matricula_id)
    .single();
  const matricula = matriculaData as unknown as MatriculaComCurso | null;
  const curso = matricula?.turmas?.cursos;

  if (!matricula || !curso) {
    return { error: "Não foi possível localizar o curso desta matrícula." };
  }

  const { data: perfil } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", matricula.aluno_id)
    .single();

  const { data: template } = await admin
    .from("certificado_template")
    .select("*")
    .eq("id", true)
    .single();

  if (!template) {
    return { error: "Template de certificado não configurado." };
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await gerarCertificadoPdf({
      template: template as CertificadoTemplate,
      nomeAluno: perfil?.full_name ?? "Aluno",
      nomeCurso: curso.nome,
      cargaHorariaHoras: certificado.carga_horaria_horas,
      dataConclusao: new Date(),
      dataInicio: matricula.turmas?.data_inicio ? new Date(matricula.turmas.data_inicio) : null,
      cpf: matricula.alunos?.cpf ?? null,
      aproveitamentoPercentual: certificado.aproveitamento_percentual,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Não foi possível gerar o PDF." };
  }

  const path = `${certificadoId}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(CERTIFICADOS_BUCKET)
    .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    return { error: "Não foi possível salvar o PDF do certificado." };
  }

  const { error: updateError } = await admin
    .from("certificados")
    .update({
      status: "emitido",
      arquivo_url: path,
      emitido_em: new Date().toISOString(),
      emitido_por: emitidoPor,
    })
    .eq("id", certificadoId);

  if (updateError) {
    return { error: "PDF gerado, mas não foi possível atualizar o certificado." };
  }

  return {};
}

// Chamado logo após qualquer ação do próprio aluno que pode completar um
// curso (concluir aula, tentar prova) — se a function SQL já criou um
// certificado pendente para um curso EAD, emite na hora, sem o admin
// precisar fazer nada. Curso presencial/híbrido fica pendente mesmo,
// esperando emissão manual na fila do admin.
export async function verificarEmissaoAutomaticaEad(matriculaId: string): Promise<void> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("certificados")
    .select("id, status, matriculas(turmas(cursos(tipo)))")
    .eq("matricula_id", matriculaId)
    .eq("status", "pendente_emissao")
    .maybeSingle();

  const certificado = data as unknown as {
    id: string;
    matriculas: { turmas: { cursos: { tipo: string } | null } | null } | null;
  } | null;

  const tipo = certificado?.matriculas?.turmas?.cursos?.tipo;
  if (!certificado || tipo !== "ead") {
    return;
  }

  await emitirCertificado(certificado.id, null);
}
