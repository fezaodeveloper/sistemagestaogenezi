import Link from "next/link";
import { GraduationCap, MapPin, ShieldCheck } from "lucide-react";
import { getTermoLegalPublico, textoPlanoDoTermo } from "@/lib/termos-legais/get-termo";
import { ConectaCadastroExternoForm } from "@/components/conecta/cadastro-externo-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const TEXTO_TERMO_MENOR_PADRAO =
  "Declaro que serei acompanhado por um dos meus pais ou responsável legal em qualquer entrevista de emprego.";

// Pública de propósito — cadastro de candidato externo não exige login
// prévio (REGRA da tarefa). Sem requireRole aqui.
export default async function ConectaCadastroPage() {
  // conecta_menor_termo é editável em /admin/conecta/termos — texto do checkbox de
  // acompanhamento exibido a candidatos de 16-17 anos (ver TAREFA de proteção de idade).
  const termoMenor = await getTermoLegalPublico("conecta_menor_termo");
  const textoTermoMenor = termoMenor?.conteudo?.trim()
    ? textoPlanoDoTermo(termoMenor.conteudo)
    : TEXTO_TERMO_MENOR_PADRAO;

  return (
    <main className="dark bg-background text-foreground min-h-svh p-6">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Gênezi Conecta — Acesso ao Portal de Empregos</h1>
          <p className="text-muted-foreground text-sm">Fique visível para empresas da região</p>
        </div>

        <ConectaCadastroExternoForm textoTermoMenor={textoTermoMenor} />

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
                <p className="text-sm font-medium">Aulas presenciais em Propriá/SE</p>
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
