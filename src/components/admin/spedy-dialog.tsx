"use client";

// "use client": formulário com estado e envio por Server Action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { salvarSpedy } from "@/app/admin/configuracoes/apps/spedy/actions";
import { CursosChecklist, type CursoOpcao } from "@/components/admin/cursos-checklist";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export type SpedyItem = {
  id: string;
  nome: string;
  ambiente: "sandbox" | "producao";
  ativo: boolean;
  cursos_ids: string[];
  // A chave em si NUNCA vem do servidor (a coluna é obrigatória, então sempre existe uma).
};

export function SpedyDialog({
  integracao,
  cursos,
  criptografiaConfigurada,
  onClose,
}: {
  // null = nova integração.
  integracao: SpedyItem | null;
  cursos: CursoOpcao[];
  criptografiaConfigurada: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [nome, setNome] = useState(integracao?.nome ?? "");
  const [chaveApi, setChaveApi] = useState("");
  const [ambiente, setAmbiente] = useState<"sandbox" | "producao">(integracao?.ambiente ?? "sandbox");
  const [ativo, setAtivo] = useState(integracao?.ativo ?? false);
  const [cursosIds, setCursosIds] = useState<Set<string>>(() => new Set(integracao?.cursos_ids ?? []));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  function handleSalvar() {
    setErro(null);
    startSalvar(async () => {
      const resultado = await salvarSpedy(integracao?.id ?? null, { nome, chaveApi, ambiente, ativo, cursosIds: [...cursosIds] });
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{integracao ? "Editar integração" : "Nova integração"}</DialogTitle>
          <DialogDescription>
            Emite NFS-e automaticamente na Spedy a cada pagamento confirmado dos cursos escolhidos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-nome">Nome da integração</Label>
            <Input id="sp-nome" value={nome} maxLength={100} placeholder="Ex.: Empresa principal" onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sp-chave">Chave de API</Label>
            <Input
              id="sp-chave"
              type="password"
              autoComplete="off"
              value={chaveApi}
              placeholder={integracao ? "•••••••• chave salva — deixe em branco para manter" : "Cole a chave de API da Spedy"}
              onChange={(e) => setChaveApi(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Vem do painel da Spedy (uma chave por empresa). Sandbox e produção são contas separadas, cada uma com a sua chave.
            </p>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">Ambiente</legend>
            {(
              [
                { valor: "sandbox", titulo: "Sandbox (testes)", descricao: "Notas de teste, sem valor fiscal." },
                { valor: "producao", titulo: "Produção", descricao: "Notas fiscais REAIS, com valor fiscal." },
              ] as const
            ).map((opcao) => (
              <label key={opcao.valor} className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm has-[:checked]:border-primary">
                <input
                  type="radio"
                  name="sp-ambiente"
                  className="mt-0.5"
                  checked={ambiente === opcao.valor}
                  onChange={() => setAmbiente(opcao.valor)}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{opcao.titulo}</span>
                  <span className="text-muted-foreground text-xs">{opcao.descricao}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <CursosChecklist
            cursos={cursos}
            selecionados={cursosIds}
            onChange={setCursosIds}
            textoAjuda="Sem nenhum curso marcado, a integração vale para todos os cursos. Duas integrações ativas não podem cobrir o mesmo curso."
          />

          <label className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium">Integração ativa</span>
              <span className="text-muted-foreground text-xs">
                Ligada, cada pagamento confirmado emite a nota automaticamente (e o botão &quot;Emitir NF&quot; aparece nas parcelas pagas).
              </span>
            </span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </label>

          {ativo && ambiente === "producao" && (
            <p className="flex gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Em <strong>produção</strong>, ativa, cada pagamento confirmado emite uma nota fiscal REAL, sem confirmação manual.
              </span>
            </p>
          )}

          {!criptografiaConfigurada && (
            <p role="alert" className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">
              A variável de ambiente GATEWAYS_ENCRYPTION_KEY não está definida: não é possível salvar a chave de API até
              configurá-la.
            </p>
          )}
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
