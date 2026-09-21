"use client";

// "use client": diálogo de criar/editar (com upload da imagem pelo navegador), reordenação,
// duplicar/excluir e Server Actions.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Copy, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  duplicarConquista,
  excluirConquista,
  reordenarConquistas,
  salvarConquista,
} from "@/app/admin/configuracoes/portal-aluno/gamificacao/actions";
import { createClient } from "@/lib/supabase/client";
import {
  CONQUISTA_BUCKET,
  CONQUISTA_GATILHO_LABEL,
  CONQUISTA_GATILHO_VALOR,
  CONQUISTA_GATILHOS,
  CONQUISTA_IMAGEM_MAX_BYTES,
  CONQUISTA_IMAGEM_TIPOS,
  LIMITE_DESCRICAO_CONQUISTA,
  LIMITE_EMOJI_CONQUISTA,
  LIMITE_TITULO_CONQUISTA,
  descreverGatilho,
  gatilhoPedeValor,
  isConquistaGatilho,
  type ConquistaAdminView,
  type ConquistaGatilho,
} from "@/lib/conquistas/tipos";
import { ConquistaBadgeImagem } from "@/components/aluno/conquista-badge-imagem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Edicao = {
  id?: string;
  titulo: string;
  descricao: string;
  gatilho: ConquistaGatilho;
  valor: string;
  modoBadge: "emoji" | "imagem";
  emoji: string;
  imagemUrl: string;
  ativo: boolean;
};

const NOVA: Edicao = {
  titulo: "",
  descricao: "",
  gatilho: "primeira_aula",
  valor: "",
  modoBadge: "emoji",
  emoji: "🏆",
  imagemUrl: "",
  ativo: true,
};

const ITENS_GATILHO: Record<string, string> = Object.fromEntries(CONQUISTA_GATILHOS.map((g) => [g, CONQUISTA_GATILHO_LABEL[g]]));

export function ConquistasAdminLista({ conquistas }: { conquistas: ConquistaAdminView[] }) {
  const router = useRouter();
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();
  const [enviando, setEnviando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [paraExcluir, setParaExcluir] = useState<ConquistaAdminView | null>(null);

  function abrirNova() {
    setErroForm(null);
    setEdicao(NOVA);
  }

  function abrirEdicao(c: ConquistaAdminView) {
    setErroForm(null);
    setEdicao({
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao ?? "",
      gatilho: c.gatilho,
      valor: c.gatilhoValor !== null ? String(c.gatilhoValor) : "",
      modoBadge: c.badgeUrl ? "imagem" : "emoji",
      emoji: c.badgeEmoji ?? "🏆",
      imagemUrl: c.badgeUrl ?? "",
      ativo: c.ativo,
    });
  }

  function atualizar(parcial: Partial<Edicao>) {
    setEdicao((atual) => (atual ? { ...atual, ...parcial } : atual));
  }

  async function enviarImagem(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;

    setErroForm(null);
    const extensao = CONQUISTA_IMAGEM_TIPOS[arquivo.type];
    if (!extensao) {
      setErroForm("Formato não aceito. Use PNG, JPG, WEBP ou GIF.");
      return;
    }
    if (arquivo.size > CONQUISTA_IMAGEM_MAX_BYTES) {
      setErroForm("A imagem pode ter no máximo 1 MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      // Carimbo no nome: cada upload tem URL própria (sem cache velho do navegador).
      const caminho = `badges/${Date.now()}.${extensao}`;
      const { error } = await supabase.storage
        .from(CONQUISTA_BUCKET)
        .upload(caminho, arquivo, { contentType: arquivo.type, cacheControl: "3600" });
      if (error) {
        setErroForm(`Erro no upload: ${error.message}`);
        return;
      }
      atualizar({ imagemUrl: supabase.storage.from(CONQUISTA_BUCKET).getPublicUrl(caminho).data.publicUrl });
    } finally {
      setEnviando(false);
    }
  }

  function salvar() {
    if (!edicao) return;
    setErroForm(null);

    const regra = CONQUISTA_GATILHO_VALOR[edicao.gatilho];
    const valor = regra && edicao.valor.trim() !== "" ? Number(edicao.valor) : null;
    if (regra && (valor === null || !Number.isInteger(valor))) {
      setErroForm(`${regra.rotulo}: informe um número inteiro.`);
      return;
    }

    startSalvar(async () => {
      const r = await salvarConquista({
        id: edicao.id,
        titulo: edicao.titulo,
        descricao: edicao.descricao,
        gatilho: edicao.gatilho,
        gatilhoValor: valor,
        badgeUrl: edicao.modoBadge === "imagem" ? edicao.imagemUrl : "",
        badgeEmoji: edicao.modoBadge === "emoji" ? edicao.emoji : "",
        ativo: edicao.ativo,
      });
      if ("error" in r) {
        setErroForm(r.error);
        return;
      }
      setEdicao(null);
      router.refresh();
    });
  }

  function executar(acao: () => Promise<{ success: true } | { error: string }>, aoConcluir?: () => void) {
    setErro(null);
    startTransition(async () => {
      const r = await acao();
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      aoConcluir?.();
      router.refresh();
    });
  }

  function mover(indice: number, delta: -1 | 1) {
    const destino = indice + delta;
    if (destino < 0 || destino >= conquistas.length) return;
    const ids = conquistas.map((c) => c.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    executar(() => reordenarConquistas(ids));
  }

  const regraAtual = edicao ? CONQUISTA_GATILHO_VALOR[edicao.gatilho] : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Conquistas</h3>
          <p className="text-muted-foreground text-sm">
            Cada aluno desbloqueia automaticamente quando cumpre o gatilho — inclusive conquistas criadas depois, na próxima visita.
          </p>
        </div>
        <Button type="button" size="sm" onClick={abrirNova}>
          <Plus />
          Nova conquista
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {conquistas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma conquista cadastrada ainda.</p>
            <Button type="button" onClick={abrirNova}>
              <Plus />
              Criar a primeira conquista
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {conquistas.map((c, indice) => (
            <li key={c.id} className={`bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3 ${c.ativo ? "" : "opacity-70"}`}>
              <ConquistaBadgeImagem url={c.badgeUrl} emoji={c.badgeEmoji} titulo={c.titulo} className="size-12 text-2xl" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {c.titulo}
                  {!c.ativo && <Badge variant="outline">Inativa</Badge>}
                </span>
                <span className="text-muted-foreground text-xs">{descreverGatilho(c.gatilho, c.gatilhoValor)}</span>
                <span className="text-muted-foreground text-xs">
                  {c.totalDesbloqueios} {c.totalDesbloqueios === 1 ? "aluno desbloqueou" : "alunos desbloquearam"}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Subir ${c.titulo}`} disabled={pendente || indice === 0} onClick={() => mover(indice, -1)}>
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Descer ${c.titulo}`}
                  disabled={pendente || indice === conquistas.length - 1}
                  onClick={() => mover(indice, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${c.titulo}`} onClick={() => abrirEdicao(c)}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Duplicar ${c.titulo}`}
                  disabled={pendente}
                  onClick={() => executar(() => duplicarConquista(c.id))}
                >
                  <Copy />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Excluir ${c.titulo}`} disabled={pendente} onClick={() => setParaExcluir(c)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={edicao !== null} onOpenChange={(aberto) => !aberto && !salvando && !enviando && setEdicao(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edicao?.id ? "Editar conquista" : "Nova conquista"}</DialogTitle>
            <DialogDescription>O título e o badge aparecem para o aluno; a descrição vai no modal de celebração.</DialogDescription>
          </DialogHeader>

          {edicao && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="conq-titulo">Título</Label>
                <Input
                  id="conq-titulo"
                  value={edicao.titulo}
                  maxLength={LIMITE_TITULO_CONQUISTA}
                  onChange={(e) => atualizar({ titulo: e.target.value })}
                  disabled={salvando}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="conq-descricao">Descrição (opcional)</Label>
                <Textarea
                  id="conq-descricao"
                  value={edicao.descricao}
                  maxLength={LIMITE_DESCRICAO_CONQUISTA}
                  rows={3}
                  onChange={(e) => atualizar({ descricao: e.target.value })}
                  disabled={salvando}
                />
                <span className="text-muted-foreground text-xs">
                  {edicao.descricao.length}/{LIMITE_DESCRICAO_CONQUISTA}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Gatilho</Label>
                <Select
                  items={ITENS_GATILHO}
                  value={edicao.gatilho}
                  onValueChange={(v) => {
                    if (isConquistaGatilho(v)) atualizar({ gatilho: v, valor: gatilhoPedeValor(v) ? edicao.valor : "" });
                  }}
                  disabled={salvando}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONQUISTA_GATILHOS.map((g) => (
                      <SelectItem key={g} value={g}>
                        {CONQUISTA_GATILHO_LABEL[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {regraAtual && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="conq-valor">{regraAtual.rotulo}</Label>
                  <Input
                    id="conq-valor"
                    type="number"
                    inputMode="numeric"
                    min={regraAtual.min}
                    max={regraAtual.max}
                    value={edicao.valor}
                    onChange={(e) => atualizar({ valor: e.target.value })}
                    disabled={salvando}
                  />
                </div>
              )}

              <div className="flex flex-col gap-3">
                <Label>Badge</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={edicao.modoBadge === "emoji" ? "default" : "outline"} onClick={() => atualizar({ modoBadge: "emoji" })}>
                    Emoji
                  </Button>
                  <Button type="button" size="sm" variant={edicao.modoBadge === "imagem" ? "default" : "outline"} onClick={() => atualizar({ modoBadge: "imagem" })}>
                    Imagem
                  </Button>
                </div>

                {edicao.modoBadge === "emoji" ? (
                  <div className="flex items-center gap-3">
                    <ConquistaBadgeImagem url={null} emoji={edicao.emoji} titulo={edicao.titulo || "Badge"} className="size-14 text-3xl" />
                    <Input
                      value={edicao.emoji}
                      maxLength={LIMITE_EMOJI_CONQUISTA}
                      placeholder="🏆"
                      aria-label="Emoji do badge"
                      onChange={(e) => atualizar({ emoji: e.target.value })}
                      disabled={salvando}
                      className="w-28 text-center text-xl"
                    />
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {edicao.imagemUrl ? (
                      <ConquistaBadgeImagem url={edicao.imagemUrl} emoji={null} titulo={edicao.titulo || "Badge"} className="size-14 text-3xl" />
                    ) : (
                      <span className="bg-muted text-muted-foreground flex size-14 items-center justify-center rounded-full text-xs">Sem imagem</span>
                    )}
                    <input ref={inputArquivo} type="file" accept={Object.keys(CONQUISTA_IMAGEM_TIPOS).join(",")} className="hidden" onChange={enviarImagem} />
                    <Button type="button" size="sm" variant="outline" disabled={enviando || salvando} onClick={() => inputArquivo.current?.click()}>
                      <Upload />
                      {enviando ? "Enviando..." : edicao.imagemUrl ? "Trocar imagem" : "Enviar imagem"}
                    </Button>
                    {edicao.imagemUrl && (
                      <Button type="button" size="sm" variant="ghost" disabled={salvando} onClick={() => atualizar({ imagemUrl: "" })}>
                        <X />
                        Remover
                      </Button>
                    )}
                    <span className="text-muted-foreground w-full text-xs">PNG, JPG, WEBP ou GIF, até 1 MB. Quadrada fica melhor.</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="conq-ativo">Ativa</Label>
                <Switch id="conq-ativo" checked={edicao.ativo} onCheckedChange={(v) => atualizar({ ativo: v })} />
              </div>

              {erroForm && (
                <p role="alert" className="text-destructive text-sm">
                  {erroForm}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={salvando || enviando} onClick={() => setEdicao(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={salvando || enviando || !edicao?.titulo.trim()} onClick={salvar}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={paraExcluir !== null} onOpenChange={(aberto) => !pendente && !aberto && setParaExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conquista</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir <strong>{paraExcluir?.titulo}</strong>?{" "}
              {paraExcluir && paraExcluir.totalDesbloqueios > 0
                ? `${paraExcluir.totalDesbloqueios} ${paraExcluir.totalDesbloqueios === 1 ? "aluno perde" : "alunos perdem"} esta conquista. `
                : ""}
              Esta ação não pode ser desfeita. Para apenas escondê-la, desative-a em vez de excluir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendente}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pendente}
              onClick={() => paraExcluir && executar(() => excluirConquista(paraExcluir.id), () => setParaExcluir(null))}
            >
              {pendente ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
