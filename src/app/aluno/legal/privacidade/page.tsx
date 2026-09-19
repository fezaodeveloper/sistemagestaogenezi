import { requireRole } from "@/lib/auth/dal";
import { getTermoLegal } from "@/lib/termos-legais/get-termo";
import { TermoLegalContent } from "@/components/aluno/termo-legal-content";
import { VoltarParaLegal } from "@/components/aluno/voltar-para-legal";
import { Card, CardContent } from "@/components/ui/card";

export default async function PoliticaPrivacidadePage() {
  await requireRole("aluno");
  const termo = await getTermoLegal("privacidade");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <VoltarParaLegal />
      <div>
        <h1 className="text-2xl font-semibold">Política de Privacidade</h1>
        <p className="text-muted-foreground text-sm">Última atualização: setembro de 2026.</p>
      </div>

      <Card>
        <CardContent className="py-6">
          <TermoLegalContent
            termo={termo}
            fallback={
              <div className="flex flex-col gap-6 text-sm leading-relaxed">
                <p>
                  A GÊNEZI Educação Profissional (&quot;GÊNEZI&quot;, &quot;nós&quot;), inscrita
                  em Propriá/SE, respeita a privacidade de alunos, candidatos e visitantes e
                  trata os dados pessoais em conformidade com a Lei nº 13.709/2018 (Lei Geral de
                  Proteção de Dados Pessoais — LGPD). Esta política explica quais dados
                  coletamos, por que coletamos e quais direitos você tem sobre eles.
                </p>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">1. Dados que coletamos</h2>
                  <p>Coletamos os seguintes dados, conforme o seu uso da plataforma:</p>
                  <ul className="list-disc pl-5">
                    <li>Dados de identificação: nome completo, CPF, data de nascimento, foto.</li>
                    <li>Dados de contato: e-mail, telefone, endereço.</li>
                    <li>Dados acadêmicos: matrícula, turma, curso, frequência, notas, certificados.</li>
                    <li>Dados financeiros: mensalidades, forma de pagamento, histórico de parcelas.</li>
                    <li>
                      Dados de uso da plataforma: progresso em cursos, pontuação de gamificação,
                      mensagens trocadas com a administração.
                    </li>
                    <li>
                      Quando aplicável, dados enviados ao Gênezi Conecta (currículo, experiência
                      profissional) para candidatura a vagas de empresas parceiras.
                    </li>
                  </ul>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">2. Finalidade do tratamento</h2>
                  <p>Os dados coletados são usados para:</p>
                  <ul className="list-disc pl-5">
                    <li>Viabilizar a matrícula, o acompanhamento pedagógico e a emissão de certificados.</li>
                    <li>Processar cobranças e controlar a situação financeira da matrícula.</li>
                    <li>Enviar comunicações sobre aulas, provas, eventos e cobranças.</li>
                    <li>Conectar alunos a oportunidades de emprego e estágio (Gênezi Conecta), com consentimento do aluno.</li>
                    <li>Cumprir obrigações legais e regulatórias aplicáveis a instituições de ensino.</li>
                  </ul>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">3. Compartilhamento de dados</h2>
                  <p>
                    Não vendemos dados pessoais. Compartilhamos dados apenas quando necessário,
                    com:
                  </p>
                  <ul className="list-disc pl-5">
                    <li>Processadores de pagamento (ex.: Asaas), para cobrança de mensalidades.</li>
                    <li>
                      Empresas parceiras do Gênezi Conecta, apenas quando o aluno se candidata
                      voluntariamente a uma vaga.
                    </li>
                    <li>Autoridades públicas, quando exigido por lei ou ordem judicial.</li>
                    <li>Prestadores de infraestrutura (hospedagem, e-mail transacional), sob contrato de confidencialidade.</li>
                  </ul>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">4. Direitos do titular dos dados</h2>
                  <p>
                    Nos termos da LGPD, você pode solicitar a qualquer momento: confirmação da
                    existência de tratamento, acesso aos dados, correção de dados incompletos ou
                    desatualizados, anonimização ou exclusão de dados desnecessários,
                    portabilidade a outro fornecedor e revogação do consentimento. Veja a
                    página{" "}
                    <a href="/aluno/legal/lgpd" className="underline">
                      LGPD
                    </a>{" "}
                    para enviar sua solicitação.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">5. Contato do Encarregado (DPO)</h2>
                  <p>
                    Dúvidas sobre esta política ou sobre o tratamento dos seus dados podem ser
                    enviadas para a administração da GÊNEZI através do e-mail cadastrado nas
                    configurações da escola ou pelo formulário da página LGPD.
                  </p>
                </section>

                <section className="flex flex-col gap-2">
                  <h2 className="text-base font-semibold">6. Vigência e alterações</h2>
                  <p>
                    Esta política pode ser atualizada periodicamente para refletir mudanças
                    legais ou operacionais. A versão vigente é sempre a publicada nesta página.
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
