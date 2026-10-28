import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTermoLegalPublico } from "@/lib/termos-legais/get-termo";
import { TermoLegalContent } from "@/components/aluno/termo-legal-content";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Termos de Uso — Gênezi Conecta" };

// Lê de termos_legais (chave conecta_termos_uso, editável em /admin/conecta/termos) — mesmo
// padrão das páginas /aluno/legal/*, só que via client admin (service_role): esta página é
// pública, sem sessão, e o grant de select em termos_legais só cobre "authenticated" (ver
// 20260917600000_termos_legais.sql) — getTermoLegalPublico() existe exatamente pra esse caso.
export default async function TermosDeUsoConectaPage() {
  const termo = await getTermoLegalPublico("conecta_termos_uso");

  return (
    <main className="dark bg-background text-foreground min-h-svh p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
        <Link href="/conecta/vagas" className="text-muted-foreground flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft className="size-3.5" />
          Voltar para o Gênezi Conecta
        </Link>

        <div>
          <h1 className="text-2xl font-semibold">Termos de Uso — Gênezi Conecta</h1>
          <p className="text-muted-foreground text-sm">Última atualização: outubro de 2026.</p>
        </div>

        <Card>
          <CardContent className="py-6">
            <TermoLegalContent
              termo={termo}
              fallback={
                <div className="flex flex-col gap-6 text-sm leading-relaxed">
                  <p>
                    O Gênezi Conecta é um portal de oportunidades de emprego e estágio mantido pela
                    Escola Gênezi (&quot;Gênezi&quot;, &quot;nós&quot;), que conecta candidatos a empresas
                    parceiras da região. Ao acessar ou se cadastrar no Gênezi Conecta, você concorda com
                    estes Termos de Uso.
                  </p>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">1. Quem pode usar o Gênezi Conecta</h2>
                    <p>
                      O cadastro como candidato é permitido a partir de 16 anos completos. Candidatos
                      com 16 ou 17 anos devem declarar, no momento do cadastro ou da ativação da
                      visibilidade do perfil, que serão acompanhados por um dos pais ou responsável
                      legal em qualquer entrevista de emprego decorrente do uso da plataforma.
                      Candidatos menores de 16 anos não podem se cadastrar.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">2. Alunos da Gênezi e candidatos externos</h2>
                    <p>
                      Alunos com matrícula ativa na Gênezi têm acesso gratuito ao Gênezi Conecta pelo
                      portal do aluno. Candidatos que não são alunos (&quot;candidatos externos&quot;)
                      podem participar mediante assinatura de um dos planos pagos disponíveis no
                      cadastro, cobrada de forma recorrente através do nosso processador de pagamentos.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">3. Cadastro de empresas</h2>
                    <p>
                      O cadastro de empresas parceiras não é aberto ao público: depende de contato
                      prévio com a escola (por exemplo, via WhatsApp) e da obtenção de um código de
                      acesso fornecido após uma avaliação simples do perfil da empresa. A publicação de
                      vagas por empresas aprovadas é gratuita.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">4. Veracidade das informações</h2>
                    <p>
                      Você é responsável pela exatidão dos dados informados no cadastro (seus ou de sua
                      empresa) e pela atualização deles quando necessário. A Gênezi pode suspender ou
                      cancelar cadastros com informações falsas, incompletas de forma intencional, ou
                      usados para fins diferentes de recrutamento e candidatura a vagas de emprego.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">5. Papel da Gênezi na relação entre candidato e empresa</h2>
                    <p>
                      A Gênezi atua como ponto de encontro entre candidatos e empresas, divulgando vagas
                      e perfis profissionais. Não somos parte da relação de trabalho, estágio ou
                      entrevista que venha a existir entre candidato e empresa, e não garantimos
                      contratação, remuneração ou condições de trabalho oferecidas por terceiros.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">6. Conduta esperada</h2>
                    <p>
                      É proibido usar o Gênezi Conecta para fins discriminatórios, para publicar vagas
                      ou perfis falsos, para coletar dados de outros usuários fora do contexto de
                      recrutamento, ou para qualquer finalidade ilícita. Contas que violem estas regras
                      podem ser suspensas ou excluídas, a critério da Gênezi.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">7. Cancelamento</h2>
                    <p>
                      Candidatos externos podem cancelar a assinatura a qualquer momento; o acesso
                      permanece até o fim do período já pago. Empresas podem solicitar o encerramento do
                      cadastro pelo mesmo canal usado para a aprovação inicial. A Gênezi pode encerrar o
                      serviço do Gênezi Conecta, total ou parcialmente, mediante aviso razoável.
                    </p>
                  </section>

                  <p className="text-muted-foreground">
                    Dúvidas sobre estes Termos podem ser enviadas pelo WhatsApp de contato da escola,
                    disponível na página do Gênezi Conecta.
                  </p>
                </div>
              }
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
