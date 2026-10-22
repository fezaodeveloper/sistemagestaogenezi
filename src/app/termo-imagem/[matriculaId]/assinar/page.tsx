import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMinor } from "@/lib/alunos/schema";
import { getTermoLegalPublico } from "@/lib/termos-legais/get-termo";
import { TermoImagemAssinarForm } from "@/components/termo-imagem/termo-imagem-assinar-form";
import { Card, CardContent } from "@/components/ui/card";

// Server Component público — mesma estrutura de src/app/contrato/[matriculaId]/assinar/page.tsx:
// sem requireRole, sem sidebar/menu admin, matriculaId como bearer token implícito. O texto do
// termo (customizado ou fallback) agora é renderizado DENTRO de TermoImagemAssinarForm — ver lá
// (TermoLegalContent + TermoImagemFallback) —, não mais nesta page.tsx, pra ficar
// imediatamente antes do checkbox "Li e concordo" e do formulário de CPF, não separado deles.
type LinhaMatricula = {
  id: string;
  alunos: { full_name: string | null; data_nascimento: string | null } | null;
  turmas: { cursos: { nome: string } | null } | null;
};

function formatDataHora(isoString: string): string {
  const data = new Date(isoString);
  const dataFormatada = data.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = data.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  return `${dataFormatada} às ${hora}`;
}

export default async function AssinarTermoImagemPage({
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

  const [{ data: assinatura }, termo] = await Promise.all([
    admin.from("termos_imagem_assinados").select("aceito_em").eq("matricula_id", matriculaId).maybeSingle(),
    getTermoLegalPublico("imagem"),
  ]);

  const precisaResponsavel = matricula.alunos?.data_nascimento ? isMinor(matricula.alunos.data_nascimento) : false;

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Termo de Uso de Imagem</h1>
        <p className="text-muted-foreground text-sm">
          {matricula.alunos?.full_name ?? "Aluno"} — {matricula.turmas?.cursos?.nome ?? "Curso"}
        </p>
      </div>

      {assinatura ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              ✅ Termo de imagem já assinado em {formatDataHora(assinatura.aceito_em)}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <TermoImagemAssinarForm matriculaId={matriculaId} precisaResponsavel={precisaResponsavel} termo={termo} />
      )}
    </div>
  );
}
