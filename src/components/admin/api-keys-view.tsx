"use client";

import { useState, useTransition } from "react";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
import { criarApiKey, excluirApiKey, revogarApiKey } from "@/app/admin/api/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { API_PERMISSAO_LABELS, API_PERMISSOES, type ApiKey, type ApiPermissao } from "@/lib/api/schema";

function formatDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function ChaveGeradaCard({ chave, onFechar }: { chave: string; onFechar: () => void }) {
  const [copiado, setCopiado] = useState(false);

  async function handleCopiar() {
    try {
      await navigator.clipboard.writeText(chave);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard indisponível — a chave continua visível pra copiar à mão.
    }
  }

  return (
    <Card className="border-amber-500/40">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2">
          <KeyRound className="text-amber-600 dark:text-amber-400 size-4" />
          <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Guarde esta chave agora — ela não será exibida novamente
          </span>
        </div>
        <div className="flex items-center gap-2">
          <code className="bg-muted flex-1 overflow-x-auto rounded-md px-3 py-2 text-xs">{chave}</code>
          <Button type="button" variant="outline" size="sm" onClick={handleCopiar}>
            {copiado ? <Check className="text-green-600" /> : <Copy />}
            {copiado ? "Copiado" : "Copiar"}
          </Button>
        </div>
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={onFechar}>
          Já guardei a chave
        </Button>
      </CardContent>
    </Card>
  );
}

function NovaApiKeyDialog({ onChaveGerada }: { onChaveGerada: (chave: string) => void }) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [permissoes, setPermissoes] = useState<ApiPermissao[]>([...API_PERMISSOES]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function togglePermissao(permissao: ApiPermissao, marcada: boolean) {
    setPermissoes((prev) =>
      marcada ? [...prev, permissao] : prev.filter((p) => p !== permissao),
    );
  }

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const resultado = await criarApiKey(nome, permissoes);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      setNome("");
      setPermissoes([...API_PERMISSOES]);
      onChaveGerada(resultado.chave);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Gerar nova API Key
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova API Key</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome-integracao">Nome da integração</Label>
            <Input
              id="nome-integracao"
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              placeholder="ex.: N8n Principal, Zapier"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Permissões</Label>
            <div className="flex flex-col gap-2">
              {API_PERMISSOES.map((permissao) => (
                <div key={permissao} className="flex items-center gap-2">
                  <Checkbox
                    id={`permissao-${permissao}`}
                    checked={permissoes.includes(permissao)}
                    onCheckedChange={(checked) => togglePermissao(permissao, checked === true)}
                  />
                  <Label htmlFor={`permissao-${permissao}`} className="font-normal">
                    {API_PERMISSAO_LABELS[permissao]}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "Gerando..." : "Gerar chave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AcoesApiKey({ apiKey }: { apiKey: ApiKey }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [revogarOpen, setRevogarOpen] = useState(false);
  const [excluirOpen, setExcluirOpen] = useState(false);

  function handleRevogar() {
    setError(null);
    startTransition(async () => {
      const resultado = await revogarApiKey(apiKey.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setRevogarOpen(false);
    });
  }

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirApiKey(apiKey.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setExcluirOpen(false);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-1">
        {apiKey.ativa && (
          <AlertDialog open={revogarOpen} onOpenChange={setRevogarOpen}>
            <AlertDialogTrigger render={<Button variant="ghost" size="sm">Revogar</Button>} />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revogar API Key</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja revogar &quot;{apiKey.nome}&quot;? Qualquer integração usando essa
                  chave para de funcionar imediatamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleRevogar}>
                  {isPending ? "Revogando..." : "Revogar"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <AlertDialog open={excluirOpen} onOpenChange={setExcluirOpen}>
          <AlertDialogTrigger render={<Button variant="ghost" size="sm">Excluir</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir API Key</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir &quot;{apiKey.nome}&quot; permanentemente? Essa ação não pode
                ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleExcluir}>
                {isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error && <span className="text-destructive text-xs">{error}</span>}
    </div>
  );
}

export function ApiKeysView({ apiKeys }: { apiKeys: ApiKey[] }) {
  const [chaveGerada, setChaveGerada] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {apiKeys.length} chave{apiKeys.length === 1 ? "" : "s"} cadastrada{apiKeys.length === 1 ? "" : "s"}
        </p>
        <NovaApiKeyDialog onChaveGerada={setChaveGerada} />
      </div>

      {chaveGerada && <ChaveGeradaCard chave={chaveGerada} onFechar={() => setChaveGerada(null)} />}

      {apiKeys.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Nenhuma API Key cadastrada ainda.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último uso</TableHead>
              <TableHead>Requisições</TableHead>
              <TableHead>Criada em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apiKeys.map((apiKey) => (
              <TableRow key={apiKey.id}>
                <TableCell className="font-medium">{apiKey.nome}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {apiKey.permissoes.map((permissao) => (
                      <Badge key={permissao} variant="outline">
                        {API_PERMISSAO_LABELS[permissao] ?? permissao}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      apiKey.ativa
                        ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {apiKey.ativa ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>{formatDataHora(apiKey.ultimo_uso)}</TableCell>
                <TableCell>{apiKey.total_requisicoes}</TableCell>
                <TableCell>{formatDataHora(apiKey.created_at)}</TableCell>
                <TableCell className="text-right">
                  <AcoesApiKey apiKey={apiKey} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
