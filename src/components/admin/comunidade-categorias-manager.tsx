"use client";

// "use client": reordenação por arrastar (drag & drop nativo) e botões, diálogo de edição e
// Server Actions.

import { useState, useTransition, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus } from "lucide-react";
import {
  alternarCategoriaAtiva,
  reordenarCategorias,
  salvarCategoria,
} from "@/app/admin/configuracoes/portal-aluno/comunidade/actions";
import {
  COR_CATEGORIA_PADRAO,
  LIMITE_DESCRICAO_CATEGORIA,
  LIMITE_ICONE_CATEGORIA,
  LIMITE_NOME_CATEGORIA,
  REGEX_COR_HEX,
  type CategoriaView,
} from "@/lib/comunidade/tipos";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type Edicao = {
  id?: string;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  somenteAdmin: boolean;
  ativo: boolean;
};

const NOVA: Edicao = { nome: "", descricao: "", icone: "", cor: COR_CATEGORIA_PADRAO, somenteAdmin: false, ativo: true };

export function ComunidadeCategoriasManager({ categorias }: { categorias: CategoriaView[] }) {
  const router = useRouter();
  const [lista, setLista] = useState(categorias);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [sobreId, setSobreId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, startTransition] = useTransition();

  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, startSalvar] = useTransition();

  function mover(origemId: string, destinoId: string) {
    if (origemId === destinoId) return;
    const de = lista.findIndex((c) => c.id === origemId);
    const para = lista.findIndex((c) => c.id === destinoId);
    if (de === -1 || para === -1) return;

    const anterior = lista;
    const proxima = [...lista];
    const [item] = proxima.splice(de, 1);
    proxima.splice(para, 0, item);
    setLista(proxima);
    setErro(null);

    startTransition(async () => {
      const r = await reordenarCategorias(proxima.map((c) => c.id));
      if ("error" in r) {
        setLista(anterior);
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  function moverPara(indice: number, delta: -1 | 1) {
    const destino = lista[indice + delta];
    if (destino) mover(lista[indice].id, destino.id);
  }

  function alternarAtivo(c: CategoriaView) {
    setErro(null);
    const anterior = lista;
    setLista(lista.map((x) => (x.id === c.id ? { ...x, ativo: !x.ativo } : x)));
    startTransition(async () => {
      const r = await alternarCategoriaAtiva(c.id, !c.ativo);
      if ("error" in r) {
        setLista(anterior);
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  function abrirEdicao(c: CategoriaView) {
    setErroForm(null);
    setEdicao({
      id: c.id,
      nome: c.nome,
      descricao: c.descricao ?? "",
      icone: c.icone,
      cor: c.cor,
      somenteAdmin: c.somenteAdmin,
      ativo: c.ativo,
    });
  }

  function salvar() {
    if (!edicao) return;
    setErroForm(null);
    startSalvar(async () => {
      const r = await salvarCategoria(edicao);
      if ("error" in r) {
        setErroForm(r.error);
        return;
      }
      setEdicao(null);
      router.refresh();
    });
  }

  function atualizar(parcial: Partial<Edicao>) {
    setEdicao((atual) => (atual ? { ...atual, ...parcial } : atual));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Categorias</h3>
          <p className="text-muted-foreground text-sm">
            Arraste (ou use as setas) para reordenar. Categorias desativadas somem para os alunos, mas os posts são mantidos.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setErroForm(null);
            setEdicao(NOVA);
          }}
        >
          <Plus />
          Nova categoria
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {lista.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma categoria cadastrada. Crie a primeira para os alunos poderem publicar.
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((c, indice) => (
            <li
              key={c.id}
              draggable
              onDragStart={(e: DragEvent<HTMLLIElement>) => {
                e.dataTransfer.setData("text/plain", c.id);
                e.dataTransfer.effectAllowed = "move";
                setArrastandoId(c.id);
              }}
              onDragEnd={() => {
                setArrastandoId(null);
                setSobreId(null);
              }}
              onDragOver={(e) => {
                if (!arrastandoId) return;
                e.preventDefault(); // sem isso o navegador não aceita o drop
                e.dataTransfer.dropEffect = "move";
                setSobreId(c.id);
              }}
              onDragLeave={() => setSobreId((atual) => (atual === c.id ? null : atual))}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastandoId) mover(arrastandoId, c.id);
                setArrastandoId(null);
                setSobreId(null);
              }}
              className={`bg-card flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                arrastandoId === c.id ? "opacity-40" : ""
              } ${sobreId === c.id && arrastandoId !== c.id ? "ring-primary/50 ring-2" : ""} ${c.ativo ? "" : "opacity-70"}`}
            >
              <GripVertical className="text-muted-foreground size-4 shrink-0 cursor-grab" aria-hidden />
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-lg"
                style={{ backgroundColor: `${c.cor}26`, boxShadow: `inset 0 0 0 1px ${c.cor}` }}
                aria-hidden
              >
                {c.icone}
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {c.nome}
                  {c.somenteAdmin && <Badge variant="secondary">Só a equipe posta</Badge>}
                  {!c.ativo && <Badge variant="outline">Desativada</Badge>}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {c.totalPosts} {c.totalPosts === 1 ? "post ativo" : "posts ativos"}
                  {c.descricao ? ` · ${c.descricao}` : ""}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Subir ${c.nome}`}
                  disabled={pendente || indice === 0}
                  onClick={() => moverPara(indice, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Descer ${c.nome}`}
                  disabled={pendente || indice === lista.length - 1}
                  onClick={() => moverPara(indice, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={`Editar ${c.nome}`} onClick={() => abrirEdicao(c)}>
                  <Pencil />
                </Button>
                <Switch
                  checked={c.ativo}
                  onCheckedChange={() => alternarAtivo(c)}
                  disabled={pendente}
                  aria-label={c.ativo ? `Desativar ${c.nome}` : `Ativar ${c.nome}`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={edicao !== null} onOpenChange={(aberto) => !aberto && !salvando && setEdicao(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{edicao?.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            <DialogDescription>Nome, ícone (emoji) e cor aparecem para os alunos.</DialogDescription>
          </DialogHeader>

          {edicao && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cat-nome">Nome</Label>
                <Input
                  id="cat-nome"
                  value={edicao.nome}
                  maxLength={LIMITE_NOME_CATEGORIA}
                  onChange={(e) => atualizar({ nome: e.target.value })}
                  disabled={salvando}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="cat-descricao">Descrição</Label>
                <Textarea
                  id="cat-descricao"
                  value={edicao.descricao}
                  maxLength={LIMITE_DESCRICAO_CATEGORIA}
                  rows={2}
                  onChange={(e) => atualizar({ descricao: e.target.value })}
                  disabled={salvando}
                />
              </div>

              <div className="grid grid-cols-[6rem_1fr] gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cat-icone">Ícone</Label>
                  <Input
                    id="cat-icone"
                    value={edicao.icone}
                    maxLength={LIMITE_ICONE_CATEGORIA}
                    placeholder="💬"
                    onChange={(e) => atualizar({ icone: e.target.value })}
                    disabled={salvando}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cat-cor">Cor</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="Escolher cor"
                      value={REGEX_COR_HEX.test(edicao.cor) ? edicao.cor : COR_CATEGORIA_PADRAO}
                      onChange={(e) => atualizar({ cor: e.target.value })}
                      disabled={salvando}
                      className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1"
                    />
                    <Input
                      id="cat-cor"
                      value={edicao.cor}
                      maxLength={7}
                      onChange={(e) => atualizar({ cor: e.target.value })}
                      disabled={salvando}
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="cat-somente-admin">Somente a equipe publica</Label>
                  <p className="text-muted-foreground text-xs">Alunos leem e respondem, mas não criam posts (ex.: Avisos).</p>
                </div>
                <Switch id="cat-somente-admin" checked={edicao.somenteAdmin} onCheckedChange={(v) => atualizar({ somenteAdmin: v })} />
              </div>

              <div className="flex items-start justify-between gap-4">
                <Label htmlFor="cat-ativo">Ativa</Label>
                <Switch id="cat-ativo" checked={edicao.ativo} onCheckedChange={(v) => atualizar({ ativo: v })} />
              </div>

              {erroForm && (
                <p role="alert" className="text-destructive text-sm">
                  {erroForm}
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={salvando} onClick={() => setEdicao(null)}>
              Cancelar
            </Button>
            <Button type="button" disabled={salvando || !edicao?.nome.trim()} onClick={salvar}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
