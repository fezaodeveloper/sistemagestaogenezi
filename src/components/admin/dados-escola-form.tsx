"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { salvarDadosEscola, type EscolaFormState } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCep, formatTelefone } from "@/lib/alunos/schema";
import { formatCnpj } from "@/lib/configuracoes/schema";
import type { ConfiguracoesEscola } from "@/lib/configuracoes/schema";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} size="sm">
      {pending ? "Salvando..." : "Salvar dados da escola"}
    </Button>
  );
}

type ViaCepResponse = { logradouro?: string; localidade?: string; uf?: string; erro?: boolean };

export function DadosEscolaForm({ defaultValues }: { defaultValues: ConfiguracoesEscola }) {
  const [state, formAction] = useActionState<EscolaFormState, FormData>(salvarDadosEscola, undefined);
  const values = state?.values ?? {
    escola_nome: defaultValues.escola_nome ?? "",
    escola_cnpj: defaultValues.escola_cnpj ?? "",
    escola_telefone: defaultValues.escola_telefone ?? "",
    escola_email: defaultValues.escola_email ?? "",
    escola_site: defaultValues.escola_site ?? "",
    escola_endereco: defaultValues.escola_endereco ?? "",
    escola_cep: defaultValues.escola_cep ?? "",
    escola_cidade: defaultValues.escola_cidade ?? "",
    escola_estado: defaultValues.escola_estado ?? "",
  };

  const [cnpj, setCnpj] = useState(formatCnpj(values.escola_cnpj));
  const [telefone, setTelefone] = useState(formatTelefone(values.escola_telefone));
  const [cep, setCep] = useState(formatCep(values.escola_cep));
  const [cidade, setCidade] = useState(values.escola_cidade);
  const [estado, setEstado] = useState(values.escola_estado);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);

  // Mesmo comportamento do CEP nos formulários de aluno: busca assim que o
  // CEP tiver 8 dígitos, preenche cidade/estado, mas continua editável.
  useEffect(() => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuscandoCep(true);
    setErroCep(null);

    fetch(`https://viacep.com.br/ws/${digits}/json/`)
      .then((response) => response.json())
      .then((data: ViaCepResponse) => {
        if (cancelado) return;
        if (data.erro) {
          setErroCep("CEP não encontrado.");
          return;
        }
        setCidade(data.localidade ?? "");
        setEstado(data.uf ?? "");
      })
      .catch(() => {
        if (!cancelado) setErroCep("Não foi possível buscar o CEP agora.");
      })
      .finally(() => {
        if (!cancelado) setBuscandoCep(false);
      });

    return () => {
      cancelado = true;
    };
  }, [cep]);

  return (
    <form key={JSON.stringify(state?.values)} action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="escola_nome">Nome da escola</Label>
        <Input id="escola_nome" name="escola_nome" defaultValue={values.escola_nome} required />
        {state?.errors?.escola_nome && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.escola_nome[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="escola_cnpj">CNPJ</Label>
          <Input
            id="escola_cnpj"
            name="escola_cnpj"
            value={cnpj}
            onChange={(e) => setCnpj(formatCnpj(e.target.value))}
            placeholder="00.000.000/0000-00"
          />
          {state?.errors?.escola_cnpj && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.escola_cnpj[0]}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="escola_telefone">Telefone</Label>
          <Input
            id="escola_telefone"
            name="escola_telefone"
            value={telefone}
            onChange={(e) => setTelefone(formatTelefone(e.target.value))}
            placeholder="(00) 00000-0000"
          />
          {state?.errors?.escola_telefone && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.escola_telefone[0]}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="escola_email">E-mail institucional</Label>
          <Input id="escola_email" name="escola_email" type="email" defaultValue={values.escola_email} />
          {state?.errors?.escola_email && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.escola_email[0]}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="escola_site">Site</Label>
          <Input
            id="escola_site"
            name="escola_site"
            defaultValue={values.escola_site}
            placeholder="https://..."
          />
          {state?.errors?.escola_site && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.escola_site[0]}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="escola_endereco">Endereço (rua, número)</Label>
        <Input id="escola_endereco" name="escola_endereco" defaultValue={values.escola_endereco} />
        {state?.errors?.escola_endereco && (
          <p role="alert" className="text-destructive text-sm">
            {state.errors.escola_endereco[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="escola_cep">CEP</Label>
          <Input
            id="escola_cep"
            name="escola_cep"
            value={cep}
            onChange={(e) => setCep(formatCep(e.target.value))}
            placeholder="00000-000"
          />
          {buscandoCep && <p className="text-muted-foreground text-xs">Buscando...</p>}
          {erroCep && cep.replace(/\D/g, "").length === 8 && (
            <p className="text-muted-foreground text-xs">{erroCep}</p>
          )}
          {state?.errors?.escola_cep && (
            <p role="alert" className="text-destructive text-sm">
              {state.errors.escola_cep[0]}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="escola_cidade">Cidade</Label>
          <Input
            id="escola_cidade"
            name="escola_cidade"
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="escola_estado">Estado</Label>
          <Input
            id="escola_estado"
            name="escola_estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value.toUpperCase())}
            maxLength={2}
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        {state?.salvo && !state.error && <span className="text-muted-foreground text-sm">Salvo.</span>}
      </div>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
