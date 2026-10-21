"use client";

// "use client": busca os dados via Server Action no mount (useEffect) — props mínimas
// (só alunoId), sem repassar dados já buscados no Server Component pai, pra manter
// PortalResponsavelAuth simples e o dashboard autocontido.

import { useEffect, useState } from "react";
import { getDadosPortalResponsavel, type DadosPortal } from "@/app/responsavel/[alunoId]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_ALUNO_LABELS: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
  trancado: "Trancado",
  formado: "Formado",
};

const STATUS_MATRICULA_LABELS: Record<string, string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
  transferida: "Transferida",
};

const STATUS_PARCELA_LABELS: Record<string, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  estornado: "Estornado",
};

const STATUS_PARCELA_BADGE: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400",
  pago: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400",
  atrasado: "bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  cancelado: "bg-muted text-muted-foreground",
  estornado: "bg-muted text-muted-foreground",
};

function formatValor(valor: number): string {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// dd/mm/aaaa a partir de "yyyy-mm-dd" — evita o desvio de fuso de usar `new Date(...)` direto
// numa string de data pura (interpretada como UTC), mesmo critério já usado em todo o projeto.
function formatDataBR(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function PortalResponsavelDashboard({ alunoId }: { alunoId: string }) {
  const [dados, setDados] = useState<DadosPortal | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    getDadosPortalResponsavel(alunoId).then((resultado) => {
      if (cancelado) return;
      setDados(resultado);
      setCarregando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [alunoId]);

  if (carregando) {
    return <p className="text-muted-foreground text-sm">Carregando...</p>;
  }

  if (!dados) {
    return <p className="text-muted-foreground text-sm">Não foi possível carregar os dados deste aluno.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Portal do Responsável — {dados.aluno.full_name ?? "Aluno"}</h1>
        {dados.aluno.status_aluno && (
          <Badge variant="outline">{STATUS_ALUNO_LABELS[dados.aluno.status_aluno] ?? dados.aluno.status_aluno}</Badge>
        )}
      </div>

      {dados.matriculas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma matrícula ativa encontrada.
          </CardContent>
        </Card>
      ) : (
        dados.matriculas.map((matricula) => {
          const emAberto = matricula.parcelas.filter((p) => p.status === "pendente" || p.status === "atrasado");
          const totalEmAberto = emAberto.reduce((soma, p) => soma + Number(p.valor), 0);

          return (
            <Card key={matricula.id}>
              <CardContent className="flex flex-col gap-4 py-5">
                <div className="flex flex-col gap-2">
                  <p className="font-medium">
                    {matricula.nomeCurso} — {matricula.nomeTurma}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{STATUS_MATRICULA_LABELS[matricula.status] ?? matricula.status}</Badge>

                    {matricula.statusContrato === "aceito" ? (
                      <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
                        ✅ Contrato assinado
                      </Badge>
                    ) : (
                      <Button
                        render={<a href={`/contrato/${matricula.id}/assinar`} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        ⚠️ Contrato pendente — assinar
                      </Button>
                    )}

                    {matricula.termoImagemAssinado ? (
                      <Badge className="bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400">
                        ✅ Termo de imagem assinado
                      </Badge>
                    ) : (
                      <Button
                        render={<a href={`/termo-imagem/${matricula.id}/assinar`} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                      >
                        ⚠️ Termo de imagem pendente — assinar
                      </Button>
                    )}
                  </div>
                </div>

                {matricula.parcelas.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matricula.parcelas.map((parcela) => {
                          const linkPagamento = parcela.asaas_invoice_url ?? parcela.asaas_bank_slip_url;
                          return (
                            <TableRow key={parcela.id}>
                              <TableCell>{parcela.numero_parcela}</TableCell>
                              <TableCell>{formatDataBR(parcela.data_vencimento)}</TableCell>
                              <TableCell>{formatValor(parcela.valor)}</TableCell>
                              <TableCell>
                                <Badge className={STATUS_PARCELA_BADGE[parcela.status] ?? ""}>
                                  {STATUS_PARCELA_LABELS[parcela.status] ?? parcela.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {(parcela.status === "pendente" || parcela.status === "atrasado") && linkPagamento && (
                                  <Button
                                    render={<a href={linkPagamento} target="_blank" rel="noopener noreferrer" />}
                                    nativeButton={false}
                                    variant="ghost"
                                    size="sm"
                                  >
                                    💳 Pagar
                                  </Button>
                                )}
                                {parcela.status === "pago" && (
                                  <Button
                                    render={
                                      <a
                                        href={`/api/comprovantes/parcela/${parcela.id}/pdf`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      />
                                    }
                                    nativeButton={false}
                                    variant="ghost"
                                    size="sm"
                                  >
                                    🧾 Recibo
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    <p className="text-muted-foreground text-sm">
                      {emAberto.length} parcela(s) em aberto | Total: {formatValor(totalEmAberto)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <p className="text-muted-foreground mt-2 text-center text-sm">
        Em caso de dúvidas, entre em contato com a escola.
      </p>
    </div>
  );
}
