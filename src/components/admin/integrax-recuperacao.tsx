"use client";

// "use client": estado da lista de etapas (adicionar/remover/editar), slider do prazo e Server Action.

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { salvarRecuperacaoSms } from "@/app/admin/configuracoes/apps/integrax/actions";
import {
  RECUPERACAO_ATALHOS_HORAS,
  RECUPERACAO_HORAS_MIN,
  RECUPERACAO_MAX_ETAPAS,
  RECUPERACAO_PRAZO_MAX_DIAS,
  RECUPERACAO_PRAZO_MIN_DIAS,
  diasParaHoras,
  rotuloHoras,
} from "@/lib/integrax/recuperacao";
import { RECUPERACAO_PLACEHOLDERS } from "@/lib/integrax/templates";
import { SmsCampoMensagem } from "@/components/admin/sms-campo-mensagem";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type EtapaEdicao = { chave: number; horas: string; mensagem: string };

export type RecuperacaoInicial = {
  ativo: boolean;
  prazoDias: number;
  etapas: { horas: number; mensagem: string }[];
};

const MENSAGEM_INICIAL = "{nome_cliente}, ainda tem interesse em {curso_interesse}? Agende uma conversa: {link_agendamento}";

export function IntegraxRecuperacao({
  inicial,
  integracaoAtiva,
  enviadosUltimos7Dias,
}: {
  inicial: RecuperacaoInicial;
  // Token salvo e integração ligada: sem isso o cron não envia nada (fica só aguardando).
  integracaoAtiva: boolean;
  enviadosUltimos7Dias: number | null;
}) {
  const router = useRouter();
  const proximaChave = useRef(inicial.etapas.length);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [prazoDias, setPrazoDias] = useState(inicial.prazoDias);
  const [etapas, setEtapas] = useState<EtapaEdicao[]>(
    inicial.etapas.map((e, i) => ({ chave: i, horas: String(e.horas), mensagem: e.mensagem })),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [salvando, startSalvar] = useTransition();

  const prazoHoras = diasParaHoras(prazoDias);

  function atualizarEtapa(chave: number, parcial: Partial<EtapaEdicao>) {
    setOk(false);
    setEtapas((atual) => atual.map((e) => (e.chave === chave ? { ...e, ...parcial } : e)));
  }

  function adicionarEtapa() {
    if (etapas.length >= RECUPERACAO_MAX_ETAPAS) return;
    setOk(false);
    // Sugere um horário depois da última etapa, dentro do prazo.
    const ultima = Math.max(0, ...etapas.map((e) => Number(e.horas) || 0));
    const sugestao = Math.min(prazoHoras, ultima + 24 || 24);
    setEtapas((atual) => [...atual, { chave: proximaChave.current++, horas: String(sugestao), mensagem: MENSAGEM_INICIAL }]);
  }

  function removerEtapa(chave: number) {
    setOk(false);
    setEtapas((atual) => atual.filter((e) => e.chave !== chave));
  }

  function salvar() {
    setErro(null);
    setOk(false);

    const convertidas = etapas.map((e) => ({ horas: Number(e.horas), mensagem: e.mensagem }));
    if (convertidas.some((e) => !Number.isFinite(e.horas) || !Number.isInteger(e.horas))) {
      setErro("Informe as horas de cada etapa em número inteiro.");
      return;
    }

    startSalvar(async () => {
      const r = await salvarRecuperacaoSms({ ativo, prazoDias, etapas: convertidas });
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setOk(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Como funciona</CardTitle>
          <CardDescription>
            Sequência automática de SMS para leads que se cadastraram mas ainda não se matricularam.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li>
              O envio roda <strong>uma vez por dia</strong> (por volta das 11h, horário de Brasília). Uma etapa sai na primeira execução
              depois de vencida — por isso pode chegar até 24h depois do horário marcado.
            </li>
            <li>Se um lead já passou por várias etapas no mesmo dia, recebe só a mais avançada (as anteriores são puladas).</li>
            <li>Só entram leads cadastrados <strong>depois</strong> de ativar a recuperação; leads antigos não recebem nada.</li>
            <li>Quem já virou aluno, foi marcado como matriculado/perdido ou descartado não recebe mais mensagens.</li>
            <li>A integração IntegraX precisa estar ativa (aba Configuração) — senão nada é enviado.</li>
          </ul>
          {!integracaoAtiva && (
            <p className="mt-3 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              A IntegraX está desativada ou sem token: a recuperação fica aguardando e nenhum SMS é enviado até você ativá-la.
            </p>
          )}
          {enviadosUltimos7Dias !== null && (
            <p className="text-muted-foreground mt-3 text-sm">
              SMS de recuperação enviados nos últimos 7 dias: <strong>{enviadosUltimos7Dias}</strong>.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="rec-ativo">Ativar recuperação por SMS</Label>
              <p className="text-muted-foreground text-sm">Desligado, nenhum SMS de recuperação é enviado.</p>
            </div>
            <Switch id="rec-ativo" checked={ativo} onCheckedChange={(v) => { setAtivo(v); setOk(false); }} disabled={salvando} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-prazo">Por quanto tempo tentar?</Label>
            <div className="flex items-center gap-4">
              <input
                id="rec-prazo"
                type="range"
                min={RECUPERACAO_PRAZO_MIN_DIAS}
                max={RECUPERACAO_PRAZO_MAX_DIAS}
                step={1}
                value={prazoDias}
                onChange={(e) => {
                  setPrazoDias(Number(e.target.value));
                  setOk(false);
                }}
                disabled={salvando}
                className="accent-primary max-w-xs flex-1"
              />
              <span className="w-20 text-sm font-medium tabular-nums">
                {prazoDias} {prazoDias === 1 ? "dia" : "dias"}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              Prazo máximo, contado a partir do cadastro do lead. Etapas além dele não são enviadas.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Etapas ({etapas.length}/{RECUPERACAO_MAX_ETAPAS})</h3>
          <Button type="button" size="sm" variant="outline" disabled={salvando || etapas.length >= RECUPERACAO_MAX_ETAPAS} onClick={adicionarEtapa}>
            <Plus />
            Adicionar etapa
          </Button>
        </div>

        {etapas.length === 0 && (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Nenhuma etapa. Adicione a primeira para começar a recuperar leads.
            </CardContent>
          </Card>
        )}

        {etapas.map((etapa, indice) => {
          const horas = Number(etapa.horas);
          const passaDoPrazo = Number.isFinite(horas) && horas > prazoHoras;
          return (
            <Card key={etapa.chave}>
              <CardContent className="flex flex-col gap-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="text-sm font-medium">Etapa {indice + 1}</span>
                  <Button type="button" size="sm" variant="ghost" disabled={salvando} onClick={() => removerEtapa(etapa.chave)}>
                    <Trash2 />
                    Remover etapa
                  </Button>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`rec-horas-${etapa.chave}`}>Quando enviar (horas após o cadastro do lead)</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      id={`rec-horas-${etapa.chave}`}
                      type="number"
                      inputMode="numeric"
                      min={RECUPERACAO_HORAS_MIN}
                      max={prazoHoras}
                      value={etapa.horas}
                      onChange={(e) => atualizarEtapa(etapa.chave, { horas: e.target.value })}
                      disabled={salvando}
                      aria-invalid={passaDoPrazo}
                      className="w-24"
                    />
                    <span className="text-muted-foreground text-sm">horas</span>
                    <div className="flex flex-wrap gap-1.5">
                      {RECUPERACAO_ATALHOS_HORAS.map((atalho) => (
                        <Button
                          key={atalho}
                          type="button"
                          size="xs"
                          variant={horas === atalho ? "default" : "outline"}
                          disabled={salvando || atalho > prazoHoras}
                          onClick={() => atualizarEtapa(etapa.chave, { horas: String(atalho) })}
                        >
                          {atalho}h
                        </Button>
                      ))}
                    </div>
                  </div>
                  {passaDoPrazo ? (
                    <p role="alert" className="text-destructive text-xs">
                      {rotuloHoras(horas)} passa do prazo de {prazoDias} {prazoDias === 1 ? "dia" : "dias"}. Aumente o prazo ou reduza as horas.
                    </p>
                  ) : (
                    Number.isFinite(horas) && horas >= RECUPERACAO_HORAS_MIN && <p className="text-muted-foreground text-xs">{rotuloHoras(horas)} depois do cadastro.</p>
                  )}
                </div>

                <SmsCampoMensagem
                  id={`rec-msg-${etapa.chave}`}
                  rotulo="Mensagem"
                  valor={etapa.mensagem}
                  onChange={(v) => atualizarEtapa(etapa.chave, { mensagem: v })}
                  placeholders={RECUPERACAO_PLACEHOLDERS}
                  desabilitado={salvando}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar alterações"}
        </Button>
        {ok && (
          <span role="status" className="text-sm text-green-600 dark:text-green-400">
            Alterações salvas.
          </span>
        )}
        {erro && (
          <span role="alert" className="text-destructive text-sm">
            {erro}
          </span>
        )}
      </div>
    </div>
  );
}
