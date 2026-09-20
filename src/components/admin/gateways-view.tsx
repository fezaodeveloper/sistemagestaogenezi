"use client";

// "use client": qual gateway está com o dialog de configuração aberto.

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { GatewayResumo } from "@/lib/gateways/manager";
import { METODO_PAGAMENTO_LABELS } from "@/lib/gateways/types";
import { GatewayConfigDialog } from "@/components/admin/gateway-config-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function GatewaysView({
  gateways,
  avisoLeitura,
  criptografiaConfigurada,
}: {
  gateways: GatewayResumo[];
  // Preenchido quando gateways_config não pôde ser lida (ex.: migration pendente).
  avisoLeitura: string | null;
  criptografiaConfigurada: boolean;
}) {
  const [selecionado, setSelecionado] = useState<GatewayResumo | null>(null);
  const ativo = gateways.find((gateway) => gateway.ativo) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {avisoLeitura && (
        <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Não foi possível ler a tabela de gateways (a migration <code>gateways_config</code> já foi aplicada?). O Asaas segue
            funcionando normalmente com a chave do ambiente do servidor. Detalhe: {avisoLeitura}
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {gateways.map((gateway) => (
          <button
            key={gateway.tipo}
            type="button"
            onClick={() => setSelecionado(gateway)}
            className="group text-left"
            aria-label={`Configurar ${gateway.nome}`}
          >
            <Card className={`group-hover:border-primary/50 h-full transition-colors ${gateway.ativo ? "border-primary/60" : ""}`}>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                      style={{ backgroundColor: gateway.cor }}
                    >
                      {gateway.nome.slice(0, 2).toUpperCase()}
                    </span>
                    <p className="font-semibold">{gateway.nome}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {gateway.ativo && <Badge className="bg-primary text-primary-foreground">ATIVO</Badge>}
                    <Badge
                      className={
                        gateway.conectado
                          ? "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {gateway.conectado ? "Conectado" : "Não configurado"}
                    </Badge>
                  </div>
                </div>

                <p className="text-muted-foreground text-sm">{gateway.descricao}</p>

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  {gateway.metodos.map((metodo) => (
                    <Badge key={metodo} variant="outline">
                      {METODO_PAGAMENTO_LABELS[metodo]}
                    </Badge>
                  ))}
                  {gateway.sandbox && <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400">Sandbox</Badge>}
                  {!gateway.implementado && <Badge variant="secondary">Em breve</Badge>}
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {selecionado && (
        <GatewayConfigDialog
          // key: reabrir outro gateway (ou o mesmo depois de salvar) recomeça o formulário do zero.
          key={`${selecionado.tipo}-${selecionado.conectado}-${selecionado.ativo}-${selecionado.sandbox}`}
          gateway={selecionado}
          gatewayAtivoNome={ativo && ativo.tipo !== selecionado.tipo ? ativo.nome : null}
          criptografiaConfigurada={criptografiaConfigurada}
          onClose={() => setSelecionado(null)}
        />
      )}
    </div>
  );
}
