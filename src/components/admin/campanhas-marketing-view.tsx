"use client";

import type { ReactElement } from "react";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, Eye, FileDown, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import {
  alternarStatusCampanha,
  atualizarCampanha,
  criarCampanha,
  duplicarCampanha,
  excluirCampanha,
} from "@/app/admin/comercial/campanhas/actions";
import { getLogoEscolaPdf } from "@/app/admin/pdf-actions";
import { CampanhaMarketingPdf } from "@/components/admin/campanha-marketing-pdf";
import { createClient } from "@/lib/supabase/client";
import { CAMPANHA_BUCKET, CAMPANHA_FOTO_MAXIMO_BYTES, CAMPANHA_FOTO_TIPOS_ACEITOS } from "@/lib/storage/campanhas";
import {
  CAMPANHA_STATUSES,
  CAMPANHA_STATUS_BADGE_CLASS,
  CAMPANHA_STATUS_LABELS,
  type CampanhaLink,
  type CampanhaMarketing,
  type CampanhaStatus,
} from "@/lib/campanhas/schema";
import { LIMITE_PADRAO } from "@/lib/paginacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Paginacao } from "@/components/ui/paginacao";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  ...CAMPANHA_STATUS_LABELS,
};

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function periodoCampanha(campanha: CampanhaMarketing): string | null {
  if (!campanha.data_inicio && !campanha.data_fim) return null;
  const inicio = campanha.data_inicio ? formatDateBR(campanha.data_inicio) : "?";
  const fim = campanha.data_fim ? formatDateBR(campanha.data_fim) : "?";
  return `${inicio} até ${fim}`;
}

function CampanhaDialog({
  campanha,
  trigger,
  onSalvo,
}: {
  campanha?: CampanhaMarketing;
  trigger: ReactElement;
  onSalvo: () => void;
}) {
  const editando = !!campanha;
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CampanhaStatus>(campanha?.status ?? "ativa");
  const [links, setLinks] = useState<CampanhaLink[]>(campanha?.links ?? []);
  const [novoLinkLabel, setNovoLinkLabel] = useState("");
  const [novoLinkUrl, setNovoLinkUrl] = useState("");
  const [tags, setTags] = useState<string[]>(campanha?.tags ?? []);
  const [novaTag, setNovaTag] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(campanha?.foto_url ?? null);
  const [fotoPath, setFotoPath] = useState<string | null>(campanha?.foto_path ?? null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputFotoRef = useRef<HTMLInputElement>(null);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setStatus(campanha?.status ?? "ativa");
      setLinks(campanha?.links ?? []);
      setNovoLinkLabel("");
      setNovoLinkUrl("");
      setTags(campanha?.tags ?? []);
      setNovaTag("");
      setFotoUrl(campanha?.foto_url ?? null);
      setFotoPath(campanha?.foto_path ?? null);
      setError(null);
    }
  }

  function adicionarLink() {
    if (!novoLinkLabel.trim() || !novoLinkUrl.trim()) return;
    setLinks((prev) => [...prev, { label: novoLinkLabel.trim(), url: novoLinkUrl.trim() }]);
    setNovoLinkLabel("");
    setNovoLinkUrl("");
  }

  function removerLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTagKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const valor = novaTag.trim();
    if (valor && !tags.includes(valor)) {
      setTags((prev) => [...prev, valor]);
    }
    setNovaTag("");
  }

  function removerTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleArquivoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!(CAMPANHA_FOTO_TIPOS_ACEITOS as readonly string[]).includes(file.type)) {
      setError("Formato não aceito. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > CAMPANHA_FOTO_MAXIMO_BYTES) {
      setError("Arquivo muito grande. Máximo permitido: 5MB.");
      return;
    }

    setEnviandoFoto(true);
    try {
      const supabase = createClient();
      const path = `${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage.from(CAMPANHA_BUCKET).upload(path, file);
      if (uploadError) {
        setError("Não foi possível enviar a foto. Tente novamente.");
        return;
      }

      const { data: urlData } = supabase.storage.from(CAMPANHA_BUCKET).getPublicUrl(path);
      setFotoUrl(urlData.publicUrl);
      setFotoPath(path);
    } finally {
      setEnviandoFoto(false);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("status", status);
    formData.set("links", JSON.stringify(links));
    formData.set("tags", JSON.stringify(tags));
    if (fotoUrl) formData.set("foto_url", fotoUrl);
    if (fotoPath) formData.set("foto_path", fotoPath);

    startTransition(async () => {
      const resultado = editando
        ? await atualizarCampanha(campanha.id, formData)
        : await criarCampanha(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onSalvo();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar campanha" : "Nova campanha"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nome">Nome da campanha</Label>
            <Input id="nome" name="nome" defaultValue={campanha?.nome} required />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea id="descricao" name="descricao" rows={3} defaultValue={campanha?.descricao ?? ""} placeholder="Opcional" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="como_fazer">Como fazer (passo a passo)</Label>
            <Textarea
              id="como_fazer"
              name="como_fazer"
              rows={4}
              defaultValue={campanha?.como_fazer ?? ""}
              placeholder="Opcional"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                name="status"
                items={CAMPANHA_STATUS_LABELS}
                value={status}
                onValueChange={(value) => setStatus(value as CampanhaStatus)}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPANHA_STATUSES.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {CAMPANHA_STATUS_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meta_alunos">Meta de alunos</Label>
              <Input
                id="meta_alunos"
                name="meta_alunos"
                type="number"
                step="1"
                min="0"
                defaultValue={campanha?.meta_alunos ?? ""}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_inicio">Data início</Label>
              <Input id="data_inicio" name="data_inicio" type="date" defaultValue={campanha?.data_inicio ?? ""} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="data_fim">Data fim</Label>
              <Input id="data_fim" name="data_fim" type="date" defaultValue={campanha?.data_fim ?? ""} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="orcamento_trafego">Orçamento tráfego (R$)</Label>
              <Input
                id="orcamento_trafego"
                name="orcamento_trafego"
                type="number"
                step="0.01"
                min="0"
                defaultValue={campanha?.orcamento_trafego ?? ""}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="orcamento_impressao">Orçamento impressão (R$)</Label>
              <Input
                id="orcamento_impressao"
                name="orcamento_impressao"
                type="number"
                step="0.01"
                min="0"
                defaultValue={campanha?.orcamento_impressao ?? ""}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Links</Label>
            {links.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {links.map((link, index) => (
                  <div key={`${link.url}-${index}`} className="bg-muted/50 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm">
                    <span className="font-medium">{link.label}</span>
                    <span className="text-muted-foreground truncate">{link.url}</span>
                    <button
                      type="button"
                      onClick={() => removerLink(index)}
                      className="text-muted-foreground hover:text-destructive ml-auto shrink-0"
                      aria-label="Remover link"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Input
                value={novoLinkLabel}
                onChange={(event) => setNovoLinkLabel(event.target.value)}
                placeholder="Nome do link"
                className="max-w-40"
              />
              <Input
                value={novoLinkUrl}
                onChange={(event) => setNovoLinkUrl(event.target.value)}
                placeholder="https://..."
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={adicionarLink}>
                <Plus />
                Adicionar link
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="nova-tag">Tags</Label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removerTag(tag)}
                      aria-label={`Remover tag ${tag}`}
                      className="hover:text-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <Input
              id="nova-tag"
              value={novaTag}
              onChange={(event) => setNovaTag(event.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Digite e pressione Enter"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Foto</Label>
            <input
              ref={inputFotoRef}
              type="file"
              accept={CAMPANHA_FOTO_TIPOS_ACEITOS.join(",")}
              onChange={handleArquivoChange}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              {fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
                <img src={fotoUrl} alt="Foto da campanha" className="h-20 w-32 rounded-md border object-cover" />
              ) : (
                <button
                  type="button"
                  onClick={() => inputFotoRef.current?.click()}
                  disabled={enviandoFoto}
                  className="text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 flex h-20 w-32 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-muted-foreground/30 text-center transition-colors disabled:pointer-events-none disabled:opacity-50"
                >
                  <Upload className="size-4" />
                  <span className="px-2 text-xs">{enviandoFoto ? "Enviando..." : "Adicionar foto"}</span>
                </button>
              )}
              {fotoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={enviandoFoto}
                  onClick={() => inputFotoRef.current?.click()}
                >
                  {enviandoFoto ? "Enviando..." : "Trocar foto"}
                </Button>
              )}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={isPending || enviandoFoto}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DuplicarCampanhaButton({ campanha, onDuplicada }: { campanha: CampanhaMarketing; onDuplicada: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleDuplicar() {
    startTransition(async () => {
      await duplicarCampanha(campanha.id);
      onDuplicada();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Duplicar campanha"
      disabled={isPending}
      onClick={handleDuplicar}
    >
      <Copy />
    </Button>
  );
}

function ExcluirCampanhaButton({ campanha, onExcluida }: { campanha: CampanhaMarketing; onExcluida: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirCampanha(campanha.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onExcluida();
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setConfirmacao("");
        if (nextOpen) setError(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Excluir campanha">
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir campanha</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{campanha.nome}&quot;? Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-${campanha.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-${campanha.id}`}
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="Digite EXCLUIR para confirmar"
            autoComplete="off"
          />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isPending || confirmacao !== TEXTO_CONFIRMACAO_EXCLUSAO}
            onClick={handleExcluir}
          >
            {isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CampanhaDetalhesDialog({ campanha }: { campanha: CampanhaMarketing }) {
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [erroPdf, setErroPdf] = useState<string | null>(null);
  const orcamentoTotal = (campanha.orcamento_trafego ?? 0) + (campanha.orcamento_impressao ?? 0);
  const periodo = periodoCampanha(campanha);

  async function handleExportarPdf() {
    // Abre a aba em branco já dentro do handler de clique (síncrono), antes de
    // qualquer await — navegadores bloqueiam window.open() chamado depois de
    // uma Promise resolver (mesmo padrão de matricula-detalhes.tsx).
    const novaAba = window.open("", "_blank");
    setGerandoPdf(true);
    setErroPdf(null);
    try {
      const escolaLogo = await getLogoEscolaPdf();
      const geradoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const blob = await pdf(
        <CampanhaMarketingPdf campanha={campanha} escolaLogo={escolaLogo} geradoEm={geradoEm} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      if (novaAba) {
        novaAba.location.href = url;
      } else {
        window.open(url, "_blank");
      }
    } catch {
      novaAba?.close();
      setErroPdf("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerandoPdf(false);
    }
  }

  return (
    <Dialog onOpenChange={(aberto) => aberto && setErroPdf(null)}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            <Eye />
            Ver detalhes
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8">
            {campanha.nome}
            <Badge className={CAMPANHA_STATUS_BADGE_CLASS[campanha.status]}>
              {CAMPANHA_STATUS_LABELS[campanha.status]}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          {campanha.foto_url && (
            // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
            <img src={campanha.foto_url} alt={campanha.nome} className="max-h-56 w-full rounded-md border object-cover" />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground text-xs">Período</p>
              <p>{periodo ?? "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Meta de alunos</p>
              <p>{campanha.meta_alunos !== null ? campanha.meta_alunos : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Orçamento tráfego</p>
              <p>{campanha.orcamento_trafego !== null ? formatMoeda(campanha.orcamento_trafego) : "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Orçamento impressão</p>
              <p>{campanha.orcamento_impressao !== null ? formatMoeda(campanha.orcamento_impressao) : "—"}</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground text-xs">Orçamento total</p>
              <p className="font-medium">{formatMoeda(orcamentoTotal)}</p>
            </div>
          </div>

          <Separator />

          <div>
            <p className="text-muted-foreground text-xs">Descrição</p>
            <p className="whitespace-pre-wrap">{campanha.descricao || "—"}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs">Como fazer (passo a passo)</p>
            <p className="whitespace-pre-wrap">{campanha.como_fazer || "—"}</p>
          </div>

          <div>
            <p className="text-muted-foreground mb-1 text-xs">Links</p>
            {campanha.links.length === 0 ? (
              <p>—</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {campanha.links.map((link, indice) => (
                  <li key={`${link.url}-${indice}`}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary inline-flex items-center gap-1 hover:underline"
                    >
                      {link.label}
                      <ExternalLink className="size-3" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="text-muted-foreground mb-1 text-xs">Tags</p>
            {campanha.tags && campanha.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {campanha.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : (
              <p>—</p>
            )}
          </div>

          <p className="text-muted-foreground text-xs">
            Cadastrada em {new Date(campanha.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </p>

          {erroPdf && (
            <p role="alert" className="text-destructive text-sm">
              {erroPdf}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" onClick={handleExportarPdf} disabled={gerandoPdf}>
            <FileDown />
            {gerandoPdf ? "Gerando PDF..." : "Exportar PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampanhaCard({ campanha, onMudou }: { campanha: CampanhaMarketing; onMudou: () => void }) {
  const orcamentoTotal = (campanha.orcamento_trafego ?? 0) + (campanha.orcamento_impressao ?? 0);
  const periodo = periodoCampanha(campanha);
  const [erro, setErro] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Liga/desliga otimista: o switch e o badge mudam na hora; se a Server
  // Action falhar (ou o update não atingir nenhuma linha), o React descarta o
  // estado otimista ao fim da transição e volta pro status real do banco.
  const [statusVisivel, aplicarStatus] = useOptimistic(
    campanha.status,
    (_atual, novo: CampanhaStatus) => novo,
  );

  function handleToggle(ativa: boolean) {
    setErro(null);
    startTransition(async () => {
      aplicarStatus(ativa ? "ativa" : "inativa");
      const resultado = await alternarStatusCampanha(campanha.id, ativa);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      onMudou();
    });
  }

  return (
    <Card className="overflow-hidden pt-0">
      {campanha.foto_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
        <img src={campanha.foto_url} alt={campanha.nome} className="h-36 w-full object-cover" />
      ) : (
        <div className="bg-muted flex h-36 w-full items-center justify-center text-4xl">📢</div>
      )}
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{campanha.nome}</p>
          <Badge className={CAMPANHA_STATUS_BADGE_CLASS[statusVisivel]}>
            {CAMPANHA_STATUS_LABELS[statusVisivel]}
          </Badge>
        </div>
        {periodo && <p className="text-muted-foreground text-sm">{periodo}</p>}
        {campanha.meta_alunos !== null && (
          <p className="text-muted-foreground text-sm">Meta: {campanha.meta_alunos} aluno(s)</p>
        )}
        {orcamentoTotal > 0 && (
          <p className="text-muted-foreground text-sm">Orçamento total: {formatMoeda(orcamentoTotal)}</p>
        )}
        <label className="flex items-center gap-2 pt-1 text-sm">
          <Switch checked={statusVisivel === "ativa"} onCheckedChange={handleToggle} />
          {statusVisivel === "ativa" ? "Ativa" : "Ativar campanha"}
        </label>
        {erro && (
          <p role="alert" className="text-destructive text-xs">
            {erro}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 pt-1">
          <CampanhaDetalhesDialog campanha={campanha} />
          <div className="flex gap-1">
            <CampanhaDialog
              campanha={campanha}
              trigger={
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar campanha">
                  <Pencil />
                </Button>
              }
              onSalvo={onMudou}
            />
            <DuplicarCampanhaButton campanha={campanha} onDuplicada={onMudou} />
            <ExcluirCampanhaButton campanha={campanha} onExcluida={onMudou} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampanhasMarketingView({
  campanhas,
  totalRegistros,
  paginaAtual,
  totalPaginas,
  limite,
  query,
  status,
}: {
  campanhas: CampanhaMarketing[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  limite: number;
  query: string;
  status: string;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function construirUrl(overrides: { q?: string; status?: string }) {
    const params = new URLSearchParams();
    const q = overrides.q ?? busca;
    const st = overrides.status ?? status;
    if (q.trim()) params.set("q", q.trim());
    if (st && st !== STATUS_FILTRO_TODOS) params.set("status", st);
    if (limite !== LIMITE_PADRAO) params.set("limit", String(limite));
    const queryString = params.toString();
    return queryString ? `/admin/comercial/campanhas?${queryString}` : "/admin/comercial/campanhas";
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(construirUrl({ q: valor }));
    }, 500);
  }

  function handleStatusChange(valor: string) {
    router.push(construirUrl({ status: valor }));
  }

  function handleMudou() {
    router.refresh();
  }

  const paginacaoSearchParams: Record<string, string> = {};
  if (query) paginacaoSearchParams.q = query;
  if (status) paginacaoSearchParams.status = status;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(event) => handleBuscaChange(event.target.value)}
            className="max-w-sm"
          />
          <Select
            items={STATUS_FILTRO_ITEMS}
            value={status || STATUS_FILTRO_TODOS}
            onValueChange={(value) => handleStatusChange(value as string)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(STATUS_FILTRO_ITEMS).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {STATUS_FILTRO_ITEMS[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <CampanhaDialog
          trigger={
            <Button>
              <Plus />
              Nova campanha
            </Button>
          }
          onSalvo={handleMudou}
        />
      </div>

      {campanhas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {totalRegistros === 0
            ? "Nenhuma campanha cadastrada ainda."
            : "Nenhuma campanha encontrada com os filtros aplicados."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {campanhas.map((campanha) => (
            <CampanhaCard key={campanha.id} campanha={campanha} onMudou={handleMudou} />
          ))}
        </div>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={limite}
        baseUrl="/admin/comercial/campanhas"
        searchParams={paginacaoSearchParams}
      />
    </div>
  );
}
