"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Copy, CopyPlus, Pencil, Plus, Trash2 } from "lucide-react";
import {
  alternarStatusPagina,
  duplicarAgendamentoPagina,
  excluirAgendamentoPagina,
} from "@/app/admin/comercial/agendamentos/actions";
import type { AgendamentoPaginaComContagem } from "@/lib/agendamentos/agendamentos";
import { AgendamentoPaginaDialog } from "@/components/admin/agendamento-pagina-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

function AgendamentoPaginaCard({ pagina }: { pagina: AgendamentoPaginaComContagem }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
  const [excluindoOpen, setExcluindoOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const linkPublico = `${BASE_URL}/agendar/${pagina.slug}`;

  function copiarLink() {
    navigator.clipboard
      .writeText(linkPublico)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      })
      .catch(() => {
        // Clipboard indisponível (HTTP sem TLS, permissão negada) — sem
        // fallback, o admin pode copiar a URL exibida manualmente.
      });
  }

  function alternarAtivo() {
    startTransition(async () => {
      await alternarStatusPagina(pagina.id, pagina.status !== "ativa");
      router.refresh();
    });
  }

  function duplicar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await duplicarAgendamentoPagina(pagina.id);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function excluir() {
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirAgendamentoPagina(pagina.id);
      setExcluindoOpen(false);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{pagina.titulo}</p>
          <Badge
            className={
              pagina.status === "ativa"
                ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                : "bg-muted text-muted-foreground"
            }
          >
            {pagina.status === "ativa" ? "Ativa" : "Inativa"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <code className="bg-muted text-muted-foreground flex-1 truncate rounded-md px-2 py-1 text-xs">
            /agendar/{pagina.slug}
          </code>
          <Button type="button" variant="outline" size="icon-sm" onClick={copiarLink} aria-label="Copiar link">
            <Copy className="size-3.5" />
          </Button>
        </div>
        {copiado && <span className="text-muted-foreground text-xs">Link copiado!</span>}

        <p className="text-muted-foreground text-sm">{pagina.totalAgendamentos} agendamento(s)</p>
        {erro && (
          <p role="alert" className="text-destructive text-xs">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-1.5 pt-1">
          <AgendamentoPaginaDialog
            pagina={pagina}
            trigger={
              <Button type="button" variant="ghost" size="sm">
                <Pencil className="size-3.5" />
                Editar
              </Button>
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href={`/admin/comercial/agendamentos/${pagina.id}`} />}
          >
            <Calendar className="size-3.5" />
            Ver agendamentos
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={alternarAtivo}>
            {pagina.status === "ativa" ? "Desativar" : "Ativar"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={isPending}
            onClick={duplicar}
            aria-label="Duplicar página"
            title="Duplicar página"
          >
            <CopyPlus className="size-3.5" />
          </Button>
          <AlertDialog open={excluindoOpen} onOpenChange={setExcluindoOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label="Excluir página"
                  title="Excluir página"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir página de agendamento</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir &quot;{pagina.titulo}&quot;? Os {pagina.totalAgendamentos}{" "}
                  agendamento(s) dessa página também serão excluídos e o link público deixará de funcionar. Esta
                  ação não pode ser desfeita.
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

export function AgendamentosAdminView({ paginas }: { paginas: AgendamentoPaginaComContagem[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <AgendamentoPaginaDialog
          trigger={
            <Button type="button">
              <Plus />
              Nova página
            </Button>
          }
        />
      </div>

      {paginas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma página de agendamento cadastrada ainda.</p>
            <AgendamentoPaginaDialog
              trigger={
                <Button type="button" variant="outline">
                  <Plus />
                  Criar a primeira página
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paginas.map((pagina) => (
            <AgendamentoPaginaCard key={pagina.id} pagina={pagina} />
          ))}
        </div>
      )}
    </div>
  );
}
