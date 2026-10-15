"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { registrarWhatsappStub, enviarContratoWhatsappAction, type WhatsappStubTipo } from "@/app/admin/matriculas/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// "comprovante" continua STUB — só dispara whatsapp.stub (ver registrarWhatsappStub em
// src/app/admin/matriculas/actions.ts) pra registrar a intenção no log de automações, e mostra
// esta mensagem padrão. "dados_acesso" e, agora, "contrato" enviam de verdade pelo GênZap
// (Evolution API) — ver MENSAGEM_DADOS_ACESSO e useEnviarContratoWhatsapp abaixo.
const MENSAGEM_PADRAO =
  "Integração com WhatsApp em breve. Esta funcionalidade será habilitada com a API Evolution.";

// Exportada pra outros botões de WhatsApp fora deste arquivo terem o mesmo visual (ex.:
// "Enviar cobrança"/"Enviar comprovante" em financeiro-view.tsx, que não são mais stub).
export const WHATSAPP_BUTTON_CLASS =
  "border-green-500/30 text-green-600 opacity-80 hover:bg-green-500/10 hover:text-green-700 hover:opacity-100 dark:text-green-400 dark:hover:text-green-300";

function disparar(tipo: WhatsappStubTipo, matriculaId: string, mensagem: string) {
  void registrarWhatsappStub(tipo, matriculaId);
  window.alert(mensagem);
}

// Compartilhado entre WhatsappStubButton e WhatsappStubDropdown: "contrato" é o único tipo com
// feedback de sucesso/erro real (enviarContratoWhatsappAction é awaitable, não
// fire-and-forget como o resto) — por isso precisa do próprio estado de loading/resultado, em
// vez do disparar() síncrono (alert otimista) usado por comprovante/dados_acesso.
function useEnviarContratoWhatsapp(matriculaId: string) {
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  async function enviar() {
    setMensagem(null);
    setEnviando(true);
    try {
      const resultado = await enviarContratoWhatsappAction(matriculaId);
      setMensagem(
        "error" in resultado
          ? { tipo: "erro", texto: resultado.error }
          : { tipo: "sucesso", texto: "Contrato enviado via WhatsApp!" },
      );
    } finally {
      setEnviando(false);
    }
  }

  return { enviando, mensagem, enviar };
}

export function WhatsappStubButton({
  tipo,
  matriculaId,
  label,
  mensagem = MENSAGEM_PADRAO,
  disabled = false,
}: {
  tipo: WhatsappStubTipo;
  matriculaId: string;
  label: string;
  mensagem?: string;
  disabled?: boolean;
}) {
  const contrato = useEnviarContratoWhatsapp(matriculaId);

  if (tipo === "contrato") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || contrato.enviando}
          className={WHATSAPP_BUTTON_CLASS}
          onClick={contrato.enviar}
        >
          <MessageCircle />
          {contrato.enviando ? "Enviando..." : label}
        </Button>
        {contrato.mensagem && (
          <span
            className={
              contrato.mensagem.tipo === "erro"
                ? "text-destructive text-xs"
                : "text-xs text-green-600 dark:text-green-400"
            }
          >
            {contrato.mensagem.texto}
          </span>
        )}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            className={WHATSAPP_BUTTON_CLASS}
            onClick={() => disparar(tipo, matriculaId, mensagem)}
          >
            <MessageCircle />
            {label}
          </Button>
        }
      />
      <TooltipContent>Stub — integração real (API Evolution) ainda não ligada.</TooltipContent>
    </Tooltip>
  );
}

type OpcaoWhatsappStub = { tipo: WhatsappStubTipo; label: string; mensagem?: string };

const MENSAGEM_DADOS_ACESSO = "Enviando os dados de acesso por WhatsApp (GênZap)...";

const OPCOES_PADRAO: OpcaoWhatsappStub[] = [
  // Envia de verdade pelo GênZap desde esta tarefa — ver useEnviarContratoWhatsapp.
  { tipo: "contrato", label: "📱 Enviar contrato" },
  { tipo: "comprovante", label: "📱 Enviar comprovante" },
  { tipo: "dados_acesso", label: "📱 Dados de acesso", mensagem: MENSAGEM_DADOS_ACESSO },
];

export function WhatsappStubDropdown({
  matriculaId,
  triggerLabel = "📱 WhatsApp",
  opcoes = OPCOES_PADRAO,
}: {
  matriculaId: string;
  triggerLabel?: string;
  // Permite opções e mensagens próprias por tela (ex.: financeiro-view.tsx,
  // onde a mensagem do stub muda conforme asaas_invoice_url/status da
  // parcela) — sem isso, fica preso às 3 opções fixas de matrícula/contrato.
  opcoes?: OpcaoWhatsappStub[];
}) {
  const contrato = useEnviarContratoWhatsapp(matriculaId);

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" size="sm" className={WHATSAPP_BUTTON_CLASS}>
              <MessageCircle />
              {triggerLabel} ▾
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          {opcoes.map((opcao) => (
            <DropdownMenuItem
              key={opcao.tipo}
              disabled={opcao.tipo === "contrato" && contrato.enviando}
              onClick={() =>
                opcao.tipo === "contrato"
                  ? contrato.enviar()
                  : disparar(opcao.tipo, matriculaId, opcao.mensagem ?? MENSAGEM_PADRAO)
              }
            >
              {opcao.tipo === "contrato" && contrato.enviando ? "Enviando contrato..." : opcao.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {contrato.mensagem && (
        <span
          className={
            contrato.mensagem.tipo === "erro"
              ? "text-destructive text-xs"
              : "text-xs text-green-600 dark:text-green-400"
          }
        >
          {contrato.mensagem.texto}
        </span>
      )}
    </div>
  );
}
