"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import {
  atribuirCursoGratuito,
  atualizarStatusCursoGratuito,
  buscarAlunosParaCursoGratuito,
  getAlunosInscritosCursoGratuito,
  removerVinculoCursoGratuito,
  type AlunoBuscaResultado,
  type AlunoInscritoCursoGratuito,
} from "@/app/admin/cursos-gratuitos/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { DeleteCursoGratuitoButton } from "@/components/admin/delete-curso-gratuito-button";
import { CURSO_STATUSES } from "@/lib/cursos/schema";

export type CursoGratuitoListItem = {
  id: string;
  nome: string;
  descricao: string | null;
  url_plataforma_externa: string | null;
  carga_horaria: string | null;
  foto_url: string | null;
  status: (typeof CURSO_STATUSES)[number];
  inscritos: number;
};

const STATUS_FILTRO_TODOS = "todos";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos",
  ativo: "Ativos",
  inativo: "Inativos",
};

function StatusToggle({ id, statusInicial }: { id: string; statusInicial: (typeof CURSO_STATUSES)[number] }) {
  const [ativo, setAtivo] = useState(statusInicial === "ativo");
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    setAtivo(checked);
    startTransition(async () => {
      const resultado = await atualizarStatusCursoGratuito(id, checked);
      // Falhou no servidor: volta o switch pro estado anterior — sem toast nesta tela ainda,
      // mas o switch nunca fica mostrando um estado que não foi de fato salvo.
      if (resultado.error) setAtivo(!checked);
    });
  }

  return <Switch checked={ativo} disabled={isPending} onCheckedChange={(checked) => handleChange(checked === true)} />;
}

// Autocomplete de aluno por nome/CPF — debounce de 300ms pra não disparar uma busca por tecla
// digitada. Resultado já exclui (no clique) alunos que o próprio insert recusaria por duplicidade;
// a mensagem de "já tem acesso" só aparece mesmo assim se o admin tentar de novo rápido.
function AdicionarAlunoForm({ cursoId, onAdicionado }: { cursoId: string; onAdicionado: () => void }) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<AlunoBuscaResultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const termoAtual = termo.trim();
    const timeout = setTimeout(() => {
      if (termoAtual.length < 2) {
        setResultados([]);
        return;
      }
      setBuscando(true);
      buscarAlunosParaCursoGratuito(termoAtual)
        .then(setResultados)
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [termo]);

  function handleAdicionar(alunoId: string) {
    setErro(null);
    startTransition(async () => {
      const resultado = await atribuirCursoGratuito(cursoId, alunoId);
      if (resultado.error) {
        setErro(resultado.error);
        return;
      }
      setTermo("");
      setResultados([]);
      onAdicionado();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <Input
        placeholder="Buscar aluno por nome ou CPF..."
        value={termo}
        onChange={(event) => setTermo(event.target.value)}
        disabled={isPending}
      />
      {buscando && <p className="text-muted-foreground text-xs">Buscando...</p>}
      {erro && <p className="text-destructive text-xs">{erro}</p>}
      {resultados.length > 0 && (
        <div className="flex flex-col gap-1">
          {resultados.map((aluno) => (
            <button
              key={aluno.id}
              type="button"
              disabled={isPending}
              onClick={() => handleAdicionar(aluno.id)}
              className="hover:bg-accent flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm disabled:pointer-events-none disabled:opacity-50"
            >
              <span>{aluno.full_name ?? "—"}</span>
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Plus className="size-3.5" />
                Adicionar
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RemoverVinculoButton({ vinculoId, onRemovido }: { vinculoId: string; onRemovido: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleRemover() {
    startTransition(async () => {
      const resultado = await removerVinculoCursoGratuito(vinculoId);
      if (!resultado.error) onRemovido();
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={handleRemover}>
      <Trash2 className="size-3.5" />
      Remover
    </Button>
  );
}

function DetalhesInscritosDialog({ cursoId, nome }: { cursoId: string; nome: string }) {
  const [open, setOpen] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [alunos, setAlunos] = useState<AlunoInscritoCursoGratuito[] | null>(null);

  function recarregar() {
    setCarregando(true);
    getAlunosInscritosCursoGratuito(cursoId)
      .then(setAlunos)
      .finally(() => setCarregando(false));
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && alunos === null) recarregar();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="sm">
            <Users />
            Ver detalhes
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alunos com acesso — {nome}</DialogTitle>
        </DialogHeader>
        <AdicionarAlunoForm cursoId={cursoId} onAdicionado={recarregar} />
        {carregando ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Carregando...</p>
        ) : !alunos || alunos.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">Nenhum aluno com acesso a este curso ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alunos.map((aluno) => (
                <TableRow key={aluno.alunoId}>
                  <TableCell>{aluno.full_name ?? "—"}</TableCell>
                  <TableCell>
                    {aluno.origem === "matricula" ? (
                      <span className="text-muted-foreground text-xs">Bônus da matrícula</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Atribuição manual</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {aluno.vinculoId && <RemoverVinculoButton vinculoId={aluno.vinculoId} onRemovido={recarregar} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function CursosGratuitosTable({ cursos }: { cursos: CursoGratuitoListItem[] }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<string>(STATUS_FILTRO_TODOS);

  const cursosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return cursos.filter((curso) => {
      if (termo && !curso.nome.toLowerCase().includes(termo)) return false;
      if (statusFiltro !== STATUS_FILTRO_TODOS && curso.status !== statusFiltro) return false;
      return true;
    });
  }, [cursos, busca, statusFiltro]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Input
          placeholder="Buscar por nome..."
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          className="max-w-sm"
        />
        <Select
          items={STATUS_FILTRO_ITEMS}
          value={statusFiltro}
          onValueChange={(value) => setStatusFiltro(value as string)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(STATUS_FILTRO_ITEMS).map((status) => (
              <SelectItem key={status} value={status}>
                {STATUS_FILTRO_ITEMS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cursosFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhum curso encontrado com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Foto</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>URL externa</TableHead>
              <TableHead>Carga Horária</TableHead>
              <TableHead>Alunos Inscritos</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cursosFiltrados.map((curso) => (
              <TableRow key={curso.id}>
                <TableCell>
                  {curso.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- miniatura 32x32 de uma foto em bucket público
                    <img src={curso.foto_url} alt={curso.nome} className="size-8 rounded object-cover" />
                  ) : (
                    <div className="bg-muted size-8 rounded" />
                  )}
                </TableCell>
                <TableCell className="font-medium">{curso.nome}</TableCell>
                <TableCell className="max-w-xs truncate text-sm">{curso.descricao || "—"}</TableCell>
                <TableCell className="max-w-xs truncate text-sm">
                  {curso.url_plataforma_externa ? (
                    <a
                      href={curso.url_plataforma_externa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline"
                    >
                      {curso.url_plataforma_externa}
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm">{curso.carga_horaria || "—"}</TableCell>
                <TableCell className="text-sm">{curso.inscritos}</TableCell>
                <TableCell>
                  <StatusToggle id={curso.id} statusInicial={curso.status} />
                </TableCell>
                <TableCell className="flex justify-end gap-1">
                  <DetalhesInscritosDialog cursoId={curso.id} nome={curso.nome} />
                  <Button
                    render={<Link href={`/admin/cursos-gratuitos/${curso.id}/editar`} />}
                    nativeButton={false}
                    variant="ghost"
                    size="sm"
                  >
                    Editar
                  </Button>
                  <DeleteCursoGratuitoButton id={curso.id} nome={curso.nome} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
