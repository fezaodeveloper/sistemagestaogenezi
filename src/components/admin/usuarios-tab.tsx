"use client";

// "use client": a tabela precisa de estado local (lista otimista após cada ação), dropdown de
// ações, modal de convite e feedback de loading/erro — nada disso é possível em RSC puro.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  alterarRole,
  convidarUsuario,
  reenviarConvite,
  removerUsuario,
  resetarSenha,
  type RoleGerenciavel,
  type UsuarioAdmin,
} from "@/app/admin/configuracoes/actions-usuarios";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MoreHorizontal, UserPlus } from "lucide-react";

const ROLE_LABELS: Record<RoleGerenciavel, string> = { admin: "Administrador", empresa: "Empresa" };
const ROLE_SELECT_ITEMS = { admin: "Administrador", empresa: "Empresa" };

// Mesmas cores "status" já usadas em outras telas do admin (ex.: CAMPANHA_PAGINA_STATUS_BADGE_CLASS).
const ROLE_BADGE_CLASS: Record<RoleGerenciavel, string> = {
  admin: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  empresa: "bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
};
const STATUS_ATIVO_CLASS = "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400";
const STATUS_PENDENTE_CLASS = "bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400";

// Componente local (mesmo padrão de alunos-table.tsx): iniciais + cor derivada do id, sem
// depender de foto.
const AVATAR_CORES = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-violet-500", "bg-cyan-500"];

function corPorId(id: string): string {
  const soma = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_CORES[soma % AVATAR_CORES.length];
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function formatarUltimoAcesso(valor: string | null): string {
  if (!valor) return "Nunca";
  return new Date(valor).toLocaleString("pt-BR");
}

function ConvidarUsuarioDialog({ onConvidado }: { onConvidado: () => void }) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const resultado = await convidarUsuario(formData);
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      formRef.current?.reset();
      setOpen(false);
      onConvidado();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(novoOpen) => {
        setOpen(novoOpen);
        if (!novoOpen) setErro(null);
      }}
    >
      <DialogTrigger render={<Button type="button" />}>
        <UserPlus />
        Convidar usuário
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Convidar usuário</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fullName">Nome completo *</Label>
            <Input id="fullName" name="fullName" required maxLength={200} disabled={isPending} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" name="email" type="email" required maxLength={254} disabled={isPending} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role">Perfil *</Label>
            <Select name="role" items={ROLE_SELECT_ITEMS} defaultValue="admin" disabled={isPending}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="empresa">Empresa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {erro && <p className="text-destructive text-sm">{erro}</p>}

          <p className="text-muted-foreground text-xs">
            O usuário receberá um email com link para definir a senha.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Convidando..." : "Convidar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinhaUsuario({
  usuario,
  souEu,
  onMudou,
}: {
  usuario: UsuarioAdmin;
  souEu: boolean;
  onMudou: (mensagem: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [excluindoOpen, setExcluindoOpen] = useState(false);
  const pendente = !usuario.email_confirmed_at;
  const nome = usuario.full_name ?? usuario.email;

  function handleAlterarRole(novoRole: RoleGerenciavel) {
    startTransition(async () => {
      const resultado = await alterarRole(usuario.id, novoRole);
      onMudou(resultado.ok ? `Perfil de ${nome} alterado para ${ROLE_LABELS[novoRole]}.` : resultado.erro ?? "Erro ao alterar perfil.");
    });
  }

  function handleReenviarConvite() {
    startTransition(async () => {
      const resultado = await reenviarConvite(usuario.id);
      onMudou(resultado.ok ? `Convite reenviado para ${usuario.email}.` : resultado.erro ?? "Erro ao reenviar convite.");
    });
  }

  function handleResetarSenha() {
    startTransition(async () => {
      await resetarSenha(usuario.email);
      onMudou(`Link de redefinição de senha enviado para ${usuario.email}.`);
    });
  }

  function handleRemover() {
    startTransition(async () => {
      const resultado = await removerUsuario(usuario.id);
      setExcluindoOpen(false);
      onMudou(resultado.ok ? `${nome} removido.` : resultado.erro ?? "Erro ao remover usuário.");
    });
  }

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback className={`${corPorId(usuario.id)} text-white`}>{iniciais(nome)}</AvatarFallback>
          </Avatar>
          <span className="font-medium">
            {nome}
            {souEu && <span className="text-muted-foreground ml-1 text-xs">(você)</span>}
          </span>
        </div>
      </TableCell>
      <TableCell>{usuario.email}</TableCell>
      <TableCell>
        <Badge className={ROLE_BADGE_CLASS[usuario.role]}>{ROLE_LABELS[usuario.role]}</Badge>
      </TableCell>
      <TableCell>
        <Badge className={pendente ? STATUS_PENDENTE_CLASS : STATUS_ATIVO_CLASS}>
          {pendente ? "Pendente" : "Ativo"}
        </Badge>
      </TableCell>
      <TableCell>{formatarUltimoAcesso(usuario.last_sign_in_at)}</TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button type="button" variant="ghost" size="icon-sm" disabled={isPending} aria-label="Ações">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {souEu ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuItem disabled onClick={(e) => e.preventDefault()}>
                      Alterar perfil
                    </DropdownMenuItem>
                  }
                />
                <TooltipContent>Você não pode alterar seu próprio perfil</TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Alterar perfil</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem disabled={usuario.role === "admin"} onClick={() => handleAlterarRole("admin")}>
                    Administrador
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={usuario.role === "empresa"} onClick={() => handleAlterarRole("empresa")}>
                    Empresa
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}

            {pendente && <DropdownMenuItem onClick={handleReenviarConvite}>Reenviar convite</DropdownMenuItem>}
            <DropdownMenuItem onClick={handleResetarSenha}>Resetar senha</DropdownMenuItem>

            <DropdownMenuSeparator />

            {souEu ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuItem variant="destructive" disabled onClick={(e) => e.preventDefault()}>
                      Remover usuário
                    </DropdownMenuItem>
                  }
                />
                <TooltipContent>Você não pode remover seu próprio usuário</TooltipContent>
              </Tooltip>
            ) : (
              <AlertDialog open={excluindoOpen} onOpenChange={setExcluindoOpen}>
                <AlertDialogTrigger
                  render={
                    <DropdownMenuItem variant="destructive" onClick={(e) => e.preventDefault()}>
                      Remover usuário
                    </DropdownMenuItem>
                  }
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover usuário</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover {nome}? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleRemover}>
                      {isPending ? "Removendo..." : "Remover"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

export function UsuariosTab({
  usuariosIniciais,
  currentUserId,
}: {
  usuariosIniciais: UsuarioAdmin[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function handleMudou(texto: string) {
    setMensagem(texto);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Usuários do sistema</h2>
          <p className="text-muted-foreground text-sm">Gerencie quem tem acesso ao painel administrativo.</p>
        </div>
        <ConvidarUsuarioDialog onConvidado={() => handleMudou("Convite enviado com sucesso.")} />
      </div>

      {mensagem && <p className="text-muted-foreground text-sm">{mensagem}</p>}

      {usuariosIniciais.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">Nenhum usuário cadastrado além da sua conta.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Último acesso</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuariosIniciais.map((usuario) => (
              <LinhaUsuario
                key={usuario.id}
                usuario={usuario}
                souEu={usuario.id === currentUserId}
                onMudou={handleMudou}
              />
            ))}
          </TableBody>
        </Table>
      )}

      <p className="text-muted-foreground text-xs">
        {usuariosIniciais.length} usuário{usuariosIniciais.length === 1 ? "" : "s"} cadastrado
        {usuariosIniciais.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
