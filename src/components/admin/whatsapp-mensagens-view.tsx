"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Paginacao } from "@/components/ui/paginacao";
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

export type MensagemRecebidaView = {
  id: string;
  telefone: string;
  nome_contato: string | null;
  mensagem: string;
  tipo: string;
  processado: boolean;
  created_at: string;
};

const MENSAGEM_TRUNCAR = 60;

const STATUS_FILTRO_TODOS = "";
const STATUS_FILTRO_ITEMS: Record<string, string> = {
  [STATUS_FILTRO_TODOS]: "Todos os status",
  pendentes: "Pendentes",
  processadas: "Processadas",
};

const TIPO_LABELS: Record<string, string> = {
  texto: "Texto",
  audio: "Áudio",
  imagem: "Imagem",
  documento: "Documento",
  outro: "Outro",
};

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function truncar(texto: string): string {
  return texto.length > MENSAGEM_TRUNCAR ? `${texto.slice(0, MENSAGEM_TRUNCAR)}…` : texto;
}

export function WhatsappMensagensView({
  mensagens,
  totalRegistros,
  paginaAtual,
  totalPaginas,
  limite,
  statusFiltro,
}: {
  mensagens: MensagemRecebidaView[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  limite: number;
  statusFiltro: string;
}) {
  const router = useRouter();

  function handleStatusChange(valor: string) {
    const params = new URLSearchParams();
    if (valor) params.set("status", valor);
    const query = params.toString();
    router.push(`/admin/whatsapp-mensagens${query ? `?${query}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {totalRegistros} mensage{totalRegistros === 1 ? "m" : "ns"} recebida{totalRegistros === 1 ? "" : "s"}
        </p>
        <Select
          items={STATUS_FILTRO_ITEMS}
          value={statusFiltro}
          onValueChange={(value) => handleStatusChange((value as string) ?? "")}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(STATUS_FILTRO_ITEMS).map((status) => (
              <SelectItem key={status || "todos"} value={status}>
                {STATUS_FILTRO_ITEMS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mensagens.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          Nenhuma mensagem encontrada com os filtros aplicados.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data/hora</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mensagens.map((msg) => (
              <TableRow key={msg.id}>
                <TableCell>{formatarDataHora(msg.created_at)}</TableCell>
                <TableCell>{msg.telefone}</TableCell>
                <TableCell>{msg.nome_contato ?? "—"}</TableCell>
                <TableCell title={msg.mensagem}>{truncar(msg.mensagem)}</TableCell>
                <TableCell>{TIPO_LABELS[msg.tipo] ?? msg.tipo}</TableCell>
                <TableCell>
                  {msg.processado ? (
                    <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
                      Processado
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                      Pendente
                    </Badge>
                  )}
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
        baseUrl="/admin/whatsapp-mensagens"
        searchParams={statusFiltro ? { status: statusFiltro } : {}}
      />
    </div>
  );
}
