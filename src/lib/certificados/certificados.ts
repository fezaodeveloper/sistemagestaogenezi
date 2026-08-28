import { FileBadge } from "lucide-react";
import type { createClient } from "@/lib/supabase/server";
import type { DashboardNotificacao } from "@/lib/admin/dashboard";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export const CERTIFICADO_STATUS_LABELS: Record<string, string> = {
  pendente_emissao: "Pendente de emissão",
  emitido: "Emitido",
};

export type CertificadoAluno = {
  id: string;
  nomeCurso: string;
  status: "pendente_emissao" | "emitido";
  liberado: boolean;
  emitidoEm: string | null;
};

// RLS restringe à própria matrícula do aluno, mas não mais só às emitidas
// — o aluno agora precisa ver a linha em qualquer estado pra saber se
// está "aguardando liberação", pode emitir, ou já pode baixar.
export async function getMeusCertificados(
  supabase: SupabaseServerClient,
  alunoId: string,
): Promise<CertificadoAluno[]> {
  const { data } = await supabase
    .from("certificados")
    .select(
      "id, status, liberado, emitido_em, matriculas!inner(aluno_id, turmas!inner(cursos!inner(nome)))",
    )
    .eq("matriculas.aluno_id", alunoId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as Array<{
    id: string;
    status: "pendente_emissao" | "emitido";
    liberado: boolean;
    emitido_em: string | null;
    matriculas: { turmas: { cursos: { nome: string } | null } | null } | null;
  }>).map((c) => ({
    id: c.id,
    nomeCurso: c.matriculas?.turmas?.cursos?.nome ?? "Curso removido",
    status: c.status,
    liberado: c.liberado,
    emitidoEm: c.emitido_em,
  }));
}

export type CertificadoAguardandoLiberacao = {
  id: string;
  alunoNome: string | null;
  nomeCurso: string;
  cursoTipo: string;
  criadoEm: string;
  nota: number | null;
  frequencia: number | null;
};

// EAD nunca aparece aqui na operação normal (nasce com liberado=true e já
// sai emitido na hora) — o filtro por liberado=false, sem checar tipo de
// curso, também serve de rede de segurança: se uma emissão automática de
// EAD falhar por algum motivo, o certificado aparece aqui pro admin agir.
export async function getCertificadosAguardandoLiberacao(
  supabase: SupabaseServerClient,
): Promise<CertificadoAguardandoLiberacao[]> {
  const { data } = await supabase
    .from("certificados")
    .select(
      "id, created_at, aproveitamento_percentual, frequencia_percentual, matriculas!inner(alunos!inner(profiles!alunos_id_fkey(full_name)), turmas!inner(cursos!inner(nome, tipo)))",
    )
    .eq("liberado", false)
    .order("created_at");

  return ((data ?? []) as unknown as Array<{
    id: string;
    created_at: string;
    aproveitamento_percentual: number | null;
    frequencia_percentual: number | null;
    matriculas: {
      alunos: { profiles: { full_name: string | null } | null } | null;
      turmas: { cursos: { nome: string; tipo: string } | null } | null;
    } | null;
  }>).map((c) => ({
    id: c.id,
    alunoNome: c.matriculas?.alunos?.profiles?.full_name ?? null,
    nomeCurso: c.matriculas?.turmas?.cursos?.nome ?? "Curso removido",
    cursoTipo: c.matriculas?.turmas?.cursos?.tipo ?? "",
    criadoEm: c.created_at,
    // aproveitamento_percentual é a média das melhores notas do aluno nas
    // provas do curso (mesmo campo usado como "nota" na emissão do
    // certificado — ver src/lib/certificados/emitir.ts) — cursos EAD sem
    // frequência ficam com frequencia null (mesma lógica de avaliar_certificado).
    nota: c.aproveitamento_percentual,
    frequencia: c.frequencia_percentual,
  }));
}

// count com head:true, mesmo padrão de getNotificacaoResgatesPendentes.
export async function getNotificacaoCertificadosPendentes(
  supabase: SupabaseServerClient,
): Promise<DashboardNotificacao | null> {
  const { count } = await supabase
    .from("certificados")
    .select("*", { count: "exact", head: true })
    .eq("liberado", false);

  if (!count) return null;

  return {
    chave: "certificados-pendentes",
    titulo: "Certificados aguardando liberação",
    quantidade: count,
    href: "/admin/certificados",
    icone: FileBadge,
  };
}
