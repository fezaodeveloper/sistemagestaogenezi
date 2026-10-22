"use client";

// "use client": input de CPF controlado + submissão via Server Action com feedback de
// sucesso/erro. O resto da página (dados do aluno/curso, preview do PDF) fica no Server
// Component pai (page.tsx) — só a parte interativa vive aqui, convenção padrão do projeto.

import { useEffect, useState, useTransition, type FormEvent } from "react";
import {
  assinarContratoPorCpf,
  getConteudoTermoImagem,
  verificarTermoImagemAssinado,
} from "@/app/contrato/[matriculaId]/actions";
import { TermoImagemAssinarForm } from "@/components/termo-imagem/termo-imagem-assinar-form";
import { CpfInput, cpfCompleto } from "@/components/ui/cpf-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { TermoLegal } from "@/lib/termos-legais/schema";

export function ContratoAssinarForm({
  matriculaId,
  precisaResponsavel,
}: {
  matriculaId: string;
  precisaResponsavel: boolean;
}) {
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  // null enquanto verifica (logo depois de assinar o contrato); true/false = resultado real.
  const [termoJaAssinado, setTermoJaAssinado] = useState<boolean | null>(null);
  // Texto do termo pra exibição ANTES da assinatura (mesmo conteúdo que /termo-imagem/
  // [matriculaId]/assinar mostraria) — buscado junto, só é de fato usado se termoJaAssinado
  // vier false.
  const [termoConteudo, setTermoConteudo] = useState<TermoLegal | null>(null);
  const [isPending, startTransition] = useTransition();

  // Fluxo sequencial: assina contrato → assina Termo de Imagem, sem sair desta página. Checa só
  // depois de "sucesso" virar true (não precisa verificar antes de o contrato estar assinado).
  useEffect(() => {
    if (!sucesso) return;
    let cancelado = false;
    Promise.all([verificarTermoImagemAssinado(matriculaId), getConteudoTermoImagem(matriculaId)]).then(
      ([assinado, termo]) => {
        if (cancelado) return;
        setTermoJaAssinado(assinado);
        setTermoConteudo(termo);
      },
    );
    return () => {
      cancelado = true;
    };
  }, [sucesso, matriculaId]);

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    startTransition(async () => {
      const resultado = await assinarContratoPorCpf(matriculaId, cpf);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setSucesso(true);
    });
  }

  if (sucesso) {
    const botaoPdfContrato = (
      <Button
        render={<a href={`/api/contratos/${matriculaId}/pdf`} target="_blank" rel="noopener noreferrer" />}
        nativeButton={false}
        variant={termoJaAssinado === false ? "outline" : undefined}
      >
        Baixar PDF do contrato
      </Button>
    );

    // Termo ainda pendente: mostra o formulário dele embaixo do aviso de contrato assinado, na
    // mesma página (TermoImagemAssinarForm já mostra sua própria confirmação ao ser assinado).
    if (termoJaAssinado === false) {
      return (
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-lg font-medium">✅ Contrato assinado com sucesso!</p>
              {botaoPdfContrato}
            </CardContent>
          </Card>
          <h2 className="text-lg font-semibold">Agora assine o Termo de Uso de Imagem</h2>
          <TermoImagemAssinarForm
            matriculaId={matriculaId}
            precisaResponsavel={precisaResponsavel}
            termo={termoConteudo}
          />
        </div>
      );
    }

    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-lg font-medium">
            {termoJaAssinado === true ? "✅ Contrato e Termo de Imagem já assinados." : "✅ Contrato assinado com sucesso!"}
          </p>
          {botaoPdfContrato}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cpf_assinatura">
              {precisaResponsavel ? "Digite o CPF do responsável" : "Digite seu CPF"}
            </Label>
            <CpfInput id="cpf_assinatura" value={cpf} onValueChange={setCpf} required />
          </div>
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
          <Button type="submit" disabled={isPending || !cpfCompleto(cpf)}>
            {isPending ? "Assinando..." : "Assinar Contrato"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
