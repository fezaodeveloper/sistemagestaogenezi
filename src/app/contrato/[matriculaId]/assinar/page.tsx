import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMinor } from "@/lib/alunos/schema";
import { ContratoAssinarForm } from "@/components/contrato/contrato-assinar-form";
import { Card, CardContent } from "@/components/ui/card";

// Server Component (sem "use client") de propósito — convenção do projeto é RSC por padrão; a
// única parte interativa (input de CPF + submissão) fica isolada em ContratoAssinarForm. Rota
// pública: sem requireRole, sem sidebar/menu admin, acessível sem sessão (matriculaId funciona
// como bearer token implícito, mesmo modelo de risco já aceito pela rota irmã de PDF público
// /api/contratos/[matriculaId]/pdf).
type LinhaMatricula = {
  id: string;
  alunos: { full_name: string | null; data_nascimento: string | null } | null;
  turmas: { cursos: { nome: string } | null } | null;
};

export default async function AssinarContratoPage({
  params,
}: {
  params: Promise<{ matriculaId: string }>;
}) {
  const { matriculaId } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("matriculas")
    .select("id, alunos(full_name, data_nascimento), turmas(cursos(nome))")
    .eq("id", matriculaId)
    .maybeSingle();

  const matricula = data as unknown as LinhaMatricula | null;
  if (!matricula) notFound();

  const { data: contrato } = await admin
    .from("contratos_assinados")
    .select("status")
    .eq("matricula_id", matriculaId)
    .maybeSingle();

  const jaAssinado = !contrato || contrato.status !== "pendente";
  const precisaResponsavel = matricula.alunos?.data_nascimento ? isMinor(matricula.alunos.data_nascimento) : false;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Assinatura de Contrato</h1>
        <p className="text-muted-foreground text-sm">
          {matricula.alunos?.full_name ?? "Aluno"} — {matricula.turmas?.cursos?.nome ?? "Curso"}
        </p>
      </div>

      <iframe
        src={`/api/contratos/${matriculaId}/pdf`}
        title="Contrato de matrícula"
        className="h-[70vh] w-full rounded-md border"
      />

      {jaAssinado ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">Este contrato já foi assinado.</p>
          </CardContent>
        </Card>
      ) : (
        <ContratoAssinarForm matriculaId={matriculaId} precisaResponsavel={precisaResponsavel} />
      )}
    </div>
  );
}
