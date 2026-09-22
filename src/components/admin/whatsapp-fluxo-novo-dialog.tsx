"use client";

// "use client": estado do formulário e Server Action de criação; navega pro editor ao criar.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { criarFluxo } from "@/app/admin/whatsapp-fluxos/actions";
import { FLUXO_GATILHO_LABELS, FLUXO_GATILHOS, type FluxoGatilho } from "@/lib/whatsapp/fluxos-tipos";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ITENS_GATILHO: Record<string, string> = Object.fromEntries(FLUXO_GATILHOS.map((g) => [g, FLUXO_GATILHO_LABELS[g]]));

export function WhatsappFluxoNovoDialog() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [gatilho, setGatilho] = useState<FluxoGatilho>("manual");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, startTransition] = useTransition();

  function criar() {
    setErro(null);
    startTransition(async () => {
      const r = await criarFluxo({ nome, descricao, gatilho });
      if ("error" in r || !r.success) {
        setErro("error" in r ? r.error : "Não foi possível criar o fluxo.");
        return;
      }
      setAberto(false);
      setNome("");
      setDescricao("");
      router.push(`/admin/whatsapp-fluxos/${r.id}`);
    });
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !criando && setAberto(v)}>
      <DialogTrigger
        render={
          <Button type="button">
            <Plus />
            Novo fluxo
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo fluxo de WhatsApp</DialogTitle>
          <DialogDescription>Nasce inativo, com um único nó de gatilho. Você monta o resto no editor.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="fluxo-nome">Nome</Label>
            <Input id="fluxo-nome" value={nome} maxLength={100} onChange={(e) => setNome(e.target.value)} disabled={criando} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="fluxo-descricao">Descrição (opcional)</Label>
            <Textarea id="fluxo-descricao" value={descricao} maxLength={500} rows={2} onChange={(e) => setDescricao(e.target.value)} disabled={criando} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Gatilho</Label>
            <Select items={ITENS_GATILHO} value={gatilho} onValueChange={(v) => v && setGatilho(v as FluxoGatilho)} disabled={criando}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FLUXO_GATILHOS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {FLUXO_GATILHO_LABELS[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" disabled={criando} onClick={() => setAberto(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={criando || !nome.trim()} onClick={criar}>
            {criando ? "Criando..." : "Criar e editar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
