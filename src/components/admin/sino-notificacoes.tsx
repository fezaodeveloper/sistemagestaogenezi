"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { NotificacaoSinoGrupo } from "@/lib/admin/notificacoes";

export function SinoNotificacoes({ grupos }: { grupos: NotificacaoSinoGrupo[] }) {
  const total = grupos.reduce((soma, grupo) => soma + grupo.quantidade, 0);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notificações">
            <Bell />
            {total > 0 && (
              <span className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium text-white">
                {total > 99 ? "99+" : total}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent>
        {grupos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma notificação pendente.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {grupos.map((grupo) => (
              <Link
                key={grupo.tipo}
                href={grupo.href}
                className="hover:bg-accent/50 -mx-2 flex flex-col gap-1 rounded-md px-2 py-1.5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{grupo.titulo}</span>
                  <span className="text-muted-foreground text-xs">{grupo.quantidade}</span>
                </div>
                {grupo.itens && grupo.itens.length > 0 && (
                  <ul className="text-muted-foreground list-disc pl-4 text-xs">
                    {grupo.itens.slice(0, 5).map((item, indice) => (
                      <li key={indice}>{item}</li>
                    ))}
                  </ul>
                )}
              </Link>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
