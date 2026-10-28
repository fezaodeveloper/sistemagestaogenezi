import Link from "next/link";
import { GraduationCap, MapPin, ShieldCheck } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTermoLegalPublico, textoPlanoDoTermo } from "@/lib/termos-legais/get-termo";
import { PLANOS_CONECTA, type PlanoConecta } from "@/lib/conecta/schema";
import { ConectaCadastroExternoForm } from "@/components/conecta/cadastro-externo-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TEXTO_TERMO_MENOR_PADRAO =
  "Declaro que serei acompanhado por um dos meus pais ou responsável legal em qualquer entrevista de emprego.";

function planoValido(valor: string | undefined): PlanoConecta | undefined {
  return (PLANOS_CONECTA as readonly string[]).includes(valor ?? "") ? (valor as PlanoConecta) : undefined;
}

// Pública de propósito — cadastro de candidato externo não exige login
// prévio (REGRA da tarefa). Sem requireRole aqui.
export default async function ConectaCadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ plano?: string }>;
}) {
  const { plano } = await searchParams;

  // conecta_menor_termo é editável em /admin/conecta/termos — texto do checkbox de
  // acompanhamento exibido a candidatos de 16-17 anos (ver TAREFA de proteção de idade).
  // Logo via configuracoes.escola_logo_url (client admin, mesmo padrão de
  // /conecta/aguardando-pagamento e /conecta/vagas) — não é um arquivo estático /logo.png, é
  // configurável pelo admin em /admin/configuracoes.
  const admin = createAdminClient();
  const [termoMenor, { data: configuracoes }] = await Promise.all([
    getTermoLegalPublico("conecta_menor_termo"),
    admin.from("configuracoes").select("escola_logo_url").eq("id", true).maybeSingle(),
  ]);
  const textoTermoMenor = termoMenor?.conteudo?.trim()
    ? textoPlanoDoTermo(termoMenor.conteudo)
    : TEXTO_TERMO_MENOR_PADRAO;

  return (
    <main className="dark bg-background text-foreground min-h-svh p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8">
        {configuracoes?.escola_logo_url && (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- URL externa (Storage), fora do domínio otimizado pelo next/image sem configurar remotePatterns */}
            <img src={configuracoes.escola_logo_url} alt="Gênezi" className="h-14 w-auto" />
          </div>
        )}
        <div className="text-center">
          <h1 className="text-2xl font-bold">Gênezi Conecta — Acesso ao Portal de Empregos</h1>
          <p className="text-muted-foreground text-sm">Fique visível para empresas da região</p>
        </div>

        <ConectaCadastroExternoForm textoTermoMenor={textoTermoMenor} planoInicial={planoValido(plano)} />

        <div className="flex flex-col gap-4">
          <h2 className="text-center text-lg font-semibold">Por que ser aluno da Gênezi?</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                <ShieldCheck className="text-primary size-6" />
                <p className="text-sm font-medium">Acesso GRATUITO ao portal</p>
                <p className="text-muted-foreground text-xs">Sem mensalidade</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                <GraduationCap className="text-primary size-6" />
                <p className="text-sm font-medium">Certificados reconhecidos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                <MapPin className="text-primary size-6" />
                <p className="text-sm font-medium">Aulas presenciais em Porto Real do Colégio - AL</p>
              </CardContent>
            </Card>
          </div>
          <Button variant="outline" className="mx-auto w-fit" nativeButton={false} render={<Link href="/captacao" />}>
            Conhecer os cursos
          </Button>
        </div>
      </div>
    </main>
  );
}
