import { requireRole } from "@/lib/auth/dal";
import { getTermoLegal } from "@/lib/termos-legais/get-termo";
import { TermoLegalContent } from "@/components/aluno/termo-legal-content";
import { VoltarParaLegal } from "@/components/aluno/voltar-para-legal";
import { Card, CardContent } from "@/components/ui/card";

export default async function TermoUsoImagemPage() {
  await requireRole("aluno");
  const termo = await getTermoLegal("imagem");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <VoltarParaLegal />
      <div>
        <h1 className="text-2xl font-semibold">Termo de Uso de Imagem</h1>
        <p className="text-muted-foreground text-sm">Última atualização: setembro de 2026.</p>
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
                    solicitação formal à administração pelo formulário da página{" "}
                    <a href="/aluno/legal/lgpd" className="underline">
                      LGPD
                    </a>
                    . A revogação não afeta usos já publicados antes da solicitação, que serão
                    retirados em prazo razoável sempre que tecnicamente possível.
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
    </div>
  );
}
