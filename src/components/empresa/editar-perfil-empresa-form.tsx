"use client";

import { useState, useTransition } from "react";
import { atualizarPerfilEmpresa } from "@/app/empresa/(protegido)/perfil/actions";
import { formatCnpj } from "@/lib/configuracoes/schema";
import { formatTelefone } from "@/lib/alunos/schema";
import { SETORES_CONECTA, type EmpresaConecta } from "@/lib/conecta/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const SETOR_ITEMS = Object.fromEntries(SETORES_CONECTA.map((setor) => [setor, setor]));

export function EditarPerfilEmpresaForm({ empresa }: { empresa: EmpresaConecta }) {
  const [cnpj, setCnpj] = useState(empresa.cnpj ?? "");
  const [whatsapp, setWhatsapp] = useState(empresa.whatsapp ?? "");
  const [telefone, setTelefone] = useState(empresa.telefone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const resultado = await atualizarPerfilEmpresa(formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSalvo(true);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome_empresa">Nome da empresa</Label>
          <Input id="nome_empresa" name="nome_empresa" defaultValue={empresa.nome_empresa} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cnpj">CNPJ</Label>
          <Input id="cnpj" name="cnpj" value={cnpj} onChange={(e) => setCnpj(formatCnpj(e.target.value))} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="setor">Setor de atuação</Label>
          <Select name="setor" items={SETOR_ITEMS} defaultValue={empresa.setor ?? undefined}>
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
          <Label htmlFor="site">Site</Label>
          <Input id="site" name="site" placeholder="https://" defaultValue={empresa.site ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cidade">Cidade</Label>
          <Input id="cidade" name="cidade" defaultValue={empresa.cidade ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="estado">Estado</Label>
          <Input id="estado" name="estado" maxLength={2} defaultValue={empresa.estado ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nome_responsavel">Nome do responsável</Label>
          <Input
            id="nome_responsavel"
            name="nome_responsavel"
            defaultValue={empresa.nome_responsavel}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input
            id="whatsapp"
            name="whatsapp"
            value={whatsapp}
            onChange={(e) => setWhatsapp(formatTelefone(e.target.value))}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            name="telefone"
            value={telefone}
            onChange={(e) => setTelefone(formatTelefone(e.target.value))}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="descricao">Descrição da empresa</Label>
        <Textarea id="descricao" name="descricao" rows={3} defaultValue={empresa.descricao ?? ""} />
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {salvo && !error && (
        <p className="text-sm text-green-600 dark:text-green-400">Alterações salvas com sucesso.</p>
      )}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Salvando..." : "Salvar alterações"}
      </Button>
    </form>
  );
}
