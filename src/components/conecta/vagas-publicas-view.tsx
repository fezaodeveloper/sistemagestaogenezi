"use client";

// "use client": busca filtra os cards de cidade em tempo real (useState) e o clique num card
// abre o popup de 3 opções (useState) — tudo client-side, sem nova requisição (REGRA da tarefa).

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import {
  PLANOS_CONECTA_ATIVOS,
  PLANO_CONECTA_INFO,
  VALOR_ASSINATURA_EMPRESA,
  type CidadeConectaComContagem,
  type PlanoConecta,
} from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConectaHeader } from "@/components/conecta/conecta-header";
import { ConectaCidadePopup } from "@/components/conecta/conecta-cidade-popup";
import { ConectaFaq } from "@/components/conecta/conecta-faq";
import { ConectaWhatsappFlutuante } from "@/components/conecta/conecta-whatsapp-flutuante";

function PlanoPublicoCard({ plano }: { plano: PlanoConecta }) {
  const info = PLANO_CONECTA_INFO[plano];
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-6 text-center">
        <span className="text-primary text-sm font-semibold uppercase">Candidato</span>
        <span className="text-2xl font-bold">
          R$ {info.valor.toFixed(2).replace(".", ",")}
          <span className="text-muted-foreground text-sm font-normal">/ano</span>
        </span>
        <p className="text-muted-foreground text-sm">{info.descricao}</p>
        <Button nativeButton={false} render={<Link href="/conecta/cadastro" />} className="mt-2">
          Assinar
        </Button>
      </CardContent>
    </Card>
  );
}

// TAREFA: empresa deixou de ser gratuita, agora paga R$ 29,90/ano — card análogo ao do
// candidato (PlanoPublicoCard), mas sem Record de planos (só existe uma oferta de empresa).
function EmpresaPublicoCard() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 py-6 text-center">
        <span className="text-primary text-sm font-semibold uppercase">Empresa</span>
        <span className="text-2xl font-bold">
          R$ {VALOR_ASSINATURA_EMPRESA.toFixed(2).replace(".", ",")}
          <span className="text-muted-foreground text-sm font-normal">/ano</span>
        </span>
        <p className="text-muted-foreground text-sm">Publique vagas por 1 ano</p>
        <Button nativeButton={false} render={<Link href="/empresa/cadastro" />} className="mt-2">
          Cadastrar empresa
        </Button>
      </CardContent>
    </Card>
  );
}

const COMO_FUNCIONA_ITENS = [
  { emoji: "🎓", titulo: "Alunos Gênezi", texto: "Acesso gratuito. Acesse o portal do aluno e candidate-se com seu perfil." },
  { emoji: "💼", titulo: "Candidatos externos", texto: "Assine o plano por R$ 9,90/ano para ficar visível às empresas parceiras." },
  { emoji: "🏢", titulo: "Empresas", texto: "Assine por R$ 29,90/ano para publicar vagas na plataforma." },
] as const;

function CidadeCard({ cidade, onClick }: { cidade: CidadeConectaComContagem; onClick: () => void }) {
  const semVagas = cidade.totalVagas === 0;
  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className={`h-full transition hover:scale-[1.02] hover:shadow-lg ${semVagas ? "opacity-60" : ""}`}>
        <CardContent className="flex flex-col gap-2 py-5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 font-semibold">
              <MapPin className="text-primary size-4 shrink-0" />
              {cidade.nome}
            </span>
            <Badge variant="outline">{cidade.estado}</Badge>
          </div>
          <p className={`text-sm ${semVagas ? "text-muted-foreground" : "text-primary font-medium"}`}>
            {cidade.totalVagas} vaga{cidade.totalVagas === 1 ? "" : "s"} disponíve
            {cidade.totalVagas === 1 ? "l" : "is"}
          </p>
        </CardContent>
      </Card>
    </button>
  );
}

export function ConectaVagasPublicasView({
  logoUrl,
  cidades,
  whatsappEscolaDigitos,
}: {
  logoUrl: string | null;
  cidades: CidadeConectaComContagem[];
  whatsappEscolaDigitos: string | null;
}) {
  const [busca, setBusca] = useState("");
  const [cidadeSelecionada, setCidadeSelecionada] = useState<string | null>(null);

  const cidadesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return cidades;
    return cidades.filter(
      (cidade) => cidade.nome.toLowerCase().includes(termo) || cidade.estado.toLowerCase().includes(termo),
    );
  }, [busca, cidades]);

  return (
    <main className="dark bg-background text-foreground min-h-svh">
      <ConectaHeader logoUrl={logoUrl} whatsappEscolaDigitos={whatsappEscolaDigitos} />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14 p-6 pt-24 pb-16">
        <section className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">Encontre sua oportunidade</h1>
          <p className="text-muted-foreground max-w-xl text-sm sm:text-base">
            Vagas de emprego e estágio de empresas parceiras da Gênezi, perto de você.
          </p>
          <div className="relative w-full max-w-md">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por cidade ou estado..."
              className="pl-9"
            />
          </div>
        </section>

        <section id="planos" className="flex flex-col gap-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Candidatos e empresas</h2>
            <p className="text-muted-foreground text-sm">Para quem não é aluno da Gênezi.</p>
          </div>
          <div className="mx-auto grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            {PLANOS_CONECTA_ATIVOS.map((plano) => (
              <PlanoPublicoCard key={plano} plano={plano} />
            ))}
            <EmpresaPublicoCard />
          </div>
          <p className="text-muted-foreground text-center text-sm">
            Aluno da Gênezi?{" "}
            <Link href="/aluno/conecta" className="text-foreground underline underline-offset-2">
              Acesso gratuito →
            </Link>
          </p>
        </section>

        <section id="cidades" className="flex flex-col gap-4">
          {cidadesFiltradas.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                Nenhuma cidade encontrada para &quot;{busca}&quot;.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {cidadesFiltradas.map((cidade) => (
                <CidadeCard key={cidade.id} cidade={cidade} onClick={() => setCidadeSelecionada(cidade.nome)} />
              ))}
            </div>
          )}
        </section>

        <section id="como-funciona" className="flex flex-col gap-6 border-t pt-10">
          <h2 className="text-center text-2xl font-bold">Como funciona</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {COMO_FUNCIONA_ITENS.map((item) => (
              <Card key={item.titulo}>
                <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                  <span className="text-2xl">{item.emoji}</span>
                  <p className="font-medium">{item.titulo}</p>
                  <p className="text-muted-foreground text-sm">{item.texto}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="faq" className="flex flex-col gap-4 border-t pt-10">
          <h2 className="text-center text-2xl font-bold">Perguntas frequentes</h2>
          <ConectaFaq />
        </section>

        <footer className="flex flex-col items-center gap-3 border-t pt-8 text-center">
          <p className="text-muted-foreground text-sm">Escola Gênezi — Propriá/SE</p>
          <div className="text-muted-foreground flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/conecta/termos-de-uso" className="underline underline-offset-2">
              Termos de Uso
            </Link>
            <Link href="/conecta/privacidade" className="underline underline-offset-2">
              Política de Privacidade
            </Link>
            <Link href="/conecta/cookies" className="underline underline-offset-2">
              Política de Cookies
            </Link>
            <Link href="/conecta/lgpd" className="underline underline-offset-2">
              LGPD
            </Link>
          </div>
        </footer>
      </div>

      <ConectaCidadePopup
        cidade={cidadeSelecionada}
        onOpenChange={(open) => {
          if (!open) setCidadeSelecionada(null);
        }}
        whatsappEscolaDigitos={whatsappEscolaDigitos}
      />

      <ConectaWhatsappFlutuante whatsappEscolaDigitos={whatsappEscolaDigitos} />
    </main>
  );
}
