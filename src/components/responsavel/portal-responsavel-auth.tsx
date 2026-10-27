"use client";

// "use client": CPF+senha controlados + submissão via Server Action. Estado de autenticação
// vive só em useState (memória do componente) — SEM sessionStorage/localStorage/cookie de
// propósito (restrição da tarefa): fechar/recarregar a aba, ou clicar em "Sair", exige entrar
// de novo com CPF + senha.
//
// Sem alunoId/nomeAluno como prop (diferente da versão antiga, que vinha da URL
// /responsavel/[alunoId]): agora o(s) aluno(s) só são conhecidos DEPOIS do login, por
// autenticarResponsavelGlobal(), que varre responsaveis.cpf em busca de quem digitou — podem vir
// vários filhos (um responsável pode ter várias linhas em responsaveis, uma por filho).

import { useState, useTransition, type FormEvent } from "react";
import { autenticarResponsavelGlobal, type DadosResponsavelLogado } from "@/app/responsavel/actions";
import { SeletorFilhoResponsavel } from "@/components/responsavel/seletor-filho-responsavel";
import { PortalResponsavelDashboard } from "@/components/responsavel/portal-responsavel-dashboard";
import { CpfInput, cpfCompleto } from "@/components/ui/cpf-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PortalResponsavelAuth({
  escolaNome,
  escolaLogoUrl,
}: {
  escolaNome: string | null;
  escolaLogoUrl: string | null;
}) {
  const [sessao, setSessao] = useState<DadosResponsavelLogado | null>(null);
  // null = ainda não escolheu (mostra seletor, só relevante com 2+ filhos) — com 1 filho só,
  // já entra pré-selecionado direto no login validado com sucesso, pulando o seletor.
  const [alunoIdSelecionado, setAlunoIdSelecionado] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    startTransition(async () => {
      const resultado = await autenticarResponsavelGlobal(cpf, senha);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setSessao(resultado);
      setAlunoIdSelecionado(resultado.filhos.length === 1 ? resultado.filhos[0].alunoId : null);
    });
  }

  // "Sair": zera toda a sessão em memória e volta pra tela de CPF+senha — sem confirmação
  // (ação reversível, basta entrar de novo).
  function handleSair() {
    setSessao(null);
    setAlunoIdSelecionado(null);
    setCpf("");
    setSenha("");
  }

  if (sessao && alunoIdSelecionado) {
    return (
      <PortalResponsavelDashboard
        alunoId={alunoIdSelecionado}
        responsavel={sessao}
        onTrocarFilho={setAlunoIdSelecionado}
        // Botão "← Ver outros filhos" só faz sentido quando existe mais de um — com filho único,
        // não há pra onde voltar (voltaria pro mesmo filho de novo).
        onVoltarSeletor={sessao.filhos.length > 1 ? () => setAlunoIdSelecionado(null) : null}
        onSair={handleSair}
      />
    );
  }

  if (sessao) {
    return (
      <SeletorFilhoResponsavel
        nomeResponsavel={sessao.nomeResponsavel}
        filhos={sessao.filhos}
        onSelecionar={setAlunoIdSelecionado}
        onSair={handleSair}
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="senha_responsavel">Senha</Label>
                <Input
                  id="senha_responsavel"
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  placeholder="000000"
                  value={senha}
                  onChange={(event) => setSenha(event.target.value)}
                  className="text-center"
                  required
                />
              </div>
              {erro && (
                <p role="alert" className="text-destructive text-center text-sm">
                  {erro}
                </p>
              )}
              <Button type="submit" disabled={isPending || !cpfCompleto(cpf) || senha.trim().length === 0}>
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
