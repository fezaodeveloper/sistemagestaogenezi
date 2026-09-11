"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { cadastrarEmpresa, type CadastroEmpresaState } from "@/app/empresa/cadastro/actions";
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

export function EmpresaCadastroForm() {
  const [state, formAction] = useActionState<CadastroEmpresaState, FormData>(cadastrarEmpresa, undefined);
  const [etapa, setEtapa] = useState<1 | 2>(1);

  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [site, setSite] = useState("");

  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [aceiteTermos, setAceiteTermos] = useState(false);
  const [erroEtapa1, setErroEtapa1] = useState<string | null>(null);

  function handleProximo() {
    if (!nomeEmpresa.trim()) {
      setErroEtapa1("Informe o nome da empresa.");
      return;
    }
    setErroEtapa1(null);
    setEtapa(2);
  }

  const senhasValidas = senha.length >= 8 && senha === confirmarSenha;

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4" hidden={etapa !== 1}>
            <h2 className="text-sm font-semibold">Dados da empresa</h2>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome_empresa">Nome da empresa</Label>
              <Input
                id="nome_empresa"
                name="nome_empresa"
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                required={etapa === 1}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cnpj">CNPJ (opcional)</Label>
              <Input
                id="cnpj"
                name="cnpj"
                placeholder="00.000.000/0000-00"
                value={cnpj}
                onChange={(e) => setCnpj(formatCnpj(e.target.value))}
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
            <div className="grid grid-cols-2 gap-4">
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

            {erroEtapa1 && (
              <p role="alert" className="text-destructive text-sm">
                {erroEtapa1}
              </p>
            )}

            <Button type="button" onClick={handleProximo} className="w-full">
              Próximo
            </Button>
          </div>

          <div className="flex flex-col gap-4" hidden={etapa !== 2}>
            <h2 className="text-sm font-semibold">Dados do responsável e acesso</h2>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome_responsavel">Nome do responsável</Label>
              <Input
                id="nome_responsavel"
                name="nome_responsavel"
                value={nomeResponsavel}
                onChange={(e) => setNomeResponsavel(e.target.value)}
                required={etapa === 2}
              />
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
                required={etapa === 2}
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
                required={etapa === 2}
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
                required={etapa === 2}
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
                required={etapa === 2}
              />
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

            {state?.error && (
              <p role="alert" className="text-destructive text-sm">
                {state.error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEtapa(1)} className="flex-1">
                Voltar
              </Button>
              <div className="flex-1">
                <SubmitButton disabled={!senhasValidas || !aceiteTermos} />
              </div>
            </div>
          </div>
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

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={disabled || pending} className="w-full">
      {pending ? "Cadastrando..." : "Concluir cadastro"}
    </Button>
  );
}
