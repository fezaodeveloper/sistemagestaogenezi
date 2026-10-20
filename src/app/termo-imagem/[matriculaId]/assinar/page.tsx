import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMinor } from "@/lib/alunos/schema";
import { getTermoLegalPublico } from "@/lib/termos-legais/get-termo";
import { TermoLegalContent } from "@/components/aluno/termo-legal-content";
import { TermoImagemAssinarForm } from "@/components/termo-imagem/termo-imagem-assinar-form";
import { Card, CardContent } from "@/components/ui/card";

// Server Component público — mesma estrutura de src/app/contrato/[matriculaId]/assinar/page.tsx:
// sem requireRole, sem sidebar/menu admin, matriculaId como bearer token implícito. Reaproveita
// TermoLegalContent (componente puro, sem dependência de sessão) pra exibir o mesmo texto —
// customizado ou o fallback — que src/app/aluno/legal/imagem/page.tsx já mostra (não alterado).
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

      <Card>
        <CardContent className="py-6">
          <TermoLegalContent
            termo={termo}
            fallback={
              <div className="flex flex-col gap-6 text-sm leading-relaxed">
                <p>
                  Este termo trata da autorização, pelo aluno, para uso de sua imagem (fotos e
                  vídeos) captada durante atividades da GÊNEZI Educação Profissional, em
                  Propriá/SE.
                </p>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">1. Autorização</h2>
                  <p>
                    Ao permanecer matriculado e participar de aulas, eventos e atividades
                    presenciais, o aluno autoriza — de forma gratuita e não exclusiva — que a
                    GÊNEZI capte e utilize sua imagem em fotografias e vídeos.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">2. Finalidade do uso</h2>
                  <ul className="list-disc pl-5">
                    <li>Divulgação institucional em redes sociais, site e materiais impressos.</li>
                    <li>Registro de eventos, formaturas e atividades pedagógicas.</li>
                    <li>Produção de material de divulgação de cursos e campanhas de marketing.</li>
                  </ul>
                  <p>
                    A imagem não será utilizada para fins comerciais de terceiros, nem de forma
                    que associe o aluno a conteúdo depreciativo ou alheio à finalidade
                    educacional da GÊNEZI.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">3. Revogação</h2>
                  <p>
                    O aluno pode revogar esta autorização a qualquer momento, mediante
                    solicitação formal à administração da escola. A revogação não afeta usos já
                    publicados antes da solicitação, que serão retirados em prazo razoável
                    sempre que tecnicamente possível.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">4. Vigência</h2>
                  <p>
                    Este termo vigora enquanto durar a matrícula do aluno na GÊNEZI, ou até
                    revogação expressa nos termos do item anterior.
                  </p>
                </section>
              </div>
            }
          />
        </CardContent>
      </Card>

      {assinatura ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              ✅ Termo de imagem já assinado em {formatDataHora(assinatura.aceito_em)}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <TermoImagemAssinarForm matriculaId={matriculaId} precisaResponsavel={precisaResponsavel} />
      )}
    </div>
  );
}
