"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Bell, Briefcase, Home, Menu, Trash2, User, Users } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { excluirMinhaContaEmpresa } from "@/app/empresa/(protegido)/perfil/actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { PwaInstallButton } from "@/components/aluno/pwa-install-button";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/empresa/painel", icon: Home },
  { label: "Vagas", href: "/empresa/vagas", icon: Briefcase },
  { label: "Candidatos", href: "/empresa/candidatos", icon: Users },
  { label: "Notificações", href: "/empresa/notificacoes", icon: Bell },
] as const;

function ExcluirContaButton() {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirMinhaContaEmpresa();
      if (resultado?.error) {
        setError(resultado.error);
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setError(null);
          setConfirmacao("");
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button type="button" variant="outline" className="text-destructive w-full justify-start">
            <Trash2 className="size-4" />
            Excluir conta
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir conta</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza? Essa ação é irreversível — seus dados, vagas e candidatos vinculados
            serão apagados. Digite <strong>EXCLUIR</strong> para confirmar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmacao_excluir" className="sr-only">
            Confirmação
          </Label>
          <Input
            id="confirmacao_excluir"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder="Digite EXCLUIR"
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
            disabled={confirmacao !== "EXCLUIR" || isPending}
            onClick={handleExcluir}
          >
            {isPending ? "Excluindo..." : "Excluir conta"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function EmpresaBottomNav({ notificacoesNaoLidas }: { notificacoesNaoLidas: number }) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const [menuAberto, setMenuAberto] = useState(false);
  const [isPendingSair, startTransitionSair] = useTransition();

  if (!isMobile) return null;

  return (
    <>
      <nav className="bg-background fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t px-2 md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5", isActive && "stroke-[2.5]")} />
              <span>{item.label}</span>
              {item.href === "/empresa/notificacoes" && notificacoesNaoLidas > 0 && (
                <Badge className="bg-destructive absolute -top-1 right-0 size-4 justify-center p-0 text-[10px] text-white">
                  {notificacoesNaoLidas}
                </Badge>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuAberto(true)}
          className="text-muted-foreground hover:text-foreground flex flex-col items-center gap-1 rounded-md px-3 py-2 text-xs transition-colors"
        >
          <Menu className="size-5" />
          <span>Mais</span>
        </button>
      </nav>

      <Sheet open={menuAberto} onOpenChange={setMenuAberto}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Mais opções</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 p-4">
            <SheetClose
              render={
                <Link
                  href="/empresa/perfil"
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <User className="size-4" />
                  Meu perfil
                </Link>
              }
            />
            <PwaInstallButton />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              disabled={isPendingSair}
              onClick={() => startTransitionSair(() => signOut())}
            >
              Sair
            </Button>
            <ExcluirContaButton />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
