import type { DadosPortalMatricula } from "@/app/responsavel/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_PARCELA_BADGE, STATUS_PARCELA_LABELS, formatDataBR, formatValor } from "@/lib/responsavel/formatacao";

export function SecaoFinanceiro({ parcelas }: { parcelas: DadosPortalMatricula["parcelas"] }) {
  if (parcelas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financeiro</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground py-6 text-center text-sm">Sem parcelas em aberto.</CardContent>
      </Card>
    );
  }

  const pagas = parcelas.filter((p) => p.status === "pago");
  const emAberto = parcelas.filter((p) => p.status === "pendente" || p.status === "atrasado");
  const totalPago = pagas.reduce((soma, p) => soma + Number(p.valor), 0);
  const totalPendente = emAberto.reduce((soma, p) => soma + Number(p.valor), 0);
  const proximoVencimento = emAberto
    .slice()
    .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-muted-foreground text-xs">Total pago</span>
            <span className="text-xl font-semibold text-green-500">{formatValor(totalPago)}</span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-muted-foreground text-xs">Total pendente</span>
            <span className={`text-xl font-semibold ${totalPendente > 0 ? "text-amber-500" : ""}`}>
              {formatValor(totalPendente)}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-muted-foreground text-xs">Próximo vencimento</span>
            <span className="text-xl font-semibold">
              {proximoVencimento ? formatDataBR(proximoVencimento.data_vencimento) : "—"}
            </span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
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
              {parcelas.map((parcela) => {
                const emAbertoParcela = parcela.status === "pendente" || parcela.status === "atrasado";
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
                    <TableCell className="flex flex-wrap justify-end gap-1">
                      {emAbertoParcela && parcela.asaas_invoice_url && (
                        <Button
                          render={<a href={parcela.asaas_invoice_url} target="_blank" rel="noopener noreferrer" />}
                          nativeButton={false}
                          variant="outline"
                          size="sm"
                        >
                          Pagar
                        </Button>
                      )}
                      {emAbertoParcela && parcela.asaas_bank_slip_url && (
                        <Button
                          render={<a href={parcela.asaas_bank_slip_url} target="_blank" rel="noopener noreferrer" />}
                          nativeButton={false}
                          variant="ghost"
                          size="sm"
                        >
                          Boleto
                        </Button>
                      )}
                      {parcela.status === "pago" && (
                        <Button
                          render={
                            <a href={`/api/comprovantes/parcela/${parcela.id}/pdf`} target="_blank" rel="noopener noreferrer" />
                          }
                          nativeButton={false}
                          variant="ghost"
                          size="sm"
                        >
                          Recibo
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
