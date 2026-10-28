"use client";

import { useState, useTransition } from "react";
import {
  salvarConectaHabilitado,
  salvarConfiguracoesTelegramConecta,
  salvarRecursos,
  type ConfigRecursosValues,
} from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RecursoChave = "gamificacao" | "premios" | "ranking" | "chat" | "certificados";
type CursoTipoChave = "presencial" | "ead" | "hibrido";

const RECURSOS: { chave: RecursoChave; label: string }[] = [
  { chave: "gamificacao", label: "🎮 Gamificação (pontos, badges, ranking)" },
  { chave: "premios", label: "🎁 Prêmios e resgates" },
  { chave: "ranking", label: "🏆 Ranking" },
  { chave: "chat", label: "💬 Chat com admin" },
  { chave: "certificados", label: "📜 Certificados" },
];

const TIPOS: { chave: CursoTipoChave; label: string }[] = [
  { chave: "presencial", label: "Presencial" },
  { chave: "ead", label: "EAD" },
  { chave: "hibrido", label: "Híbrido" },
];

function campo(recurso: RecursoChave, tipo: CursoTipoChave) {
  return `recurso_${recurso}_${tipo}` as keyof ConfigRecursosValues;
}

// Cada switch salva sozinho, ao mudar (mesmo padrão de BannerRow em
// banners-login-form.tsx) — sem botão "Salvar" separado. O FormData enviado
// a cada toggle carrega os 15 valores (não só o que mudou): mais simples que
// um PATCH parcial, e o estado inteiro já vive no client de qualquer forma.
export function ConfiguracoesRecursosForm({
  defaultValues,
  conectaHabilitadoInicial,
  telegramConectaChatIdInicial,
  tgConectaNovoCandidatoInicial,
  tgConectaNovaEmpresaInicial,
}: {
  defaultValues: ConfigRecursosValues;
  conectaHabilitadoInicial: boolean;
  telegramConectaChatIdInicial: string;
  tgConectaNovoCandidatoInicial: boolean;
  tgConectaNovaEmpresaInicial: boolean;
}) {
  const [valores, setValores] = useState(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [conectaHabilitado, setConectaHabilitado] = useState(conectaHabilitadoInicial);
  const [erroConecta, setErroConecta] = useState<string | null>(null);
  const [salvandoConecta, startTransitionConecta] = useTransition();

  function handleToggleConecta(checked: boolean) {
    const anterior = conectaHabilitado;
    setConectaHabilitado(checked);
    setErroConecta(null);

    startTransitionConecta(async () => {
      const resultado = await salvarConectaHabilitado(checked);
      if (resultado.error) {
        setErroConecta(resultado.error);
        setConectaHabilitado(anterior);
      }
    });
  }

  // Telegram do Conecta: chat_id é texto livre, salvo só ao clicar "Salvar" — diferente dos
  // switches abaixo (gravados sozinhos, ao mudar). Os dois toggles salvam junto com o chat_id
  // atual em memória, pra nunca gravar um valor de chat_id desatualizado por trás do switch.
  const [chatIdConecta, setChatIdConecta] = useState(telegramConectaChatIdInicial);
  const [notificarNovoCandidato, setNotificarNovoCandidato] = useState(tgConectaNovoCandidatoInicial);
  const [notificarNovaEmpresa, setNotificarNovaEmpresa] = useState(tgConectaNovaEmpresaInicial);
  const [erroTelegramConecta, setErroTelegramConecta] = useState<string | null>(null);
  const [salvoTelegramConecta, setSalvoTelegramConecta] = useState(false);
  const [salvandoTelegramConecta, startTransitionTelegramConecta] = useTransition();

  function salvarTelegramConecta(
    overrides: Partial<{ chatId: string; notificarNovoCandidato: boolean; notificarNovaEmpresa: boolean }> = {},
  ) {
    setErroTelegramConecta(null);
    setSalvoTelegramConecta(false);
    startTransitionTelegramConecta(async () => {
      const resultado = await salvarConfiguracoesTelegramConecta({
        chatId: overrides.chatId ?? chatIdConecta,
        notificarNovoCandidato: overrides.notificarNovoCandidato ?? notificarNovoCandidato,
        notificarNovaEmpresa: overrides.notificarNovaEmpresa ?? notificarNovaEmpresa,
      });
      if (resultado.error) {
        setErroTelegramConecta(resultado.error);
        return;
      }
      setSalvoTelegramConecta(true);
    });
  }

  function handleToggleNovoCandidato(checked: boolean) {
    setNotificarNovoCandidato(checked);
    salvarTelegramConecta({ notificarNovoCandidato: checked });
  }

  function handleToggleNovaEmpresa(checked: boolean) {
    setNotificarNovaEmpresa(checked);
    salvarTelegramConecta({ notificarNovaEmpresa: checked });
  }

  function handleToggle(recurso: RecursoChave, tipo: CursoTipoChave, checked: boolean) {
    const chave = campo(recurso, tipo);
    const valoresAnteriores = valores;
    const proximosValores = { ...valores, [chave]: checked };
    setValores(proximosValores);
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      for (const [nome, valor] of Object.entries(proximosValores)) {
        formData.set(nome, String(valor));
      }
      const resultado = await salvarRecursos(formData);
      if (resultado.error) {
        setError(resultado.error);
        setValores(valoresAnteriores);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recurso</TableHead>
            {TIPOS.map((tipo) => (
              <TableHead key={tipo.chave} className="text-center">
                {tipo.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {RECURSOS.map((recurso) => (
            <TableRow key={recurso.chave}>
              <TableCell className="text-sm">{recurso.label}</TableCell>
              {TIPOS.map((tipo) => {
                const chave = campo(recurso.chave, tipo.chave);
                return (
                  <TableCell key={chave} className="text-center">
                    <Switch
                      checked={valores[chave]}
                      disabled={isPending}
                      onCheckedChange={(checked) => handleToggle(recurso.chave, tipo.chave, checked === true)}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Separator className="my-2" />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Gênezi Conecta</h3>
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="conecta-habilitado" className="font-normal">
            Habilitar Gênezi Conecta
          </Label>
          <Switch
            id="conecta-habilitado"
            checked={conectaHabilitado}
            disabled={salvandoConecta}
            onCheckedChange={(checked) => handleToggleConecta(checked === true)}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          Quando desativado, o portal de empregos fica completamente oculto para alunos e
          candidatos externos.
        </p>
        {erroConecta && (
          <p role="alert" className="text-destructive text-sm">
            {erroConecta}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t pt-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="telegram-conecta-chat-id" className="font-normal">
              Telegram Chat ID do Conecta
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="telegram-conecta-chat-id"
                value={chatIdConecta}
                onChange={(e) => {
                  setChatIdConecta(e.target.value);
                  setSalvoTelegramConecta(false);
                }}
                placeholder="Ex.: -1001234567890"
                className="max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salvandoTelegramConecta}
                onClick={() => salvarTelegramConecta()}
              >
                {salvandoTelegramConecta ? "Salvando..." : "Salvar"}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Chat ou grupo do Telegram separado do Telegram geral da escola, dedicado só a
              notificações do Gênezi Conecta. Deixe em branco para não enviar nenhuma.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="tg-conecta-novo-candidato" className="font-normal">
              Notificar novo candidato
            </Label>
            <Switch
              id="tg-conecta-novo-candidato"
              checked={notificarNovoCandidato}
              disabled={salvandoTelegramConecta}
              onCheckedChange={(checked) => handleToggleNovoCandidato(checked === true)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="tg-conecta-nova-empresa" className="font-normal">
              Notificar nova empresa
            </Label>
            <Switch
              id="tg-conecta-nova-empresa"
              checked={notificarNovaEmpresa}
              disabled={salvandoTelegramConecta}
              onCheckedChange={(checked) => handleToggleNovaEmpresa(checked === true)}
            />
          </div>

          {erroTelegramConecta && (
            <p role="alert" className="text-destructive text-sm">
              {erroTelegramConecta}
            </p>
          )}
          {salvoTelegramConecta && !erroTelegramConecta && (
            <p className="text-sm text-green-600 dark:text-green-400">Salvo.</p>
          )}
        </div>
      </div>
    </div>
  );
}
