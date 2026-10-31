"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import {
  registrarWhatsappStub,
  enviarComprovanteWhatsappAction,
  enviarContratoWhatsappAction,
  enviarLembreteAulaWhatsappAction,
  enviarLembreteFaltaWhatsappAction,
  type WhatsappStubTipo,
} from "@/app/admin/matriculas/actions";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// "dados_acesso" continua com o disparar() síncrono (alert otimista) por não fazer parte desta
// tarefa. "contrato" e "comprovante" enviam de verdade pelo GênZap (Evolution API), com
// feedback real de sucesso/erro — ver TIPOS_COM_ENVIO_REAL/useEnviarDocumentoWhatsapp abaixo.
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

type TipoComEnvioReal = "contrato" | "comprovante" | "lembrete_aula" | "lembrete_falta";

const ACOES_ENVIO_REAL: Record<TipoComEnvioReal, { action: (matriculaId: string) => Promise<{ success: true } | { error: string }>; sucesso: string }> = {
  contrato: { action: enviarContratoWhatsappAction, sucesso: "Contrato enviado via WhatsApp!" },
  comprovante: { action: enviarComprovanteWhatsappAction, sucesso: "Comprovante enviado via WhatsApp!" },
  lembrete_aula: { action: enviarLembreteAulaWhatsappAction, sucesso: "Lembrete de aula enviado via WhatsApp!" },
  lembrete_falta: { action: enviarLembreteFaltaWhatsappAction, sucesso: "Lembrete de falta enviado via WhatsApp!" },
};

function ehTipoComEnvioReal(tipo: WhatsappStubTipo): tipo is TipoComEnvioReal {
  return tipo === "contrato" || tipo === "comprovante" || tipo === "lembrete_aula" || tipo === "lembrete_falta";
}

// Compartilhado entre WhatsappStubButton e WhatsappStubDropdown: "contrato"/"comprovante" são os
// únicos tipos com feedback de sucesso/erro real (as Server Actions são awaitable, não
// fire-and-forget como o resto) — por isso precisam de estado próprio de loading/resultado, em
// vez do disparar() síncrono (alert otimista) usado por dados_acesso.
function useEnviarDocumentoWhatsapp(tipo: TipoComEnvioReal, matriculaId: string) {
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);

  async function enviar() {
    setMensagem(null);
    setEnviando(true);
    try {
      const { action, sucesso } = ACOES_ENVIO_REAL[tipo];
      const resultado = await action(matriculaId);
      setMensagem(
        "error" in resultado ? { tipo: "erro", texto: resultado.error } : { tipo: "sucesso", texto: sucesso },
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
  const envioReal = useEnviarDocumentoWhatsapp(ehTipoComEnvioReal(tipo) ? tipo : "contrato", matriculaId);

  if (ehTipoComEnvioReal(tipo)) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || envioReal.enviando}
          className={WHATSAPP_BUTTON_CLASS}
          onClick={envioReal.enviar}
        >
          <MessageCircle />
          {envioReal.enviando ? "Enviando..." : label}
        </Button>
        {envioReal.mensagem && (
          <span
            className={
              envioReal.mensagem.tipo === "erro"
                ? "text-destructive text-xs"
                : "text-xs text-green-600 dark:text-green-400"
            }
          >
            {envioReal.mensagem.texto}
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
  // Envia de verdade pelo GênZap desde esta tarefa — ver useEnviarDocumentoWhatsapp.
  { tipo: "contrato", label: "📱 Enviar contrato" },
  { tipo: "comprovante", label: "📱 Enviar comprovante" },
  { tipo: "dados_acesso", label: "📱 Dados de acesso", mensagem: MENSAGEM_DADOS_ACESSO },
  // TAREFA — mesmo envio real (GênZap) dos dois de cima, reaproveitando o template/função do
  // disparo automático (cron de lembrete-aula / registrarPresencas, ver lib/mensagens/mensagens.ts).
  { tipo: "lembrete_aula", label: "📚 Lembrete de aula" },
  { tipo: "lembrete_falta", label: "⚠️ Lembrete de falta" },
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
  const contrato = useEnviarDocumentoWhatsapp("contrato", matriculaId);
  const comprovante = useEnviarDocumentoWhatsapp("comprovante", matriculaId);
  const lembreteAula = useEnviarDocumentoWhatsapp("lembrete_aula", matriculaId);
  const lembreteFalta = useEnviarDocumentoWhatsapp("lembrete_falta", matriculaId);
  const estadoPorTipo = { contrato, comprovante, lembrete_aula: lembreteAula, lembrete_falta: lembreteFalta } as const;
  const mensagemAtual = contrato.mensagem ?? comprovante.mensagem ?? lembreteAula.mensagem ?? lembreteFalta.mensagem;

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
          {opcoes.map((opcao) => {
            const real = ehTipoComEnvioReal(opcao.tipo) ? estadoPorTipo[opcao.tipo] : null;
            return (
              <DropdownMenuItem
                key={opcao.tipo}
                disabled={real?.enviando}
                onClick={() => (real ? real.enviar() : disparar(opcao.tipo, matriculaId, opcao.mensagem ?? MENSAGEM_PADRAO))}
              >
                {real?.enviando ? "Enviando..." : opcao.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {mensagemAtual && (
        <span
          className={
            mensagemAtual.tipo === "erro" ? "text-destructive text-xs" : "text-xs text-green-600 dark:text-green-400"
          }
        >
          {mensagemAtual.texto}
        </span>
      )}
    </div>
  );
}
