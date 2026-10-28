import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTermoLegalPublico } from "@/lib/termos-legais/get-termo";
import { TermoLegalContent } from "@/components/aluno/termo-legal-content";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Política de Privacidade — Gênezi Conecta" };

export default async function PrivacidadeConectaPage() {
  const termo = await getTermoLegalPublico("conecta_privacidade");

  return (
    <main className="dark bg-background text-foreground min-h-svh p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
        <Link href="/conecta/vagas" className="text-muted-foreground flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft className="size-3.5" />
          Voltar para o Gênezi Conecta
        </Link>

        <div>
          <h1 className="text-2xl font-semibold">Política de Privacidade — Gênezi Conecta</h1>
          <p className="text-muted-foreground text-sm">Última atualização: outubro de 2026.</p>
        </div>

        <Card>
          <CardContent className="py-6">
            <TermoLegalContent
              termo={termo}
              fallback={
                <div className="flex flex-col gap-6 text-sm leading-relaxed">
                  <p>
                    Esta Política de Privacidade explica como a Escola Gênezi (&quot;Gênezi&quot;)
                    coleta, usa e protege os dados pessoais de quem usa o Gênezi Conecta, em
                    conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD).
                  </p>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">1. Dados que coletamos</h2>
                    <p>De candidatos (alunos e externos): nome, e-mail, WhatsApp, cidade/estado, data de nascimento, resumo profissional, experiências, currículo (PDF) e, para candidatos externos, CPF e dados de pagamento processados pelo nosso parceiro de cobrança. De empresas: nome da empresa, CNPJ, dados do responsável, WhatsApp, e-mail, endereço e logotipo.</p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">2. Para que usamos esses dados</h2>
                    <ul className="list-disc pl-5">
                      <li>Exibir seu perfil profissional a empresas parceiras, quando você optar por tornar o perfil visível;</li>
                      <li>Processar pagamentos de assinaturas de candidatos externos;</li>
                      <li>Avaliar e aprovar o cadastro de empresas parceiras;</li>
                      <li>Enviar comunicações relacionadas ao seu cadastro, candidatura ou assinatura (e-mail e WhatsApp);</li>
                      <li>Cumprir obrigações legais e proteger a segurança da plataforma.</li>
                    </ul>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">3. Com quem compartilhamos dados</h2>
                    <p>
                      O WhatsApp, nome, cursos concluídos na Gênezi (quando aplicável) e currículo de
                      candidatos com perfil visível são compartilhados com empresas parceiras com
                      cadastro ativo. Dados de pagamento de candidatos externos são processados por
                      nosso parceiro de cobrança (Asaas), que trata esses dados sob sua própria política
                      de privacidade. Não vendemos dados pessoais a terceiros.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">4. Candidatos menores de idade</h2>
                    <p>
                      Candidatos com 16 ou 17 anos só têm o perfil exibido a empresas após declarar que
                      serão acompanhados por um responsável legal em eventuais entrevistas. Não
                      coletamos dados de menores de 16 anos — o cadastro é bloqueado nesses casos.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">5. Retenção e exclusão</h2>
                    <p>
                      Mantemos seus dados enquanto o cadastro estiver ativo ou enquanto necessário para
                      cumprir obrigações legais (ex.: fiscais, no caso de pagamentos). Você pode
                      solicitar a exclusão do seu cadastro e dos dados associados a qualquer momento,
                      pelo WhatsApp de contato da escola.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">6. Segurança</h2>
                    <p>
                      Senhas são armazenadas de forma criptografada (nunca em texto puro). Currículos em
                      PDF ficam em um repositório privado, acessível apenas mediante link temporário
                      gerado sob demanda. Adotamos medidas técnicas e organizacionais razoáveis para
                      proteger seus dados contra acesso não autorizado.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">7. Seus direitos</h2>
                    <p>
                      Você pode solicitar a qualquer momento a confirmação, correção, portabilidade ou
                      exclusão dos seus dados, bem como informações sobre o compartilhamento deles,
                      conforme detalhado na nossa página de <Link href="/conecta/lgpd" className="underline underline-offset-2">LGPD</Link>.
                    </p>
                  </section>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
