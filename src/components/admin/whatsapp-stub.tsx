"use client";

import { MessageCircle } from "lucide-react";
import { registrarWhatsappStub, type WhatsappStubTipo } from "@/app/admin/matriculas/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Nenhum botão desta tela chama a API do WhatsApp de verdade — todos são
// stubs que só disparam whatsapp.stub (ver registrarWhatsappStub em
// src/app/admin/matriculas/actions.ts) pra registrar a intenção no log de
// automações, e mostram esta mensagem padrão. "Desabilitados visualmente"
// (pedido da tarefa) é lido aqui como "com cara de recurso ainda não
// ativo" (opacidade reduzida) — os botões continuam clicáveis de verdade,
// já que precisam dessa interação pra disparar o evento e o alerta.
const MENSAGEM_PADRAO =
  "Integração com WhatsApp em breve. Esta funcionalidade será habilitada com a API Evolution.";

const WHATSAPP_BUTTON_CLASS =
  "border-green-500/30 text-green-600 opacity-80 hover:bg-green-500/10 hover:text-green-700 hover:opacity-100 dark:text-green-400 dark:hover:text-green-300";

function disparar(tipo: WhatsappStubTipo, matriculaId: string, mensagem: string) {
  void registrarWhatsappStub(tipo, matriculaId);
  window.alert(mensagem);
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

const OPCOES_PADRAO: { tipo: WhatsappStubTipo; label: string }[] = [
  { tipo: "contrato", label: "📱 Enviar contrato" },
  { tipo: "comprovante", label: "📱 Enviar comprovante" },
  { tipo: "dados_acesso", label: "📱 Dados de acesso" },
];

export function WhatsappStubDropdown({
  matriculaId,
  triggerLabel = "📱 WhatsApp",
}: {
  matriculaId: string;
  triggerLabel?: string;
}) {
  return (
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
        {OPCOES_PADRAO.map((opcao) => (
          <DropdownMenuItem
            key={opcao.tipo}
            onClick={() => disparar(opcao.tipo, matriculaId, MENSAGEM_PADRAO)}
          >
            {opcao.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
