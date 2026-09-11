"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import {
  cadastrarEmpresa,
  consultarCnpj,
  type CadastroEmpresaState,
} from "@/app/empresa/cadastro/actions";
import { formatCnpj } from "@/lib/configuracoes/schema";
import { formatTelefone } from "@/lib/alunos/schema";
import { SETORES_CONECTA } from "@/lib/conecta/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SETOR_ITEMS = Object.fromEntries(SETORES_CONECTA.map((setor) => [setor, setor]));

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="w-full">
      {pending ? "Cadastrando..." : "Cadastrar empresa"}
    </Button>
  );
}

export function EmpresaCadastroForm() {
  const [state, formAction] = useActionState<CadastroEmpresaState, FormData>(cadastrarEmpresa, undefined);
  const [isPendingCnpj, startTransitionCnpj] = useTransition();

  const [cnpj, setCnpj] = useState("");
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [site, setSite] = useState("");
  const [cnpjErro, setCnpjErro] = useState<string | null>(null);
  const [cnpjBloqueado, setCnpjBloqueado] = useState(false);

  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [telefone, setTelefone] = useState("");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);

  function handleCnpjBlur() {
    const digitos = cnpj.replace(/\D/g, "");
    if (digitos.length !== 14) return;

    setCnpjErro(null);
    startTransitionCnpj(async () => {
      const resultado = await consultarCnpj(digitos);
      if (!resultado.ok) {
        setCnpjErro(resultado.error);
        setCnpjBloqueado(resultado.bloqueante);
        return;
      }
      setCnpjBloqueado(false);
      if (resultado.nomeEmpresa) setNomeEmpresa(resultado.nomeEmpresa);
      if (resultado.cidade) setCidade(resultado.cidade);
      if (resultado.estado) setEstado(resultado.estado);
    });
  }

  const senhasValidas = senha.length >= 8 && senha === confirmarSenha;
  const podeSubmeter = senhasValidas && aceiteTermos && !cnpjBloqueado && nomeEmpresa.trim().length > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold">Dados da empresa</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cnpj">CNPJ (opcional)</Label>
                <Input
                  id="cnpj"
                  name="cnpj"
                  placeholder="00.000.000/0000-00"
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpj(e.target.value))}
                  onBlur={handleCnpjBlur}
                />
                {isPendingCnpj && <p className="text-muted-foreground text-xs">Consultando CNPJ...</p>}
                {cnpjErro && <p className="text-destructive text-xs">{cnpjErro}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="nome_empresa">Nome da empresa</Label>
                <Input
                  id="nome_empresa"
                  name="nome_empresa"
                  value={nomeEmpresa}
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="setor">Setor de atuação</Label>
                <Select name="setor" items={SETOR_ITEMS}>
                  <SelectTrigger id="setor" className="w-full">
                    <SelectValue placeholder="Selecione um setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {SETORES_CONECTA.map((setor) => (
                      <SelectItem key={setor} value={setor}>
                        {setor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="site">Site (opcional)</Label>
                <Input
                  id="site"
                  name="site"
                  placeholder="https://"
                  value={site}
                  onChange={(e) => setSite(e.target.value)}
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

          <div className="flex flex-col gap-4 border-t pt-4">
            <h2 className="text-sm font-semibold">Dados do responsável</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="nome_responsavel">Nome do responsável</Label>
                <Input
                  id="nome_responsavel"
                  name="nome_responsavel"
                  value={nomeResponsavel}
                  onChange={(e) => setNomeResponsavel(e.target.value)}
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
                <Label htmlFor="telefone">Telefone (opcional)</Label>
                <Input
                  id="telefone"
                  name="telefone"
                  placeholder="(00) 0000-0000"
                  value={telefone}
                  onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 border-t pt-4">
            <h2 className="text-sm font-semibold">Acesso</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
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
                <Label htmlFor="senha">Senha</Label>
                <Input
                  id="senha"
                  name="senha"
                  type="password"
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmar_senha">Confirmar senha</Label>
                <Input
                  id="confirmar_senha"
                  name="confirmar_senha"
                  type="password"
                  autoComplete="new-password"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  required
                />
              </div>
            </div>
            {senha.length > 0 && senha.length < 8 && (
              <p className="text-destructive text-sm">A senha precisa ter pelo menos 8 caracteres.</p>
            )}
            {confirmarSenha.length > 0 && senha !== confirmarSenha && (
              <p className="text-destructive text-sm">As senhas não coincidem.</p>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="aceite_termos_checkbox"
                checked={aceiteTermos}
                onCheckedChange={(checked) => setAceiteTermos(checked === true)}
              />
              <Label htmlFor="aceite_termos_checkbox" className="font-normal">
                Concordo com os termos de uso
              </Label>
              <input type="hidden" name="aceite_termos" value={aceiteTermos ? "on" : ""} />
            </div>
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
          <Link href="/empresa/login" className="text-foreground underline underline-offset-2">
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
