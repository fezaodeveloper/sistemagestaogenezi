"use client";

// "use client": a tabela precisa de estado local (filtros, lista derivada, dropdown de ações,
// modal de convite, Sheet de permissões e feedback de loading/erro) — nada disso é possível em
// RSC puro.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  alterarRole,
  convidarUsuario,
  getPermissoesUsuario,
  reenviarConvite,
  removerUsuario,
  resetarSenha,
  salvarPermissoesUsuario,
  type RoleGerenciavel,
  type UsuarioAdmin,
} from "@/app/admin/configuracoes/actions-usuarios";
import type { PermissoesUsuario } from "@/lib/auth/permissions";
import { ACAO_LABELS, ACOES, MODULOS_ADMIN, type AdminAcao, type AdminModuloId } from "@/lib/auth/modulos-permissoes";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock, MoreHorizontal, UserPlus } from "lucide-react";

const ROLE_LABELS: Record<RoleGerenciavel, string> = { admin: "Administrador", empresa: "Empresa" };
const ROLE_SELECT_ITEMS = { admin: "Administrador", empresa: "Empresa" };
const MINUTOS_ATIVO_AGORA = 10;

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

function minutosDesde(valor: string): number {
  return Math.floor((Date.now() - new Date(valor).getTime()) / 60000);
}

function estaAtivoAgora(lastSeenAt: string | null): boolean {
  return lastSeenAt !== null && minutosDesde(lastSeenAt) < MINUTOS_ATIVO_AGORA;
}

function descricaoVisto(lastSeenAt: string | null): string {
  if (!lastSeenAt) return "Nunca visto";
  const minutos = minutosDesde(lastSeenAt);
  if (minutos < MINUTOS_ATIVO_AGORA) return "Ativo agora";
  if (minutos < 60) return `Visto há ${minutos} minuto${minutos === 1 ? "" : "s"}`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Visto há ${horas} hora${horas === 1 ? "" : "s"}`;
  return `Visto há ${Math.floor(horas / 24)} dia(s)`;
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

function permissoesComValor(valor: boolean): PermissoesUsuario {
  return Object.fromEntries(
    MODULOS_ADMIN.map((modulo) => [modulo.id, Object.fromEntries(ACOES.map((acao) => [acao, valor]))]),
  ) as PermissoesUsuario;
}

function PermissoesSheet({
  usuario,
  open,
  onOpenChange,
  onSalvou,
}: {
  usuario: UsuarioAdmin;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSalvou: () => void;
}) {
  const [permissoes, setPermissoes] = useState<PermissoesUsuario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();
  // Carregando = ainda não chegou nem sucesso nem erro desde que o Sheet foi aberto. Reabrir
  // pro mesmo usuário mostra os dados da última vez enquanto busca de novo em segundo plano
  // (mesmo padrão de getLogSistema em log-sistema-view.tsx: só setState dentro do
  // then/catch, nunca direto no corpo do efeito).
  const carregando = open && permissoes === null && erro === null;

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    getPermissoesUsuario(usuario.id)
      .then((dados) => {
        if (!cancelado) setPermissoes(dados);
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar as permissões.");
      });
    return () => {
      cancelado = true;
    };
  }, [open, usuario.id]);

  function alternar(moduloId: AdminModuloId, acao: AdminAcao) {
    setPermissoes((atual) => {
      if (!atual) return atual;
      return { ...atual, [moduloId]: { ...atual[moduloId], [acao]: !atual[moduloId][acao] } };
    });
  }

  function alternarColuna(acao: AdminAcao, valor: boolean) {
    setPermissoes((atual) => {
      if (!atual) return atual;
      const novo = { ...atual };
      for (const modulo of MODULOS_ADMIN) {
        novo[modulo.id] = { ...novo[modulo.id], [acao]: valor };
      }
      return novo;
    });
  }

  function handleSalvar() {
    if (!permissoes) return;
    setErro(null);
    startSaving(async () => {
      const resultado = await salvarPermissoesUsuario(usuario.id, permissoes);
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível salvar as permissões.");
        return;
      }
      onOpenChange(false);
      onSalvou();
    });
  }

  const nome = usuario.full_name ?? usuario.email;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Permissões de {nome}</SheetTitle>
          <p className="text-muted-foreground text-sm">Defina o que este usuário pode fazer em cada módulo.</p>
        </SheetHeader>

        <div className="flex flex-col gap-4 px-4">
          {!usuario.tem_permissoes_customizadas && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              Este usuário tem acesso total ao sistema. Ao salvar qualquer permissão, o acesso passa a ser
              controlado por este painel.
            </div>
          )}

          {carregando && <p className="text-muted-foreground text-sm">Carregando permissões...</p>}
          {erro && <p className="text-destructive text-sm">{erro}</p>}

          {permissoes && !carregando && (
            <>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPermissoes(permissoesComValor(true))}>
                  Acesso total
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPermissoes(permissoesComValor(false))}>
                  Revogar tudo
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Módulo</TableHead>
                    {ACOES.map((acao) => {
                      const todosMarcados = MODULOS_ADMIN.every((modulo) => permissoes[modulo.id][acao]);
                      return (
                        <TableHead key={acao} className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span>{ACAO_LABELS[acao]}</span>
                            <Checkbox
                              checked={todosMarcados}
                              onCheckedChange={(valor) => alternarColuna(acao, valor === true)}
                              aria-label={`Selecionar ${ACAO_LABELS[acao]} para todos os módulos`}
                            />
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULOS_ADMIN.map((modulo) => (
                    <TableRow key={modulo.id}>
                      <TableCell className="font-medium">{modulo.label}</TableCell>
                      {ACOES.map((acao) => (
                        <TableCell key={acao} className="text-center">
                          <Checkbox
                            checked={permissoes[modulo.id][acao]}
                            onCheckedChange={() => alternar(modulo.id, acao)}
                            aria-label={`${ACAO_LABELS[acao]} em ${modulo.label}`}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </div>

        <SheetFooter>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSalvar} disabled={isSaving || carregando || !permissoes}>
              {isSaving ? "Salvando..." : "Salvar permissões"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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
  const [permissoesOpen, setPermissoesOpen] = useState(false);
  const pendente = !usuario.email_confirmed_at;
  const ativoAgora = estaAtivoAgora(usuario.last_seen_at);
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
          <div className="flex flex-col">
            <span className="font-medium">
              {nome}
              {souEu && <span className="text-muted-foreground ml-1 text-xs">(você)</span>}
            </span>
            {usuario.tem_permissoes_customizadas && (
              <Badge variant="outline" className="h-4 w-fit px-1 text-[10px]">
                Permissões customizadas
              </Badge>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>{usuario.email}</TableCell>
      <TableCell>
        <Badge className={ROLE_BADGE_CLASS[usuario.role]}>{ROLE_LABELS[usuario.role]}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge className={pendente ? STATUS_PENDENTE_CLASS : STATUS_ATIVO_CLASS}>
            {pendente ? "Pendente" : "Ativo"}
          </Badge>
          <Tooltip>
            <TooltipTrigger
              render={
                <span
                  className={`size-2 rounded-full ${ativoAgora ? "animate-pulse bg-green-500" : "bg-muted-foreground/30"}`}
                />
              }
            />
            <TooltipContent>{descricaoVisto(usuario.last_seen_at)}</TooltipContent>
          </Tooltip>
        </div>
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

            {souEu ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <DropdownMenuItem disabled onClick={(e) => e.preventDefault()}>
                      <Lock className="size-3.5" />
                      Gerenciar permissões
                    </DropdownMenuItem>
                  }
                />
                <TooltipContent>Você não pode alterar suas próprias permissões</TooltipContent>
              </Tooltip>
            ) : (
              <DropdownMenuItem onClick={() => setPermissoesOpen(true)}>
                <Lock className="size-3.5" />
                Gerenciar permissões
              </DropdownMenuItem>
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

        {!souEu && (
          <PermissoesSheet
            usuario={usuario}
            open={permissoesOpen}
            onOpenChange={setPermissoesOpen}
            onSalvou={() => onMudou(`Permissões de ${nome} atualizadas.`)}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

const STATUS_FILTRO_ITEMS = { "": "Todos", ativo: "Ativo", pendente: "Pendente" };
const ROLE_FILTRO_ITEMS = { "": "Todos", admin: "Administrador", empresa: "Empresa" };

export function UsuariosTab({
  usuariosIniciais,
  currentUserId,
}: {
  usuariosIniciais: UsuarioAdmin[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [somenteAtivosAgora, setSomenteAtivosAgora] = useState(false);

  function handleMudou(texto: string) {
    setMensagem(texto);
    router.refresh();
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return usuariosIniciais.filter((usuario) => {
      if (termo) {
        const nome = (usuario.full_name ?? "").toLowerCase();
        const email = usuario.email.toLowerCase();
        if (!nome.includes(termo) && !email.includes(termo)) return false;
      }
      if (filtroRole && usuario.role !== filtroRole) return false;
      if (filtroStatus === "pendente" && usuario.email_confirmed_at) return false;
      if (filtroStatus === "ativo" && !usuario.email_confirmed_at) return false;
      if (somenteAtivosAgora && !estaAtivoAgora(usuario.last_seen_at)) return false;
      return true;
    });
  }, [usuariosIniciais, busca, filtroRole, filtroStatus, somenteAtivosAgora]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Usuários do sistema</h2>
          <p className="text-muted-foreground text-sm">Gerencie quem tem acesso ao painel administrativo.</p>
        </div>
        <ConvidarUsuarioDialog onConvidado={() => handleMudou("Convite enviado com sucesso.")} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por nome ou email..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-xs"
        />
        <Select items={ROLE_FILTRO_ITEMS} value={filtroRole} onValueChange={(v) => setFiltroRole(v ?? "")}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os perfis</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="empresa">Empresa</SelectItem>
          </SelectContent>
        </Select>
        <Select items={STATUS_FILTRO_ITEMS} value={filtroStatus} onValueChange={(v) => setFiltroStatus(v ?? "")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 pb-0.5">
          <Switch id="ativos-agora" checked={somenteAtivosAgora} onCheckedChange={setSomenteAtivosAgora} />
          <Label htmlFor="ativos-agora" className="text-sm font-normal">
            Ativos agora
          </Label>
        </div>
      </div>

      {mensagem && <p className="text-muted-foreground text-sm">{mensagem}</p>}

      {usuariosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {usuariosIniciais.length === 0 ? "Nenhum usuário cadastrado além da sua conta." : "Nenhum usuário encontrado com os filtros aplicados."}
        </p>
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
            {usuariosFiltrados.map((usuario) => (
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
        Mostrando {usuariosFiltrados.length} de {usuariosIniciais.length} usuário{usuariosIniciais.length === 1 ? "" : "s"}.
      </p>
    </div>
  );
}
