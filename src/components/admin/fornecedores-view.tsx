"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import {
  atualizarFornecedor,
  buscarCepFornecedor,
  criarFornecedor,
  excluirFornecedor,
  type FornecedorOrderBy,
} from "@/app/admin/fornecedores/actions";
import { formatCep, formatTelefone } from "@/lib/alunos/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Paginacao } from "@/components/ui/paginacao";
import { LIMITE_PADRAO } from "@/lib/paginacao";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  FORNECEDOR_CATEGORIAS,
  FORNECEDOR_CATEGORIA_BADGE_CLASS,
  FORNECEDOR_CATEGORIA_LABELS,
  type Fornecedor,
} from "@/lib/fornecedores/schema";

const CATEGORIA_FILTRO_TODAS = "todas";
const CATEGORIA_FILTRO_ITEMS: Record<string, string> = {
  [CATEGORIA_FILTRO_TODAS]: "Todas as categorias",
  ...FORNECEDOR_CATEGORIA_LABELS,
};

const ORDER_BY_ITEMS: Record<string, string> = {
  nome: "Nome (A-Z)",
  empresa: "Empresa (A-Z)",
  recente: "Mais recente",
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos",
  ativos: "Ativos",
  inativos: "Inativos",
};

const TEXTO_CONFIRMACAO_EXCLUSAO = "EXCLUIR";

type CepResultado = { endereco: string; cidade: string; estado: string };

// Compartilhado entre Novo/EditarFornecedorDialog — dispara a busca assim
// que o CEP tiver 8 dígitos, mesmo padrão de aluno-create-form.tsx, só que
// via Server Action (buscarCepFornecedor) em vez de fetch direto no client,
// já que o formulário aqui é um Dialog sem página própria.
function useCepFornecedor(cep: string) {
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<CepResultado | null>(null);

  useEffect(() => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;

    let cancelado = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuscando(true);
    setErro(null);

    buscarCepFornecedor(cep).then((resposta) => {
      if (cancelado) return;
      if ("error" in resposta) {
        setErro(resposta.error);
      } else {
        setResultado(resposta);
      }
      setBuscando(false);
    });

    return () => {
      cancelado = true;
    };
  }, [cep]);

  return { buscando, erro, resultado };
}

function WhatsAppCelula({ whatsapp }: { whatsapp: string | null }) {
  if (!whatsapp) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-1.5">
      <MessageCircle className="size-4 text-green-600 dark:text-green-400" />
      {formatTelefone(whatsapp)}
    </span>
  );
}

function NovoFornecedorDialog({ onCriado }: { onCriado: () => void }) {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<string>("outro");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { buscando: buscandoCep, erro: erroCep, resultado: cepResultado } = useCepFornecedor(cep);

  useEffect(() => {
    if (!cepResultado) return;
    // Sincroniza os campos editáveis com o resultado do ViaCEP assim que
    // ele chega — side-effect real (resultado de uma chamada de rede via
    // Server Action), mesmo caso documentado em aluno-create-form.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEndereco(cepResultado.endereco);
    setCidade(cepResultado.cidade);
    setEstado(cepResultado.estado);
  }, [cepResultado]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setCategoria("outro");
      setTelefone("");
      setWhatsapp("");
      setCep("");
      setEndereco("");
      setCidade("");
      setEstado("");
      setAtivo(true);
      setError(null);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await criarFornecedor(formData);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onCriado();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Novo fornecedor
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Novo fornecedor</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome_contato">Nome do contato</Label>
              <Input id="nome_contato" name="nome_contato" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome_empresa">Nome da empresa</Label>
              <Input id="nome_empresa" name="nome_empresa" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="categoria">Categoria</Label>
              <Select
                name="categoria"
                items={FORNECEDOR_CATEGORIA_LABELS}
                value={categoria}
                onValueChange={(value) => setCategoria(value as string)}
              >
                <SelectTrigger id="categoria" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORNECEDOR_CATEGORIAS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {FORNECEDOR_CATEGORIA_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                name="telefone"
                value={telefone}
                onChange={(event) => setTelefone(formatTelefone(event.target.value))}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" placeholder="Opcional" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                name="whatsapp"
                value={whatsapp}
                onChange={(event) => setWhatsapp(formatTelefone(event.target.value))}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="site">Site</Label>
            <Input id="site" name="site" placeholder="Opcional" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cep">CEP</Label>
            <Input
              id="cep"
              name="cep"
              value={cep}
              onChange={(event) => setCep(formatCep(event.target.value))}
              placeholder="Opcional"
              className="max-w-40"
            />
            {buscandoCep && <p className="text-muted-foreground text-xs">Buscando endereço...</p>}
            {erroCep && cep.replace(/\D/g, "").length === 8 && (
              <p className="text-muted-foreground text-xs">{erroCep}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input
              id="endereco"
              name="endereco"
              value={endereco}
              onChange={(event) => setEndereco(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                name="cidade"
                value={cidade}
                onChange={(event) => setCidade(event.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="estado">Estado</Label>
              <Input
                id="estado"
                name="estado"
                value={estado}
                onChange={(event) => setEstado(event.target.value.toUpperCase())}
                maxLength={2}
                placeholder="UF"
                className="max-w-24"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea id="observacoes" name="observacoes" rows={3} placeholder="Opcional" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="ativo" className="font-normal">
              Ativo
            </Label>
            <Switch id="ativo" name="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarFornecedorDialog({
  fornecedor,
  onSalvo,
}: {
  fornecedor: Fornecedor;
  onSalvo: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [categoria, setCategoria] = useState<string>(fornecedor.categoria);
  const [telefone, setTelefone] = useState(fornecedor.telefone ? formatTelefone(fornecedor.telefone) : "");
  const [whatsapp, setWhatsapp] = useState(fornecedor.whatsapp ? formatTelefone(fornecedor.whatsapp) : "");
  const [cep, setCep] = useState(fornecedor.cep ? formatCep(fornecedor.cep) : "");
  const [endereco, setEndereco] = useState(fornecedor.endereco ?? "");
  const [cidade, setCidade] = useState(fornecedor.cidade ?? "");
  const [estado, setEstado] = useState(fornecedor.estado ?? "");
  const [ativo, setAtivo] = useState(fornecedor.ativo);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const { buscando: buscandoCep, erro: erroCep, resultado: cepResultado } = useCepFornecedor(cep);

  useEffect(() => {
    if (!cepResultado) return;
    // Sincroniza os campos editáveis com o resultado do ViaCEP assim que
    // ele chega — side-effect real (resultado de uma chamada de rede via
    // Server Action), mesmo caso documentado em aluno-create-form.tsx.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEndereco(cepResultado.endereco);
    setCidade(cepResultado.cidade);
    setEstado(cepResultado.estado);
  }, [cepResultado]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setCategoria(fornecedor.categoria);
      setTelefone(fornecedor.telefone ? formatTelefone(fornecedor.telefone) : "");
      setWhatsapp(fornecedor.whatsapp ? formatTelefone(fornecedor.whatsapp) : "");
      setCep(fornecedor.cep ? formatCep(fornecedor.cep) : "");
      setEndereco(fornecedor.endereco ?? "");
      setCidade(fornecedor.cidade ?? "");
      setEstado(fornecedor.estado ?? "");
      setAtivo(fornecedor.ativo);
      setError(null);
    }
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const resultado = await atualizarFornecedor(fornecedor.id, formData);
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
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Editar fornecedor">
            <Pencil />
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar fornecedor</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`nome_contato-${fornecedor.id}`}>Nome do contato</Label>
              <Input
                id={`nome_contato-${fornecedor.id}`}
                name="nome_contato"
                defaultValue={fornecedor.nome_contato}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`nome_empresa-${fornecedor.id}`}>Nome da empresa</Label>
              <Input
                id={`nome_empresa-${fornecedor.id}`}
                name="nome_empresa"
                defaultValue={fornecedor.nome_empresa}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`categoria-${fornecedor.id}`}>Categoria</Label>
              <Select
                name="categoria"
                items={FORNECEDOR_CATEGORIA_LABELS}
                value={categoria}
                onValueChange={(value) => setCategoria(value as string)}
              >
                <SelectTrigger id={`categoria-${fornecedor.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FORNECEDOR_CATEGORIAS.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {FORNECEDOR_CATEGORIA_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`telefone-${fornecedor.id}`}>Telefone</Label>
              <Input
                id={`telefone-${fornecedor.id}`}
                name="telefone"
                value={telefone}
                onChange={(event) => setTelefone(formatTelefone(event.target.value))}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`email-${fornecedor.id}`}>E-mail</Label>
              <Input
                id={`email-${fornecedor.id}`}
                name="email"
                type="email"
                defaultValue={fornecedor.email ?? ""}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`whatsapp-${fornecedor.id}`}>WhatsApp</Label>
              <Input
                id={`whatsapp-${fornecedor.id}`}
                name="whatsapp"
                value={whatsapp}
                onChange={(event) => setWhatsapp(formatTelefone(event.target.value))}
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`site-${fornecedor.id}`}>Site</Label>
            <Input
              id={`site-${fornecedor.id}`}
              name="site"
              defaultValue={fornecedor.site ?? ""}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`cep-${fornecedor.id}`}>CEP</Label>
            <Input
              id={`cep-${fornecedor.id}`}
              name="cep"
              value={cep}
              onChange={(event) => setCep(formatCep(event.target.value))}
              placeholder="Opcional"
              className="max-w-40"
            />
            {buscandoCep && <p className="text-muted-foreground text-xs">Buscando endereço...</p>}
            {erroCep && cep.replace(/\D/g, "").length === 8 && (
              <p className="text-muted-foreground text-xs">{erroCep}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`endereco-${fornecedor.id}`}>Endereço</Label>
            <Input
              id={`endereco-${fornecedor.id}`}
              name="endereco"
              value={endereco}
              onChange={(event) => setEndereco(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`cidade-${fornecedor.id}`}>Cidade</Label>
              <Input
                id={`cidade-${fornecedor.id}`}
                name="cidade"
                value={cidade}
                onChange={(event) => setCidade(event.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`estado-${fornecedor.id}`}>Estado</Label>
              <Input
                id={`estado-${fornecedor.id}`}
                name="estado"
                value={estado}
                onChange={(event) => setEstado(event.target.value.toUpperCase())}
                maxLength={2}
                placeholder="UF"
                className="max-w-24"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`observacoes-${fornecedor.id}`}>Observações</Label>
            <Textarea
              id={`observacoes-${fornecedor.id}`}
              name="observacoes"
              rows={3}
              defaultValue={fornecedor.observacoes ?? ""}
              placeholder="Opcional"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor={`ativo-${fornecedor.id}`} className="font-normal">
              Ativo
            </Label>
            <Switch id={`ativo-${fornecedor.id}`} name="ativo" checked={ativo} onCheckedChange={setAtivo} />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExcluirFornecedorButton({
  fornecedor,
  onExcluido,
}: {
  fornecedor: Fornecedor;
  onExcluido: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await excluirFornecedor(fornecedor.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setOpen(false);
      onExcluido();
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
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            aria-label="Excluir fornecedor"
          >
            <Trash2 />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir fornecedor</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir &quot;{fornecedor.nome_empresa}&quot;? Esta ação não pode
            ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`confirmacao-exclusao-${fornecedor.id}`} className="text-sm font-normal">
            Digite <span className="font-mono font-semibold">EXCLUIR</span> para confirmar
          </Label>
          <Input
            id={`confirmacao-exclusao-${fornecedor.id}`}
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

export function FornecedoresView({
  fornecedores,
  totalRegistros,
  paginaAtual,
  totalPaginas,
  limite,
  query,
  categoria,
  orderBy,
}: {
  fornecedores: Fornecedor[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  limite: number;
  query: string;
  categoria: string;
  orderBy: FornecedorOrderBy;
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(query);
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL "limpa": só entra o que difere do padrão — mesma convenção de
  // construirHref (paginacao.tsx) e das outras listas com ordenação
  // (cursos-table.tsx, turmas-table.tsx). Trocar categoria/ordenação/busca
  // sempre volta pra página 1 (omite "page").
  function construirUrl(overrides: {
    q?: string;
    categoria?: string;
    orderBy?: FornecedorOrderBy;
  }) {
    const params = new URLSearchParams();
    const q = overrides.q ?? busca;
    const cat = overrides.categoria ?? categoria;
    const ord = overrides.orderBy ?? orderBy;
    if (q.trim()) params.set("q", q.trim());
    if (cat !== CATEGORIA_FILTRO_TODAS) params.set("categoria", cat);
    if (ord !== "nome") params.set("orderBy", ord);
    if (limite !== LIMITE_PADRAO) params.set("limit", String(limite));
    const queryString = params.toString();
    return queryString ? `/admin/fornecedores?${queryString}` : "/admin/fornecedores";
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.push(construirUrl({ q: valor }));
    }, 500);
  }

  function handleCategoriaChange(valor: string) {
    router.push(construirUrl({ categoria: valor }));
  }

  function handleOrderByChange(valor: string) {
    router.push(construirUrl({ orderBy: valor as FornecedorOrderBy }));
  }

  // Recarrega a página atual sem navegar — os dados vêm do Server Component
  // (page.tsx), então basta re-executá-lo com os mesmos searchParams.
  function handleMudou() {
    router.refresh();
  }

  // Status (ativo/inativo) filtra só a página já carregada — não faz parte
  // do searchParams (TAREFA 1D não lista "status" entre os parâmetros da
  // page.tsx nem de getFornecedores), mesmo padrão do filtro de
  // status/prioridade em manutencao-view.tsx.
  const fornecedoresFiltrados = useMemo(() => {
    return fornecedores.filter((fornecedor) => {
      if (statusFiltro === "ativos") return fornecedor.ativo;
      if (statusFiltro === "inativos") return !fornecedor.ativo;
      return true;
    });
  }, [fornecedores, statusFiltro]);

  const paginacaoSearchParams: Record<string, string> = {};
  if (query) paginacaoSearchParams.q = query;
  if (categoria !== CATEGORIA_FILTRO_TODAS) paginacaoSearchParams.categoria = categoria;
  if (orderBy !== "nome") paginacaoSearchParams.orderBy = orderBy;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            placeholder="Buscar por nome, empresa ou telefone..."
            value={busca}
            onChange={(event) => handleBuscaChange(event.target.value)}
            className="max-w-sm"
          />
          <Select
            items={CATEGORIA_FILTRO_ITEMS}
            value={categoria}
            onValueChange={(value) => handleCategoriaChange(value as string)}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(CATEGORIA_FILTRO_ITEMS).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {CATEGORIA_FILTRO_ITEMS[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs">Ordenar por</Label>
            <Select
              items={ORDER_BY_ITEMS}
              value={orderBy}
              onValueChange={(value) => handleOrderByChange(value as string)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(ORDER_BY_ITEMS).map((chave) => (
                  <SelectItem key={chave} value={chave}>
                    {ORDER_BY_ITEMS[chave]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Select
            items={STATUS_FILTRO_ITEMS}
            value={statusFiltro}
            onValueChange={(value) => setStatusFiltro(value as string)}
          >
            <SelectTrigger className="w-36">
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
        <NovoFornecedorDialog onCriado={handleMudou} />
      </div>

      {fornecedoresFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {totalRegistros === 0
            ? "Nenhum fornecedor cadastrado ainda."
            : "Nenhum fornecedor encontrado com os filtros aplicados."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do contato</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedoresFiltrados.map((fornecedor) => (
              <TableRow key={fornecedor.id}>
                <TableCell className="font-medium">{fornecedor.nome_contato}</TableCell>
                <TableCell>{fornecedor.nome_empresa}</TableCell>
                <TableCell>
                  <Badge className={FORNECEDOR_CATEGORIA_BADGE_CLASS[fornecedor.categoria]}>
                    {FORNECEDOR_CATEGORIA_LABELS[fornecedor.categoria]}
                  </Badge>
                </TableCell>
                <TableCell>{fornecedor.telefone ? formatTelefone(fornecedor.telefone) : "—"}</TableCell>
                <TableCell>
                  <WhatsAppCelula whatsapp={fornecedor.whatsapp} />
                </TableCell>
                <TableCell>
                  <Badge variant={fornecedor.ativo ? "default" : "outline"}>
                    {fornecedor.ativo ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <EditarFornecedorDialog fornecedor={fornecedor} onSalvo={handleMudou} />
                  <ExcluirFornecedorButton fornecedor={fornecedor} onExcluido={handleMudou} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={limite}
        baseUrl="/admin/fornecedores"
        searchParams={paginacaoSearchParams}
      />
    </div>
  );
}
