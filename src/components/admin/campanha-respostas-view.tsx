"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Printer } from "lucide-react";
import {
  RESPOSTA_CHAVE_DECLARACAO,
  RESPOSTA_CHAVE_LGPD,
  formatarRespostaCampanha,
  type CampanhaResposta,
  type Etapa,
} from "@/lib/campanha-paginas/schema";
import { LIMITE_PADRAO } from "@/lib/paginacao";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatDateHoraBR(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

function RespostaCompletaDialog({
  resposta,
  perguntaPorId,
  mostrarLgpd,
  mostrarDeclaracao,
  habilitarPontuacao,
  pontuacaoMinimaBolsa,
}: {
  resposta: CampanhaResposta;
  perguntaPorId: Map<string, string>;
  mostrarLgpd: boolean;
  mostrarDeclaracao: boolean;
  habilitarPontuacao: boolean;
  pontuacaoMinimaBolsa: number;
}) {
  const aprovado = (resposta.pontuacao_percentual ?? 0) >= pontuacaoMinimaBolsa;
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Ver respostas completas">
            <Eye className="size-3.5" />
          </Button>
        }
      />
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{resposta.nome}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          <p>📱 {resposta.whatsapp}</p>
          {resposta.idade && <p>🎂 {resposta.idade} anos</p>}
          {resposta.email && <p>✉️ {resposta.email}</p>}
          {(resposta.cidade || resposta.estado) && (
            <p>🏙️ {[resposta.cidade, resposta.estado].filter(Boolean).join(" - ")}</p>
          )}
          <p className="text-muted-foreground text-xs">{formatDateHoraBR(resposta.created_at)}</p>

          {habilitarPontuacao && (
            <p className="font-medium">
              🎯 {resposta.pontuacao_total ?? 0} pontos ({resposta.pontuacao_percentual ?? 0}%) —{" "}
              {aprovado ? "Aprovado" : "Não aprovado"}
            </p>
          )}

          {perguntaPorId.size > 0 && (
            <div className="mt-2 flex flex-col gap-2 border-t pt-2">
              {Array.from(perguntaPorId.entries()).map(([id, pergunta]) => (
                <div key={id}>
                  <p className="text-muted-foreground text-xs">{pergunta}</p>
                  <p>{formatarRespostaCampanha(resposta.respostas?.[id])}</p>
                </div>
              ))}
            </div>
          )}

          {(mostrarLgpd || mostrarDeclaracao) && (
            <div className="mt-2 flex flex-col gap-1 border-t pt-2 text-xs">
              {mostrarLgpd && <p>LGPD: {resposta.respostas?.[RESPOSTA_CHAVE_LGPD] ? "Aceito" : "Não aceito"}</p>}
              {mostrarDeclaracao && (
                <p>Declaração: {resposta.respostas?.[RESPOSTA_CHAVE_DECLARACAO] ? "Aceita" : "Não aceita"}</p>
              )}
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 w-fit"
            nativeButton={false}
            render={<a href={`/api/campanha-respostas/${resposta.id}/pdf`} target="_blank" rel="noreferrer" />}
          >
            <Printer className="size-3.5" />
            Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CampanhaRespostasView({
  paginaId,
  etapas,
  mostrarLgpd,
  mostrarDeclaracao,
  habilitarPontuacao,
  pontuacaoMinimaBolsa,
  respostas,
  totalRegistros,
  paginaAtual,
  totalPaginas,
  dataFiltro,
  statusPontuacaoFiltro,
}: {
  paginaId: string;
  etapas: Etapa[];
  mostrarLgpd: boolean;
  mostrarDeclaracao: boolean;
  habilitarPontuacao: boolean;
  pontuacaoMinimaBolsa: number;
  respostas: CampanhaResposta[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  dataFiltro: string;
  statusPontuacaoFiltro: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(dataFiltro);
  const [statusPontuacao, setStatusPontuacao] = useState(statusPontuacaoFiltro);

  const perguntaPorId = new Map<string, string>();
  for (const etapa of etapas) {
    for (const questao of etapa.questoes) {
      perguntaPorId.set(questao.id, questao.pergunta);
    }
  }

  function navegar(novaData: string, novoStatusPontuacao: string) {
    const params = new URLSearchParams();
    if (novaData) params.set("data", novaData);
    if (novoStatusPontuacao) params.set("status_pontuacao", novoStatusPontuacao);
    const queryString = params.toString();
    router.push(
      queryString
        ? `/admin/comercial/paginas-campanha/${paginaId}/respostas?${queryString}`
        : `/admin/comercial/paginas-campanha/${paginaId}/respostas`,
    );
  }

  function handleDataChange(valor: string) {
    setData(valor);
    navegar(valor, statusPontuacao);
  }

  function handleStatusPontuacaoChange(valor: string) {
    setStatusPontuacao(valor);
    navegar(data, valor);
  }

  const paginacaoSearchParams: Record<string, string> = {};
  if (dataFiltro) paginacaoSearchParams.data = dataFiltro;
  if (statusPontuacaoFiltro) paginacaoSearchParams.status_pontuacao = statusPontuacaoFiltro;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Data</span>
            <Input type="date" value={data} onChange={(event) => handleDataChange(event.target.value)} className="w-40" />
          </div>
          {habilitarPontuacao && (
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">Pontuação</span>
              <Select
                items={{ "": "Todos", aprovado: "Aprovados", reprovado: "Não aprovados" }}
                value={statusPontuacao}
                onValueChange={(v) => handleStatusPontuacaoChange(v ?? "")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="aprovado">Aprovados</SelectItem>
                  <SelectItem value="reprovado">Não aprovados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-muted-foreground pb-2 text-sm">{totalRegistros} participante{totalRegistros === 1 ? "" : "s"}</p>
        </div>
        <Button type="button" variant="outline" nativeButton={false} render={<a href={`/admin/comercial/paginas-campanha/${paginaId}/respostas/export`} />}>
          <Download />
          Exportar Excel
        </Button>
      </div>

      {respostas.length === 0 ? (
        <Card>
          <p className="text-muted-foreground py-10 text-center text-sm">
            {dataFiltro ? "Nenhuma resposta encontrada nessa data." : "Nenhuma resposta recebida ainda."}
          </p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>Data</TableHead>
                {habilitarPontuacao && <TableHead>Pontuação</TableHead>}
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {respostas.map((resposta) => (
                <TableRow key={resposta.id}>
                  <TableCell className="font-medium">{resposta.nome}</TableCell>
                  <TableCell>
                    <a
                      href={`https://wa.me/55${resposta.whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {resposta.whatsapp}
                    </a>
                  </TableCell>
                  <TableCell>{[resposta.cidade, resposta.estado].filter(Boolean).join(" - ") || "—"}</TableCell>
                  <TableCell>{formatDateHoraBR(resposta.created_at)}</TableCell>
                  {habilitarPontuacao && (
                    <TableCell>
                      {resposta.pontuacao_total ?? 0} ({resposta.pontuacao_percentual ?? 0}%){" "}
                      {(resposta.pontuacao_percentual ?? 0) >= pontuacaoMinimaBolsa ? "✅" : ""}
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Imprimir resultado"
                        nativeButton={false}
                        render={<a href={`/api/campanha-respostas/${resposta.id}/pdf`} target="_blank" rel="noreferrer" />}
                      >
                        <Printer className="size-3.5" />
                      </Button>
                      <RespostaCompletaDialog
                        resposta={resposta}
                        perguntaPorId={perguntaPorId}
                        mostrarLgpd={mostrarLgpd}
                        mostrarDeclaracao={mostrarDeclaracao}
                        habilitarPontuacao={habilitarPontuacao}
                        pontuacaoMinimaBolsa={pontuacaoMinimaBolsa}
                      />
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
        limite={LIMITE_PADRAO}
        baseUrl={`/admin/comercial/paginas-campanha/${paginaId}/respostas`}
        searchParams={paginacaoSearchParams}
      />
    </div>
  );
}
