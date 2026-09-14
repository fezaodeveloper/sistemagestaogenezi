"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { cadastrarCandidatoExterno, type CadastroCandidatoExternoState } from "@/app/conecta/cadastro/actions";
import { formatCpf, formatTelefone } from "@/lib/alunos/schema";
import {
  FORMA_PAGAMENTO_CONECTA_LABELS,
  FORMAS_PAGAMENTO_CONECTA,
  PLANO_CONECTA_INFO,
  PLANOS_CONECTA,
  type FormaPagamentoConecta,
  type PlanoConecta,
} from "@/lib/conecta/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Processando..." : "Acessar o portal →"}
    </Button>
  );
}

function PlanoCard({ plano, selecionado }: { plano: PlanoConecta; selecionado: boolean }) {
  const info = PLANO_CONECTA_INFO[plano];
  return (
    <Label
      htmlFor={`plano-${plano}`}
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-lg border p-4 transition-colors",
        selecionado ? "border-primary bg-primary/5" : "border-input",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{info.label}</span>
        <RadioGroupItem value={plano} id={`plano-${plano}`} />
      </div>
      <span className="text-2xl font-bold">
        R$ {info.valor.toFixed(2).replace(".", ",")}
        <span className="text-muted-foreground text-sm font-normal">/mês</span>
      </span>
      <span className="text-sm">{info.descricao}</span>
      <span className="text-muted-foreground text-xs">{info.beneficio}</span>
    </Label>
  );
}

export function ConectaCadastroExternoForm() {
  const [state, formAction] = useActionState<CadastroCandidatoExternoState, FormData>(
    cadastrarCandidatoExterno,
    undefined,
  );

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [plano, setPlano] = useState<PlanoConecta>("basico");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoConecta>("PIX");

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Escolha seu plano</h2>
            <RadioGroup
              name="plano"
              value={plano}
              onValueChange={(value) => setPlano(value as PlanoConecta)}
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {PLANOS_CONECTA.map((opcao) => (
                <PlanoCard key={opcao} plano={opcao} selecionado={plano === opcao} />
              ))}
            </RadioGroup>
          </div>

          <div className="flex flex-col gap-4 border-t pt-4">
            <h2 className="text-sm font-semibold">Seus dados</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="nome">Nome completo</Label>
                <Input id="nome" name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatTelefone(e.target.value))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Input
                  id="estado"
                  name="estado"
                  maxLength={2}
                  placeholder="UF"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t pt-4">
            <h2 className="text-sm font-semibold">Forma de pagamento</h2>
            <RadioGroup
              name="forma_pagamento"
              value={formaPagamento}
              onValueChange={(value) => setFormaPagamento(value as FormaPagamentoConecta)}
              className="grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {FORMAS_PAGAMENTO_CONECTA.map((opcao) => (
                <div key={opcao} className="flex items-center gap-2">
                  <RadioGroupItem value={opcao} id={`forma-${opcao}`} />
                  <Label htmlFor={`forma-${opcao}`} className="font-normal">
                    {FORMA_PAGAMENTO_CONECTA_LABELS[opcao]}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            💡 Alunos ativos da Gênezi têm acesso GRATUITO ao portal.{" "}
            <Link href="/captacao" className="underline underline-offset-2">
              Conheça nossos cursos →
            </Link>
          </div>

          {state?.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}

          <SubmitButton />
        </form>

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Já tem conta?{" "}
          <Link href="/entrar" className="text-foreground underline underline-offset-2">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
