"use client";

// "use client": CPF controlado + submissão via Server Action. Estado de autenticação vive só
// em useState (memória do componente) — SEM sessionStorage/localStorage de propósito (restrição
// da tarefa): fechar/recarregar a aba exige digitar o CPF de novo.
//
// Sem alunoId/nomeAluno como prop (diferente da versão anterior, que vinha da URL
// /responsavel/[alunoId]): agora o(s) aluno(s) só são conhecidos DEPOIS que o CPF é validado por
// validarCpfResponsavelGlobal(), que varre responsaveis.cpf inteira em busca de quem digitou —
// podem vir vários (um responsável pode ter várias linhas em responsaveis, uma por filho).

import { useState, useTransition, type FormEvent } from "react";
import { validarCpfResponsavelGlobal, type FilhoResponsavel } from "@/app/responsavel/actions";
import { SeletorFilhoResponsavel } from "@/components/responsavel/seletor-filho-responsavel";
import { PortalResponsavelDashboard } from "@/components/responsavel/portal-responsavel-dashboard";
import { CpfInput, cpfCompleto } from "@/components/ui/cpf-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export function PortalResponsavelAuth({
  escolaNome,
  escolaLogoUrl,
}: {
  escolaNome: string | null;
  escolaLogoUrl: string | null;
}) {
  const [sessao, setSessao] = useState<{ nomeResponsavel: string; filhos: FilhoResponsavel[] } | null>(null);
  // null = ainda não escolheu (mostra seletor, só relevante com 2+ filhos) — com 1 filho só,
  // já entra pré-selecionado direto no CPF validado com sucesso, pulando o seletor.
  const [alunoIdSelecionado, setAlunoIdSelecionado] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    startTransition(async () => {
      const resultado = await validarCpfResponsavelGlobal(cpf);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setSessao(resultado);
      setAlunoIdSelecionado(resultado.filhos.length === 1 ? resultado.filhos[0].alunoId : null);
    });
  }

  if (sessao && alunoIdSelecionado) {
    return (
      <PortalResponsavelDashboard
        alunoId={alunoIdSelecionado}
        nomeResponsavel={sessao.nomeResponsavel}
        filhos={sessao.filhos}
        onTrocarFilho={setAlunoIdSelecionado}
        // Botão "← Ver outros filhos" só faz sentido quando existe mais de um — com filho único,
        // não há pra onde voltar (voltaria pro mesmo filho de novo).
        onVoltarSeletor={sessao.filhos.length > 1 ? () => setAlunoIdSelecionado(null) : null}
      />
    );
  }

  if (sessao) {
    return (
      <SeletorFilhoResponsavel
        nomeResponsavel={sessao.nomeResponsavel}
        filhos={sessao.filhos}
        onSelecionar={setAlunoIdSelecionado}
      />
    );
  }

  return (
    <div className="dark bg-background text-foreground flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {escolaLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo em bucket público
          <img src={escolaLogoUrl} alt={escolaNome ?? "Logo da escola"} className="h-16 w-auto object-contain" />
        ) : (
          <span className="text-xl font-semibold">{escolaNome ?? "GÊNEZI Educação"}</span>
        )}

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold">Portal do Responsável</h1>
          <p className="text-muted-foreground text-sm">Acompanhe o desenvolvimento do seu filho(a)</p>
        </div>

        <Card className="w-full bg-white/5">
          <CardContent className="py-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cpf_responsavel">CPF do responsável</Label>
                <CpfInput id="cpf_responsavel" value={cpf} onValueChange={setCpf} required className="text-center" />
              </div>
              {erro && (
                <p role="alert" className="text-destructive text-center text-sm">
                  {erro}
                </p>
              )}
              <Button type="submit" disabled={isPending || !cpfCompleto(cpf)}>
                {isPending ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-muted-foreground text-xs">{escolaNome ?? "GÊNEZI Educação"}</p>
      </div>
    </div>
  );
}
