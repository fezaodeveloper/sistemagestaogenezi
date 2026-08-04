"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isMinor } from "@/lib/alunos/schema";
import { createAluno, type AlunoFormState } from "@/app/admin/alunos/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Criando..." : "Criar aluno"}
    </Button>
  );
}

export function AlunoCreateForm() {
  const [state, formAction] = useActionState<AlunoFormState, FormData>(createAluno, undefined);
  const values = state && !state.success ? state.values : undefined;
  const [dataNascimento, setDataNascimento] = useState(values?.data_nascimento ?? "");
  const menorDeIdade = dataNascimento ? isMinor(dataNascimento) : false;

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
    <form key={JSON.stringify(values)} action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="full_name">Nome completo</Label>
        <Input id="full_name" name="full_name" defaultValue={values?.full_name} required />
        {errors?.full_name && (
          <p role="alert" className="text-destructive text-sm">
            {errors.full_name[0]}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" name="email" type="email" defaultValue={values?.email} required />
        {errors?.email && (
          <p role="alert" className="text-destructive text-sm">
            {errors.email[0]}
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
            defaultValue={values?.cpf}
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
            defaultValue={values?.telefone}
            required
          />
          {errors?.telefone && (
            <p role="alert" className="text-destructive text-sm">
              {errors.telefone[0]}
            </p>
          )}
        </div>
      </div>

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

      {menorDeIdade && (
        <div className="flex flex-col gap-4 rounded-md border p-4">
          <p className="text-sm font-medium">Dados do responsável (aluno menor de idade)</p>

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
                defaultValue={values?.responsavel_cpf}
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
                defaultValue={values?.responsavel_telefone}
                required
              />
              {errors?.responsavel_telefone && (
                <p role="alert" className="text-destructive text-sm">
                  {errors.responsavel_telefone[0]}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
