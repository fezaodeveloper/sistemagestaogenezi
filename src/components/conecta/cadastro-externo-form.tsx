"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { cadastrarCandidatoExterno, type CadastroCandidatoExternoState } from "@/app/conecta/cadastro/actions";
import { calculateAge } from "@/lib/alunos/schema";
import { UFS_BRASIL, type UfBrasil } from "@/lib/campanha-paginas/schema";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CpfInput } from "@/components/ui/cpf-input";
import { TelefoneInput } from "@/components/ui/telefone-input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const UF_ITEMS = Object.fromEntries(UFS_BRASIL.map((uf) => [uf, uf]));

const IDADE_MINIMA = 16;

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="w-full">
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

export function ConectaCadastroExternoForm({
  textoTermoMenor,
  planoInicial,
}: {
  textoTermoMenor: string;
  planoInicial?: PlanoConecta;
}) {
  const [state, formAction] = useActionState<CadastroCandidatoExternoState, FormData>(
    cadastrarCandidatoExterno,
    undefined,
  );

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cpf, setCpf] = useState("");
  const [estado, setEstado] = useState<UfBrasil | "">("");
  const [cidade, setCidade] = useState("");
  const [municipiosCarregados, setMunicipiosCarregados] = useState<{ uf: UfBrasil; lista: readonly string[] } | null>(
    null,
  );
  const [plano, setPlano] = useState<PlanoConecta>(planoInicial ?? "basico");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoConecta>("PIX");
  const [termoAcompanhamento, setTermoAcompanhamento] = useState(false);

  // Município por UF — lista estática do IBGE (ver src/lib/ibge/municipios.ts), mesmo padrão já
  // usado no formulário público de campanha (src/components/campanha/campanha-publica-view.tsx):
  // import dinâmico porque o arquivo é grande (5571 municípios), só carrega quando alguém
  // escolhe um estado.
  useEffect(() => {
    if (!estado) return;
    let cancelado = false;
    import("@/lib/ibge/municipios").then(({ MUNICIPIOS_POR_UF }) => {
      if (!cancelado) setMunicipiosCarregados({ uf: estado, lista: MUNICIPIOS_POR_UF[estado] });
    });
    return () => {
      cancelado = true;
    };
  }, [estado]);

  const municipios = municipiosCarregados?.uf === estado ? municipiosCarregados.lista : [];
  const municipioItems = Object.fromEntries(municipios.map((municipio) => [municipio, municipio]));

  function escolherEstado(uf: string | null) {
    setEstado((uf ?? "") as UfBrasil | "");
    setCidade("");
  }

  // Feedback imediato no client (a validação de verdade é refeita no servidor, em
  // cadastrarCandidatoExterno — nunca confia só nesta checagem).
  const idade = dataNascimento ? calculateAge(dataNascimento) : null;
  const menorDe16 = idade !== null && idade < IDADE_MINIMA;
  const precisaTermo = idade !== null && idade >= IDADE_MINIMA && idade < 18;
  const podeSubmeter = !menorDe16 && (!precisaTermo || termoAcompanhamento);

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
                <Label htmlFor="data_nascimento">Data de nascimento</Label>
                <Input
                  id="data_nascimento"
                  name="data_nascimento"
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  required
                />
                {menorDe16 && (
                  <p className="text-destructive text-xs">
                    Você precisa ter no mínimo 16 anos para se cadastrar no Gênezi Conecta.
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <TelefoneInput id="whatsapp" name="whatsapp" value={whatsapp} onValueChange={setWhatsapp} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cpf">CPF *</Label>
                <CpfInput id="cpf" name="cpf" value={cpf} onValueChange={setCpf} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Select name="estado" items={UF_ITEMS} value={estado} onValueChange={escolherEstado}>
                  <SelectTrigger id="estado" className="w-full">
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS_BRASIL.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Select
                  name="cidade"
                  items={municipioItems}
                  value={cidade}
                  onValueChange={(valor) => setCidade(valor ?? "")}
                  disabled={!estado}
                >
                  <SelectTrigger id="cidade" className="w-full">
                    <SelectValue placeholder={estado ? "Selecione a cidade" : "Selecione o estado primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {municipios.map((municipio) => (
                      <SelectItem key={municipio} value={municipio}>
                        {municipio}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

          {precisaTermo && (
            <div className="flex items-start gap-2 border-t pt-4">
              <Checkbox
                id="termo_acompanhamento"
                checked={termoAcompanhamento}
                onCheckedChange={(checked) => setTermoAcompanhamento(checked === true)}
              />
              <Label htmlFor="termo_acompanhamento" className="font-normal text-sm">
                {textoTermoMenor}
              </Label>
              <input type="hidden" name="menor_com_termo" value={termoAcompanhamento ? "on" : ""} />
            </div>
          )}

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

          <SubmitButton disabled={!podeSubmeter} />
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
