"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCep,
  formatCpf,
  formatTelefone,
  isMinor,
  STATUS_ALUNO_LABELS,
  STATUS_ALUNO_VALUES,
} from "@/lib/alunos/schema";
import { createAluno, type AlunoFormState } from "@/app/admin/alunos/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Criando..." : "Criar aluno"}
    </Button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-muted-foreground border-b pb-1 text-sm font-semibold">{children}</h2>;
}

// Resposta do ViaCEP — só os campos que a gente usa (bairro/cidade/estado).
type ViaCepResponse = { bairro?: string; localidade?: string; uf?: string; erro?: boolean };

export function AlunoCreateForm() {
  const [state, formAction] = useActionState<AlunoFormState, FormData>(createAluno, undefined);
  const values = state && !state.success ? state.values : undefined;

  const [dataNascimento, setDataNascimento] = useState(values?.data_nascimento ?? "");
  const [cpf, setCpf] = useState(values?.cpf ? formatCpf(values.cpf) : "");
  const [telefone, setTelefone] = useState(values?.telefone ? formatTelefone(values.telefone) : "");
  const [cep, setCep] = useState(values?.cep ? formatCep(values.cep) : "");
  const [bairro, setBairro] = useState(values?.bairro ?? "");
  const [cidade, setCidade] = useState(values?.cidade ?? "");
  const [estado, setEstado] = useState(values?.estado ?? "");
  const [responsavelCpf, setResponsavelCpf] = useState(
    values?.responsavel_cpf ? formatCpf(values.responsavel_cpf) : "",
  );
  const [responsavelTelefone, setResponsavelTelefone] = useState(
    values?.responsavel_telefone ? formatTelefone(values.responsavel_telefone) : "",
  );
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState<string | null>(null);

  const menorDeIdade = dataNascimento ? isMinor(dataNascimento) : false;

  // Dispara a busca assim que o CEP tiver 8 dígitos. Os campos continuam
  // editáveis depois de preenchidos — é só um ponto de partida, não um
  // valor travado, já que o ViaCEP pode não ter (ou ter errado) o bairro.
  useEffect(() => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    let cancelado = false;
    // Indicador de carregamento pro fetch abaixo — padrão de efeito com
    // side-effect real (chamada de rede), não estado derivado de props.
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
        setBairro(data.bairro ?? "");
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

  if (state?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aluno criado com sucesso</CardTitle>
          <CardDescription>
            Copie a senha temporária agora — ela não será exibida novamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="bg-muted rounded-md p-4 font-mono text-lg">{state.tempPassword}</div>
          <p className="text-muted-foreground text-sm">
            Para matricular o aluno em uma turma, use a ação &quot;Nova matrícula&quot; na tela
            dele.
          </p>
          <div>
            <Button render={<Link href="/admin/alunos" />} nativeButton={false}>
              Ir para a lista de alunos
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const errors = state && !state.success ? state.errors : undefined;
  const generalError = state && !state.success ? state.error : undefined;

  return (
    <form
      key={JSON.stringify(values)}
      action={formAction}
      className="flex max-w-2xl flex-col gap-6"
    >
      <div className="flex flex-col gap-4">
        <SectionTitle>Acesso ao sistema</SectionTitle>

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" defaultValue={values?.email} required />
          <p className="text-muted-foreground text-xs">
            Após o cadastro, uma senha temporária será exibida na tela para você repassar ao
            aluno.
          </p>
          {errors?.email && (
            <p role="alert" className="text-destructive text-sm">
              {errors.email[0]}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionTitle>Dados pessoais</SectionTitle>

        <div className="flex flex-col gap-2">
          <Label htmlFor="full_name">Nome completo</Label>
          <Input id="full_name" name="full_name" defaultValue={values?.full_name} required />
          {errors?.full_name && (
            <p role="alert" className="text-destructive text-sm">
              {errors.full_name[0]}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              name="cpf"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(event) => setCpf(formatCpf(event.target.value))}
              required
            />
            {errors?.cpf && (
              <p role="alert" className="text-destructive text-sm">
                {errors.cpf[0]}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              name="telefone"
              placeholder="(00) 00000-0000"
              value={telefone}
              onChange={(event) => setTelefone(formatTelefone(event.target.value))}
              required
            />
            {errors?.telefone && (
              <p role="alert" className="text-destructive text-sm">
                {errors.telefone[0]}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="data_nascimento">Data de nascimento</Label>
            <Input
              id="data_nascimento"
              name="data_nascimento"
              type="date"
              value={dataNascimento}
              onChange={(event) => setDataNascimento(event.target.value)}
              required
            />
            {errors?.data_nascimento && (
              <p role="alert" className="text-destructive text-sm">
                {errors.data_nascimento[0]}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="status_aluno">Status</Label>
            <Select
              name="status_aluno"
              items={STATUS_ALUNO_LABELS}
              defaultValue={values?.status_aluno || "ativo"}
            >
              <SelectTrigger id="status_aluno" className="w-full">
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ALUNO_VALUES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_ALUNO_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors?.status_aluno && (
              <p role="alert" className="text-destructive text-sm">
                {errors.status_aluno[0]}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SectionTitle>Endereço</SectionTitle>

        <div className="flex flex-col gap-2">
          <Label htmlFor="cep">CEP</Label>
          <Input
            id="cep"
            name="cep"
            placeholder="00000-000"
            value={cep}
            onChange={(event) => setCep(formatCep(event.target.value))}
            className="max-w-40"
          />
          {buscandoCep && <p className="text-muted-foreground text-xs">Buscando endereço...</p>}
          {erroCep && cep.replace(/\D/g, "").length === 8 && (
            <p className="text-muted-foreground text-xs">{erroCep}</p>
          )}
          {errors?.cep && (
            <p role="alert" className="text-destructive text-sm">
              {errors.cep[0]}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Textarea id="endereco" name="endereco" rows={2} defaultValue={values?.endereco} />
            {errors?.endereco && (
              <p role="alert" className="text-destructive text-sm">
                {errors.endereco[0]}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="numero">Número</Label>
            <Input id="numero" name="numero" defaultValue={values?.numero} />
            {errors?.numero && (
              <p role="alert" className="text-destructive text-sm">
                {errors.numero[0]}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="complemento">Complemento</Label>
            <Input id="complemento" name="complemento" defaultValue={values?.complemento} />
            {errors?.complemento && (
              <p role="alert" className="text-destructive text-sm">
                {errors.complemento[0]}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bairro">Bairro</Label>
            <Input
              id="bairro"
              name="bairro"
              value={bairro}
              onChange={(event) => setBairro(event.target.value)}
            />
            {errors?.bairro && (
              <p role="alert" className="text-destructive text-sm">
                {errors.bairro[0]}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cidade">Cidade</Label>
            <Input
              id="cidade"
              name="cidade"
              value={cidade}
              onChange={(event) => setCidade(event.target.value)}
            />
            {errors?.cidade && (
              <p role="alert" className="text-destructive text-sm">
                {errors.cidade[0]}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="estado">Estado</Label>
            <Input
              id="estado"
              name="estado"
              maxLength={2}
              value={estado}
              onChange={(event) => setEstado(event.target.value.toUpperCase())}
            />
            {errors?.estado && (
              <p role="alert" className="text-destructive text-sm">
                {errors.estado[0]}
              </p>
            )}
          </div>
        </div>
      </div>

      {menorDeIdade && (
        <div className="flex flex-col gap-4 rounded-md border p-4">
          <SectionTitle>Dados do responsável (aluno menor de idade)</SectionTitle>

          <div className="flex flex-col gap-2">
            <Label htmlFor="responsavel_nome">Nome do responsável</Label>
            <Input
              id="responsavel_nome"
              name="responsavel_nome"
              defaultValue={values?.responsavel_nome}
              required
            />
            {errors?.responsavel_nome && (
              <p role="alert" className="text-destructive text-sm">
                {errors.responsavel_nome[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="responsavel_cpf">CPF do responsável</Label>
              <Input
                id="responsavel_cpf"
                name="responsavel_cpf"
                value={responsavelCpf}
                onChange={(event) => setResponsavelCpf(formatCpf(event.target.value))}
                required
              />
              {errors?.responsavel_cpf && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.responsavel_cpf[0]}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="responsavel_telefone">Telefone do responsável</Label>
              <Input
                id="responsavel_telefone"
                name="responsavel_telefone"
                value={responsavelTelefone}
                onChange={(event) => setResponsavelTelefone(formatTelefone(event.target.value))}
                required
              />
              {errors?.responsavel_telefone && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.responsavel_telefone[0]}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="responsavel_email">E-mail do responsável</Label>
              <Input
                id="responsavel_email"
                name="responsavel_email"
                type="email"
                defaultValue={values?.responsavel_email}
              />
              {errors?.responsavel_email && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.responsavel_email[0]}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="responsavel_complemento">Complemento</Label>
              <Input
                id="responsavel_complemento"
                name="responsavel_complemento"
                defaultValue={values?.responsavel_complemento}
              />
              {errors?.responsavel_complemento && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.responsavel_complemento[0]}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <SectionTitle>Observações</SectionTitle>
        <div className="flex flex-col gap-2">
          <Textarea
            id="observacoes"
            name="observacoes"
            rows={3}
            defaultValue={values?.observacoes}
            placeholder="Anotações internas sobre o aluno (não visíveis para ele)."
          />
          {errors?.observacoes && (
            <p role="alert" className="text-destructive text-sm">
              {errors.observacoes[0]}
            </p>
          )}
        </div>
      </div>

      {generalError && (
        <p role="alert" className="text-destructive text-sm">
          {generalError}
        </p>
      )}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
