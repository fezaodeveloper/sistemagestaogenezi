"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Search, XCircle } from "lucide-react";
import { encerrarVagaAdmin } from "@/app/admin/conecta/vagas/actions";
import {
  VAGA_MODALIDADE_LABELS,
  VAGA_STATUS_BADGE_CLASS,
  VAGA_STATUS_LABELS,
  VAGA_STATUSES,
  VAGA_TIPO_LABELS,
  type VagaAdminConecta,
} from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_FILTROS = ["todas", ...VAGA_STATUSES] as const;
type StatusFiltro = (typeof STATUS_FILTROS)[number];
const STATUS_FILTRO_LABELS: Record<StatusFiltro, string> = { todas: "Todas", ...VAGA_STATUS_LABELS };

const TODOS = "todos";
const TIPO_ITEMS: Record<string, string> = { [TODOS]: "Todos os tipos", ...VAGA_TIPO_LABELS };
const MODALIDADE_ITEMS: Record<string, string> = { [TODOS]: "Todas as modalidades", ...VAGA_MODALIDADE_LABELS };

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function formatSalario(vaga: VagaAdminConecta): string {
  if (vaga.salario_oculto) return "A combinar";
  if (vaga.salario_min && vaga.salario_max) {
    return `R$ ${vaga.salario_min.toLocaleString("pt-BR")} – R$ ${vaga.salario_max.toLocaleString("pt-BR")}`;
  }
  if (vaga.salario_min) return `A partir de R$ ${vaga.salario_min.toLocaleString("pt-BR")}`;
  return "Não informado";
}

function VagaDetalhesDialog({ vaga }: { vaga: VagaAdminConecta }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            <Eye className="size-4" />
            Ver detalhes
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{vaga.titulo}</DialogTitle>
          <DialogDescription>{vaga.empresaNome}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{VAGA_TIPO_LABELS[vaga.tipo]}</Badge>
            <Badge variant="outline">{VAGA_MODALIDADE_LABELS[vaga.modalidade]}</Badge>
            <Badge className={VAGA_STATUS_BADGE_CLASS[vaga.status]}>{VAGA_STATUS_LABELS[vaga.status]}</Badge>
          </div>
          <p className="text-muted-foreground">
            {vaga.cidade}/{vaga.estado} · {formatSalario(vaga)}
            {vaga.carga_horaria ? ` · ${vaga.carga_horaria}` : ""}
          </p>
          <div>
            <p className="mb-1 font-medium">Descrição</p>
            <p className="text-muted-foreground whitespace-pre-wrap">{vaga.descricao}</p>
          </div>
          {vaga.requisitos && (
            <div>
              <p className="mb-1 font-medium">Requisitos</p>
              <p className="text-muted-foreground whitespace-pre-wrap">{vaga.requisitos}</p>
            </div>
          )}
          <p className="text-muted-foreground text-xs">Publicada em {formatDateBR(vaga.created_at)}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EncerrarVagaButton({ vaga }: { vaga: VagaAdminConecta }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const resultado = await encerrarVagaAdmin(vaga.id);
      if (resultado.error) setError(resultado.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button type="button" variant="outline" size="sm" className="text-destructive" disabled={isPending} onClick={handleClick}>
        <XCircle className="size-4" />
        {isPending ? "Encerrando..." : "Encerrar vaga"}
      </Button>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}

export function ConectaVagasAdminView({
  vagas,
  paginaAtual,
  totalPaginas,
  totalRegistros,
  limite,
  filtrosAtuais,
}: {
  vagas: VagaAdminConecta[];
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  limite: number;
  filtrosAtuais: { query: string; status: string; tipo: string; modalidade: string };
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(filtrosAtuais.query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sempre volta pra página 1 ao trocar qualquer filtro — evita cair numa
  // página vazia (ex.: estava na página 3 de "todas" e filtrou por um
  // status com só 1 página de resultado).
  function navegar(overrides: Partial<{ query: string; status: string; tipo: string; modalidade: string }>) {
    const proximo = { ...filtrosAtuais, ...overrides };
    const params = new URLSearchParams();
    if (proximo.query.trim()) params.set("query", proximo.query.trim());
    if (proximo.status) params.set("status", proximo.status);
    if (proximo.tipo) params.set("tipo", proximo.tipo);
    if (proximo.modalidade) params.set("modalidade", proximo.modalidade);
    const query = params.toString();
    router.push(query ? `/admin/conecta/vagas?${query}` : "/admin/conecta/vagas");
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navegar({ query: valor }), 500);
  }

  const searchParamsAtuais: Record<string, string> = {};
  if (filtrosAtuais.query) searchParamsAtuais.query = filtrosAtuais.query;
  if (filtrosAtuais.status) searchParamsAtuais.status = filtrosAtuais.status;
  if (filtrosAtuais.tipo) searchParamsAtuais.tipo = filtrosAtuais.tipo;
  if (filtrosAtuais.modalidade) searchParamsAtuais.modalidade = filtrosAtuais.modalidade;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => handleBuscaChange(e.target.value)}
            placeholder="Buscar por título ou empresa..."
            className="pl-9"
          />
        </div>
        <Select
          items={TIPO_ITEMS}
          value={filtrosAtuais.tipo || TODOS}
          onValueChange={(value) => navegar({ tipo: value && value !== TODOS ? value : "" })}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_ITEMS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={MODALIDADE_ITEMS}
          value={filtrosAtuais.modalidade || TODOS}
          onValueChange={(value) => navegar({ modalidade: value && value !== TODOS ? value : "" })}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(MODALIDADE_ITEMS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTROS.map((opcao) => (
          <Button
            key={opcao}
            type="button"
            variant={(filtrosAtuais.status || "todas") === opcao ? "default" : "outline"}
            size="sm"
            onClick={() => navegar({ status: opcao === "todas" ? "" : opcao })}
          >
            {STATUS_FILTRO_LABELS[opcao]}
          </Button>
        ))}
      </div>

      {vagas.length === 0 ? (
        <Card>
          <div className="text-muted-foreground py-10 text-center text-sm">Nenhuma vaga encontrada.</div>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Publicada em</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vagas.map((vaga) => (
                <TableRow key={vaga.id}>
                  <TableCell className="max-w-56 truncate font-medium">{vaga.titulo}</TableCell>
                  <TableCell className="max-w-40 truncate">{vaga.empresaNome}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{VAGA_TIPO_LABELS[vaga.tipo]}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{VAGA_MODALIDADE_LABELS[vaga.modalidade]}</Badge>
                  </TableCell>
                  <TableCell>
                    {vaga.cidade}/{vaga.estado}
                  </TableCell>
                  <TableCell>
                    <Badge className={VAGA_STATUS_BADGE_CLASS[vaga.status]}>{VAGA_STATUS_LABELS[vaga.status]}</Badge>
                  </TableCell>
                  <TableCell>{formatDateBR(vaga.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <VagaDetalhesDialog vaga={vaga} />
                      {vaga.status !== "encerrada" && <EncerrarVagaButton vaga={vaga} />}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Paginacao
        paginaAtual={paginaAtual}
        totalPaginas={totalPaginas}
        totalRegistros={totalRegistros}
        limite={limite}
        baseUrl="/admin/conecta/vagas"
        searchParams={searchParamsAtuais}
      />
    </div>
  );
}
