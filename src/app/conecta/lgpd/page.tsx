import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "LGPD — Gênezi Conecta" };

export default function LgpdConectaPage() {
  return (
    <main className="dark bg-background text-foreground min-h-svh p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
        <Link href="/conecta/vagas" className="text-muted-foreground flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft className="size-3.5" />
          Voltar para o Gênezi Conecta
        </Link>

        <div>
          <h1 className="text-2xl font-semibold">LGPD — Seus direitos no Gênezi Conecta</h1>
          <p className="text-muted-foreground text-sm">Última atualização: outubro de 2026.</p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-6 py-6 text-sm leading-relaxed">
            <p>
              A Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD) garante a você, titular
              dos dados, uma série de direitos sobre as informações pessoais que a Escola Gênezi
              trata no Gênezi Conecta. Esta página resume esses direitos e como exercê-los.
            </p>

            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">1. Seus direitos como titular</h2>
              <ul className="list-disc pl-5">
                <li>Confirmação de que tratamos dados seus, e acesso a eles;</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
                <li>Portabilidade dos dados a outro fornecedor de serviço, mediante requisição expressa;</li>
                <li>Eliminação dos dados tratados com o seu consentimento, quando não houver outra base legal para a manutenção deles;</li>
                <li>Informação sobre com quem compartilhamos seus dados;</li>
                <li>Revogação do consentimento, quando o tratamento se basear nele (por exemplo, ao tornar seu perfil visível a empresas).</li>
              </ul>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">2. Base legal do tratamento</h2>
              <p>
                Tratamos dados de candidatos e empresas principalmente com base na execução de
                contrato ou procedimentos preliminares a ele (viabilizar a candidatura a vagas e a
                publicação de vagas), no consentimento (ao ativar a visibilidade do perfil) e no
                cumprimento de obrigação legal ou regulatória (por exemplo, dados fiscais ligados
                a pagamentos de assinaturas).
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">3. Candidatos de 16 e 17 anos</h2>
              <p>
                Para candidatos nessa faixa de idade, o consentimento para ter o perfil visível a
                empresas é acompanhado da declaração de que um responsável legal estará presente
                em entrevistas decorrentes da candidatura — uma salvaguarda adicional, não prevista
                genericamente na lei, mas adotada pela Gênezi por responsabilidade com menores.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">4. Como exercer seus direitos</h2>
              <p>
                Envie sua solicitação pelo WhatsApp de contato da escola, disponível na página do
                Gênezi Conecta, informando seu nome completo e o e-mail usado no cadastro.
                Responderemos em prazo razoável, podendo solicitar informações adicionais para
                confirmar sua identidade antes de atender ao pedido.
              </p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="text-base font-semibold">5. Encarregado de dados</h2>
              <p>
                Dúvidas sobre o tratamento de dados pessoais no Gênezi Conecta podem ser
                direcionadas ao mesmo canal de contato da escola. Veja também nossa{" "}
                <Link href="/conecta/privacidade" className="underline underline-offset-2">
                  Política de Privacidade
                </Link>
                .
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
