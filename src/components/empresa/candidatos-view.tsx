"use client";

import { useState, useTransition } from "react";
import { FileText, MessageCircle, Search, User } from "lucide-react";
import { getUrlCurriculoCandidato } from "@/app/empresa/(protegido)/candidatos/actions";
import {
  DISPONIBILIDADE_LABELS,
  MODALIDADE_PREFERIDA_LABELS,
  type CandidatoConecta,
} from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function VerCurriculoButton({ path }: { path: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const resultado = await getUrlCurriculoCandidato(path);
      if (resultado.error || !resultado.url) {
        setError(resultado.error ?? "Não foi possível abrir o currículo.");
        return;
      }
      window.open(resultado.url, "_blank", "noreferrer");
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={handleClick}>
        <FileText className="size-4" />
        {isPending ? "Gerando link..." : "Ver currículo"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

function CandidatoCard({ candidato }: { candidato: CandidatoConecta }) {
  const whatsappDigitos = candidato.whatsapp?.replace(/\D/g, "");

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2">
          <div className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-full">
            <User className="text-muted-foreground size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{candidato.nome}</p>
            {(candidato.cidade || candidato.estado) && (
              <p className="text-muted-foreground truncate text-xs">
                {candidato.cidade ?? "—"}/{candidato.estado ?? "—"}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{DISPONIBILIDADE_LABELS[candidato.disponibilidade]}</Badge>
          <Badge variant="outline">{MODALIDADE_PREFERIDA_LABELS[candidato.modalidadePreferida]}</Badge>
        </div>

        {candidato.resumo && <p className="text-muted-foreground line-clamp-3 text-xs">{candidato.resumo}</p>}

        {candidato.cursosConcluidos.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-medium">Cursos concluídos na Gênezi:</span>
            <div className="flex flex-wrap gap-1">
              {candidato.cursosConcluidos.map((nome) => (
                <Badge key={nome} variant="secondary" className="text-xs">
                  {nome}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {whatsappDigitos && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              nativeButton={false}
              render={
                <a
                  href={`https://wa.me/55${whatsappDigitos}?text=${encodeURIComponent(
                    `Olá! Vi seu perfil no Gênezi Conecta e gostaria de conversar sobre oportunidades.`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <MessageCircle className="size-4" />
              Contato via WhatsApp
            </Button>
          )}
          {candidato.curriculoPath && <VerCurriculoButton path={candidato.curriculoPath} />}
        </div>
      </CardContent>
    </Card>
  );
}

export function CandidatosView({ candidatosIniciais }: { candidatosIniciais: CandidatoConecta[] }) {
  const [busca, setBusca] = useState("");

  const candidatosFiltrados = candidatosIniciais.filter((candidato) =>
    candidato.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="pl-9"
        />
      </div>

      {candidatosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {candidatosIniciais.length === 0
              ? "Nenhum candidato com perfil visível no momento."
              : "Nenhum candidato encontrado."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {candidatosFiltrados.map((candidato) => (
            <CandidatoCard key={candidato.id} candidato={candidato} />
          ))}
        </div>
      )}
    </div>
  );
}
