import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTermoLegalPublico } from "@/lib/termos-legais/get-termo";
import { TermoLegalContent } from "@/components/aluno/termo-legal-content";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Política de Cookies — Gênezi Conecta" };

export default async function CookiesConectaPage() {
  const termo = await getTermoLegalPublico("conecta_cookies");

  return (
    <main className="dark bg-background text-foreground min-h-svh p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 py-8">
        <Link href="/conecta/vagas" className="text-muted-foreground flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft className="size-3.5" />
          Voltar para o Gênezi Conecta
        </Link>

        <div>
          <h1 className="text-2xl font-semibold">Política de Cookies — Gênezi Conecta</h1>
          <p className="text-muted-foreground text-sm">Última atualização: outubro de 2026.</p>
        </div>

        <Card>
          <CardContent className="py-6">
            <TermoLegalContent
              termo={termo}
              fallback={
                <div className="flex flex-col gap-6 text-sm leading-relaxed">
                  <p>
                    Cookies são pequenos arquivos armazenados no seu navegador para que um site lembre
                    informações entre visitas. Esta política explica como o Gênezi Conecta os utiliza.
                  </p>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">1. Cookies essenciais</h2>
                    <p>
                      Usamos cookies estritamente necessários para manter sua sessão autenticada quando
                      você entra como empresa (no painel em /empresa) ou como aluno (no portal em
                      /aluno). Sem esses cookies, não é possível permanecer logado entre páginas. Eles
                      não exigem consentimento, por serem indispensáveis ao funcionamento do serviço.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">2. Cookies que não usamos</h2>
                    <p>
                      O Gênezi Conecta não utiliza cookies de publicidade, de rastreamento entre sites
                      ou de redes sociais. Não compartilhamos dados de navegação com anunciantes.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">3. Armazenamento local do navegador</h2>
                    <p>
                      Em algumas telas do portal do responsável e do aluno, usamos o armazenamento local
                      do navegador (sessionStorage) apenas para manter você conectado durante a mesma
                      aba, sem precisar digitar a senha novamente a cada recarregamento. Essa informação
                      fica só no seu dispositivo e é apagada ao fechar o navegador.
                    </p>
                  </section>

                  <section className="flex flex-col gap-2">
                    <h2 className="text-base font-semibold">4. Como gerenciar cookies</h2>
                    <p>
                      Você pode bloquear ou apagar cookies pelas configurações do seu navegador. Como os
                      cookies do Gênezi Conecta são essenciais para login, bloqueá-los impede o acesso a
                      áreas autenticadas (painel da empresa e portal do aluno), mas não afeta a
                      navegação pelas páginas públicas, como a lista de vagas.
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
