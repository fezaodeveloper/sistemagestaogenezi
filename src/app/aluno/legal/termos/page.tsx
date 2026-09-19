import { requireRole } from "@/lib/auth/dal";
import { getTermoLegal } from "@/lib/termos-legais/get-termo";
import { TermoLegalContent } from "@/components/aluno/termo-legal-content";
import { VoltarParaLegal } from "@/components/aluno/voltar-para-legal";
import { Card, CardContent } from "@/components/ui/card";

export default async function TermosDeUsoPage() {
  await requireRole("aluno");
  const termo = await getTermoLegal("termos");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <VoltarParaLegal />
      <div>
        <h1 className="text-2xl font-semibold">Termos de Uso</h1>
        <p className="text-muted-foreground text-sm">Última atualização: setembro de 2026.</p>
      </div>

      <Card>
        <CardContent className="py-6">
          <TermoLegalContent
            termo={termo}
            fallback={
              <div className="flex flex-col gap-6 text-sm leading-relaxed">
                <p>
                  Estes Termos de Uso regulam o acesso e uso do portal do aluno da GÊNEZI
                  Educação Profissional. Ao acessar sua conta, você concorda com as regras
                  descritas abaixo.
                </p>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">1. Uso da plataforma</h2>
                  <p>
                    O acesso é pessoal e intransferível, vinculado à matrícula ativa do aluno. O
                    login e a senha não devem ser compartilhados com terceiros. O conteúdo
                    disponibilizado (videoaulas, materiais, provas) destina-se exclusivamente ao
                    uso do aluno matriculado, para fins de estudo.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">2. Responsabilidades do aluno</h2>
                  <ul className="list-disc pl-5">
                    <li>Manter seus dados cadastrais atualizados.</li>
                    <li>Zelar pela confidencialidade de sua senha de acesso.</li>
                    <li>Cumprir os prazos de atividades, provas e pagamentos.</li>
                    <li>Utilizar a plataforma de forma ética e de acordo com a legislação vigente.</li>
                  </ul>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">3. Propriedade intelectual</h2>
                  <p>
                    Todo o conteúdo pedagógico (videoaulas, apostilas, slides, avaliações) é de
                    propriedade da GÊNEZI ou de seus licenciadores, protegido por direitos
                    autorais. É vedada a reprodução, distribuição, download não autorizado ou
                    publicação desse material fora da plataforma, integral ou parcialmente, sem
                    autorização expressa.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">4. Conduta esperada</h2>
                  <p>
                    Espera-se respeito nas interações com colegas, professores e administração,
                    inclusive no chat da plataforma. Não são toleradas condutas ofensivas,
                    discriminatórias, tentativas de fraude em avaliações ou uso indevido de
                    contas de terceiros. Violações podem resultar em advertência, suspensão de
                    acesso ou cancelamento da matrícula, conforme o regimento interno da escola.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">5. Rescisão de acesso</h2>
                  <p>
                    O acesso ao portal permanece ativo enquanto a matrícula estiver vigente. Ao
                    encerrar, trancar ou cancelar a matrícula, o acesso ao conteúdo do curso pode
                    ser suspenso, ressalvados os documentos (certificados, histórico) que a
                    escola deva manter disponíveis por obrigação legal ou contratual.
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
