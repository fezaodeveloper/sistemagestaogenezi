import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, ExternalLink, MapPin, MessageCircle } from "lucide-react";
import { getEmpresaPublicaConecta, getVagasAtivasDaEmpresaPublica } from "@/lib/conecta/publico";
import { VAGA_MODALIDADE_LABELS, VAGA_TIPO_LABELS } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Pública de propósito, sem requireRole (REGRA da tarefa) — útil pra
// empresa compartilhar o link do próprio perfil. getEmpresaPublicaConecta
// já filtra status = 'ativa' — empresa pendente/suspensa/cancelada cai em
// notFound() abaixo, sem vazar dado de empresa fora do ar.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const empresa = await getEmpresaPublicaConecta(id);

  if (!empresa) {
    return { title: "Empresa não encontrada — Gênezi Conecta" };
  }

  return {
    title: `${empresa.nome_empresa} — Gênezi Conecta`,
    description: empresa.descricao ?? `Vagas de emprego e estágio em ${empresa.nome_empresa}.`,
    openGraph: {
      title: `${empresa.nome_empresa} — Gênezi Conecta`,
      description: empresa.descricao ?? `Vagas de emprego e estágio em ${empresa.nome_empresa}.`,
      type: "website",
    },
  };
}

export default async function ConectaEmpresaPublicaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const empresa = await getEmpresaPublicaConecta(id);
  if (!empresa) {
    notFound();
  }

  const vagas = await getVagasAtivasDaEmpresaPublica(empresa.id);
  const whatsappDigitos = empresa.whatsapp?.replace(/\D/g, "");

  return (
    <main className="dark bg-background text-foreground min-h-svh">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          {empresa.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
            <img src={empresa.logo_url} alt={empresa.nome_empresa} className="size-20 rounded-2xl border object-contain" />
          ) : (
            <div className="bg-muted flex size-20 items-center justify-center rounded-2xl">
              <Building2 className="text-muted-foreground size-8" />
            </div>
          )}
          <h1 className="text-2xl font-bold">{empresa.nome_empresa}</h1>
          <div className="text-muted-foreground flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
            {empresa.setor && <span>{empresa.setor}</span>}
            {(empresa.cidade || empresa.estado) && (
              <span>
                {empresa.cidade ?? "—"}/{empresa.estado ?? "—"}
              </span>
            )}
          </div>
          {empresa.endereco && (
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-3.5 shrink-0" />
              {empresa.endereco}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            {empresa.link_maps && (
              <a
                href={empresa.link_maps}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
              >
                <MapPin className="size-3.5" />
                Ver no Google Maps
              </a>
            )}
            {empresa.site && (
              <a
                href={empresa.site}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs underline underline-offset-2"
              >
                <ExternalLink className="size-3.5" />
                Site da empresa
              </a>
            )}
          </div>
        </div>

        {empresa.descricao && (
          <Card>
            <CardContent className="py-4 text-sm">
              <p className="mb-1 font-medium">Sobre a empresa</p>
              <p className="text-muted-foreground whitespace-pre-line">{empresa.descricao}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Vagas abertas</h2>
          {vagas.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                Nenhuma vaga aberta no momento nesta empresa.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {vagas.map((vaga) => {
                const mensagem = encodeURIComponent(
                  `Olá! Vi a vaga de ${vaga.titulo} no Gênezi Conecta e tenho interesse.`,
                );
                return (
                  <Card key={vaga.id}>
                    <CardContent className="flex flex-col gap-3 py-4">
                      <div>
                        <h3 className="font-semibold">{vaga.titulo}</h3>
                        <div className="text-muted-foreground mt-1 flex flex-wrap gap-1.5">
                          <Badge variant="outline">{VAGA_TIPO_LABELS[vaga.tipo]}</Badge>
                          <Badge variant="outline">{VAGA_MODALIDADE_LABELS[vaga.modalidade]}</Badge>
                          <span className="text-xs">
                            {vaga.cidade}/{vaga.estado}
                          </span>
                        </div>
                      </div>
                      {whatsappDigitos ? (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          nativeButton={false}
                          render={
                            <a
                              href={`https://wa.me/55${whatsappDigitos}?text=${mensagem}`}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          <MessageCircle className="size-4" />
                          Candidatar
                        </Button>
                      ) : (
                        <Button disabled title="Empresa não informou WhatsApp para contato." className="w-full">
                          <MessageCircle className="size-4" />
                          Candidatar
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-muted/50 flex flex-col items-center gap-3 rounded-lg p-6 text-center">
          <p className="font-medium">Trabalhe conosco — veja todas as vagas</p>
          <Button render={<Link href="/conecta/vagas" />} nativeButton={false}>
            Ver todas as vagas no Gênezi Conecta →
          </Button>
        </div>
      </div>
    </main>
  );
}
