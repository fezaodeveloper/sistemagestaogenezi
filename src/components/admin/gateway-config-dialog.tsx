"use client";

// "use client": formulário com estado, teste de conexão e envio por Server Action.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Info, PlugZap, XCircle } from "lucide-react";
import { salvarGateway, testarConexaoGateway, type DadosGatewayForm } from "@/app/admin/configuracoes/gateways/actions";
import type { GatewayResumo } from "@/lib/gateways/manager";
import { METODO_PAGAMENTO_LABELS, TAXA_CAMPOS, type ResultadoTesteConexao } from "@/lib/gateways/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

function taxaParaTexto(valor: number | undefined): string {
  return valor === undefined ? "" : String(valor).replace(".", ",");
}

export function GatewayConfigDialog({
  gateway,
  gatewayAtivoNome,
  criptografiaConfigurada,
  onClose,
}: {
  gateway: GatewayResumo;
  // Nome do gateway que está ativo agora (se for outro), pra avisar que será substituído.
  gatewayAtivoNome: string | null;
  criptografiaConfigurada: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  // Valores digitados. Segredos já salvos NÃO voltam do servidor: ficam em
  // branco e, se continuarem em branco ao salvar, o valor salvo é mantido.
  const [credenciais, setCredenciais] = useState<Record<string, string>>(() =>
    Object.fromEntries(gateway.campos.filter((campo) => !campo.secreto && campo.valor).map((campo) => [campo.chave, campo.valor as string])),
  );
  const [sandbox, setSandbox] = useState(gateway.sandbox);
  const [ativo, setAtivo] = useState(gateway.ativo);
  const [taxas, setTaxas] = useState<Record<string, string>>(() =>
    Object.fromEntries(TAXA_CAMPOS.map((campo) => [campo.chave, taxaParaTexto(gateway.taxas[campo.chave])])),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [teste, setTeste] = useState<ResultadoTesteConexao | null>(null);
  const [salvando, startSalvar] = useTransition();
  const [testando, startTestar] = useTransition();

  function dados(): DadosGatewayForm {
    return { ativo, sandbox, credenciais, taxas };
  }

  function handleTestar() {
    setErro(null);
    setTeste(null);
    startTestar(async () => {
      setTeste(await testarConexaoGateway(gateway.tipo, dados()));
    });
  }

  function handleSalvar() {
    setErro(null);
    startSalvar(async () => {
      const resultado = await salvarGateway(gateway.tipo, dados());
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  const substituiAtivo = ativo && !gateway.ativo && gatewayAtivoNome !== null;

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar {gateway.nome}</DialogTitle>
          <DialogDescription>
            {gateway.descricao} Métodos: {gateway.metodos.map((metodo) => METODO_PAGAMENTO_LABELS[metodo]).join(", ")}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {!gateway.implementado && (
            <p className="flex gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 size-4 shrink-0" />
              A integração com {gateway.nome} está prevista para as próximas fases. Já dá para guardar as credenciais, mas o
              gateway ainda não pode ser ativado nem testado.
            </p>
          )}
          {!criptografiaConfigurada && (
            <p role="alert" className="text-destructive bg-destructive/10 rounded-md p-3 text-sm">
              A variável de ambiente GATEWAYS_ENCRYPTION_KEY não está definida: não é possível salvar credenciais até
              configurá-la.
            </p>
          )}
          {gateway.origemCredenciais === "ambiente" && (
            <p className="text-muted-foreground bg-muted/50 flex gap-2 rounded-md p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0" />
              Hoje o {gateway.nome} usa a chave da variável de ambiente do servidor. Preencha o campo abaixo para passar a usar
              uma chave guardada aqui.
            </p>
          )}

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">Credenciais</h3>
            {gateway.campos.map((campo) => {
              const id = `gw-${gateway.tipo}-${campo.chave}`;
              const placeholder =
                campo.secreto && campo.preenchido ? "•••••••• salvo — deixe em branco para manter" : campo.placeholder;
              return (
                <div key={campo.chave} className="flex flex-col gap-1.5">
                  <Label htmlFor={id}>
                    {campo.label}
                    {campo.obrigatorio && <span className="text-destructive"> *</span>}
                  </Label>
                  {campo.multilinha ? (
                    <Textarea
                      id={id}
                      rows={3}
                      autoComplete="off"
                      placeholder={placeholder}
                      value={credenciais[campo.chave] ?? ""}
                      onChange={(event) => setCredenciais((prev) => ({ ...prev, [campo.chave]: event.target.value }))}
                    />
                  ) : (
                    <Input
                      id={id}
                      type={campo.secreto ? "password" : "text"}
                      autoComplete="off"
                      placeholder={placeholder}
                      value={credenciais[campo.chave] ?? ""}
                      onChange={(event) => setCredenciais((prev) => ({ ...prev, [campo.chave]: event.target.value }))}
                    />
                  )}
                  {campo.ajuda && <p className="text-muted-foreground text-xs">{campo.ajuda}</p>}
                </div>
              );
            })}
          </section>

          <section className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Modo sandbox / homologação</span>
                <span className="text-muted-foreground text-xs">Usa o ambiente de testes do gateway (sem cobranças reais).</span>
              </span>
              <Switch checked={sandbox} onCheckedChange={setSandbox} />
            </label>

            <label className="flex items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="text-sm font-medium">Gateway ativo</span>
                <span className="text-muted-foreground text-xs">
                  {gateway.implementado
                    ? "Só um gateway pode estar ativo por vez."
                    : "Indisponível até a integração ser concluída."}
                </span>
              </span>
              <Switch checked={ativo} onCheckedChange={setAtivo} disabled={!gateway.implementado} />
            </label>
            {substituiAtivo && (
              <p className="text-muted-foreground text-xs">
                Ao salvar, {gatewayAtivoNome} deixa de ser o gateway ativo.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-medium">Taxas (opcional)</h3>
              <p className="text-muted-foreground text-xs">Informativo — para comparar o custo de cada gateway.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TAXA_CAMPOS.map((campo) => (
                <div key={campo.chave} className="flex flex-col gap-1.5">
                  <Label htmlFor={`gw-${gateway.tipo}-${campo.chave}`} className="text-xs">
                    {campo.label}
                  </Label>
                  <Input
                    id={`gw-${gateway.tipo}-${campo.chave}`}
                    inputMode="decimal"
                    placeholder="0,00"
                    value={taxas[campo.chave] ?? ""}
                    onChange={(event) => setTaxas((prev) => ({ ...prev, [campo.chave]: event.target.value }))}
                  />
                </div>
              ))}
            </div>
          </section>

          {teste && (
            <p
              role="status"
              className={`flex items-start gap-2 rounded-md p-3 text-sm ${
                teste.ok ? "bg-green-500/10 text-green-600 dark:text-green-400" : "bg-destructive/10 text-destructive"
              }`}
            >
              {teste.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <XCircle className="mt-0.5 size-4 shrink-0" />}
              {teste.ok ? "Conexão realizada com sucesso." : (teste.erro ?? "Não foi possível conectar.")}
            </p>
          )}
          {erro && (
            <p role="alert" className="text-destructive text-sm">
              {erro}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleTestar} disabled={testando || salvando}>
            <PlugZap />
            {testando ? "Testando..." : "Testar conexão"}
          </Button>
          <Button type="button" onClick={handleSalvar} disabled={salvando || testando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
