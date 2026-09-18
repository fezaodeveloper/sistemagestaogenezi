"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, FileText, Pencil, Trash2 } from "lucide-react";
import {
  alternarStatusCampanhaPagina,
  duplicarCampanhaPagina,
  excluirCampanhaPagina,
} from "@/app/admin/comercial/paginas-campanha/actions";
import { CAMPANHA_PAGINA_STATUS_BADGE_CLASS, CAMPANHA_PAGINA_STATUS_LABELS } from "@/lib/campanha-paginas/schema";
import type { CampanhaPaginaComContagem } from "@/lib/campanha-paginas/campanha-paginas";
import { LIMITE_PADRAO } from "@/lib/paginacao";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const BASE_URL = "https://sistemagestaogenezi.vercel.app";
const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = { [STATUS_FILTRO_TODOS]: "Todos os status", ...CAMPANHA_PAGINA_STATUS_LABELS };

function diasRestantes(dataFim: string): number {
  return Math.ceil((new Date(dataFim).getTime() - Date.now()) / 86400000);
}

function CampanhaPaginaCard({ pagina }: { pagina: CampanhaPaginaComContagem }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [excluindoOpen, setExcluindoOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const linkPublico = `${BASE_URL}/campanha/${pagina.slug}`;

  function copiarLink() {
    navigator.clipboard
      .writeText(linkPublico)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => {
        // Sem acesso ao clipboard — o admin pode copiar a URL manualmente.
      });
  }

  function alternarAtivo() {
    startTransition(async () => {
      await alternarStatusCampanhaPagina(pagina.id, pagina.status !== "ativa");
      router.refresh();
    });
  }

  function duplicar() {
    startTransition(async () => {
      await duplicarCampanhaPagina(pagina.id);
      router.refresh();
    });
  }

  function excluir() {
    startTransition(async () => {
      await excluirCampanhaPagina(pagina.id);
      setExcluindoOpen(false);
      router.refresh();
    });
  }

  const dias = pagina.status === "ativa" && pagina.data_fim ? diasRestantes(pagina.data_fim) : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{pagina.titulo}</p>
          <Badge className={CAMPANHA_PAGINA_STATUS_BADGE_CLASS[pagina.status]}>
            {CAMPANHA_PAGINA_STATUS_LABELS[pagina.status]}
          </Badge>
        </div>

        <p className="text-muted-foreground text-xs capitalize">Tema {pagina.tema}</p>

        <div className="flex items-center gap-2">
          <code className="bg-muted text-muted-foreground flex-1 truncate rounded-md px-2 py-1 text-xs">
            /campanha/{pagina.slug}
          </code>
          <Button type="button" variant="outline" size="icon-sm" onClick={copiarLink} aria-label="Copiar link">
            <Copy className="size-3.5" />
          </Button>
        </div>
        {copiado && <span className="text-muted-foreground text-xs">Link copiado!</span>}

        <p className="text-muted-foreground text-sm">{pagina.totalRespostas} resposta(s)</p>
        {dias !== null && (
          <p className="text-muted-foreground text-xs">
            {dias > 0 ? `Termina em ${dias} dia(s)` : "Prazo encerrado"}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-1.5 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/comercial/paginas-campanha/${pagina.id}`} />}
          >
            <Pencil className="size-3.5" />
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/comercial/paginas-campanha/${pagina.id}/respostas`} />}
          >
            <FileText className="size-3.5" />
            Ver respostas
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={duplicar}>
            Duplicar
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={alternarAtivo}>
            {pagina.status === "ativa" ? "Desativar" : "Ativar"}
          </Button>
          <AlertDialog open={excluindoOpen} onOpenChange={setExcluindoOpen}>
            <AlertDialogTrigger
              render={
                <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label="Excluir página">
                  <Trash2 className="size-3.5" />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir página de campanha</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir &quot;{pagina.titulo}&quot;? Todas as {pagina.totalRespostas}{" "}
                  resposta(s) recebidas também serão excluídas. Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={isPending} onClick={excluir}>
                  {isPending ? "Excluindo..." : "Excluir"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

export function CampanhaPaginasView({
  paginas,
  totalRegistros,
  paginaAtual,
  totalPaginas,
  query,
  status,
}: {
  paginas: CampanhaPaginaComContagem[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
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
    const queryString = params.toString();
    return queryString ? `/admin/comercial/paginas-campanha?${queryString}` : "/admin/comercial/paginas-campanha";
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(construirUrl({ q: valor }));
    }, 500);
  }

  function handleStatusChange(valor: string | null) {
    if (!valor) return;
    router.push(construirUrl({ status: valor }));
  }

  const paginacaoSearchParams: Record<string, string> = {};
  if (query) paginacaoSearchParams.q = query;
  if (status) paginacaoSearchParams.status = status;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por título..."
          value={busca}
          onChange={(event) => handleBuscaChange(event.target.value)}
          className="max-w-sm"
        />
        <Select items={STATUS_FILTRO_ITEMS} value={status || STATUS_FILTRO_TODOS} onValueChange={handleStatusChange}>
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

      {paginas.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma página encontrada com os filtros aplicados.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginas.map((pagina) => (
            <CampanhaPaginaCard key={pagina.id} pagina={pagina} />
          ))}
        </div>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={LIMITE_PADRAO}
        baseUrl="/admin/comercial/paginas-campanha"
        searchParams={paginacaoSearchParams}
      />
    </div>
  );
}
