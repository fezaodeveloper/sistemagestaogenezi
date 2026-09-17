"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Copy, Pencil, Plus } from "lucide-react";
import { alternarStatusPagina } from "@/app/admin/comercial/agendamentos/actions";
import type { AgendamentoPaginaComContagem } from "@/lib/agendamentos/agendamentos";
import { AgendamentoPaginaDialog } from "@/components/admin/agendamento-pagina-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const BASE_URL = "https://sistemagestaogenezi.vercel.app";

function AgendamentoPaginaCard({ pagina }: { pagina: AgendamentoPaginaComContagem }) {
  const router = useRouter();
  const [copiado, setCopiado] = useState(false);
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
