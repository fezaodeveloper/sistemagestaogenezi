"use client";

import { LogOut, User } from "lucide-react";
import type { FilhoResponsavel } from "@/app/responsavel/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Só aparece quando o CPF tem 2+ filhos vinculados (ver PortalResponsavelAuth) — com 1 filho só,
// o fluxo pula direto pro dashboard. Fundo escuro igual ao portal do aluno (ver layout.tsx),
// aplicado aqui via a mesma classe "dark" do Tailwind — o resto (cores de Card, texto) já vem
// das variáveis de tema, sem precisar repetir cor por cor.
export function SeletorFilhoResponsavel({
  nomeResponsavel,
  filhos,
  onSelecionar,
  onSair,
}: {
  nomeResponsavel: string;
  filhos: FilhoResponsavel[];
  onSelecionar: (alunoId: string) => void;
  onSair: () => void;
}) {
  return (
    <div className="dark bg-background text-foreground min-h-screen px-4 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Portal do Responsável</h1>
            <p className="text-muted-foreground text-sm">
              Olá, {nomeResponsavel}. Escolha o aluno que deseja acompanhar.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onSair}>
            <LogOut className="size-4" />
            Sair
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filhos.map((filho) => (
            <button key={filho.alunoId} type="button" onClick={() => onSelecionar(filho.alunoId)} className="text-left">
              <Card className="transition hover:scale-[1.02] hover:shadow-lg">
                <CardContent className="flex items-center gap-3 py-5">
                  {filho.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- foto do aluno em bucket público
                    <img src={filho.fotoUrl} alt={filho.nomeAluno ?? "Aluno"} className="size-12 rounded-full object-cover" />
                  ) : (
                    <div className="bg-muted flex size-12 items-center justify-center rounded-full">
                      <User className="text-muted-foreground size-6" />
                    </div>
                  )}
                  <span className="font-medium">{filho.nomeAluno ?? "Aluno"}</span>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
