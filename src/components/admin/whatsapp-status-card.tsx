"use client";

// "use client": polling de status a cada 5s, geração/renovação do QR Code a cada 30s, e a Server
// Action de desconectar.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, QrCode } from "lucide-react";
import { desconectarWhatsapp } from "@/app/admin/configuracoes/whatsapp/actions";
import type { WhatsappStatus } from "@/lib/whatsapp/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const INTERVALO_STATUS_MS = 5_000;
const INTERVALO_QR_MS = 30_000;

const STATUS_INFO: Record<WhatsappStatus, { rotulo: string; classe: string }> = {
  conectado: { rotulo: "Conectado", classe: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30" },
  aguardando_qr: { rotulo: "Aguardando QR Code", classe: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  desconectado: { rotulo: "Desconectado", classe: "bg-destructive/10 text-destructive border-destructive/30" },
};

type StatusResposta = { ativo: boolean; status: WhatsappStatus; numeroConectado: string | null };
type ConectarResposta = { qrCode: string | null; status: WhatsappStatus; numeroConectado: string | null } | { error: string };

export function WhatsappStatusCard({
  statusInicial,
  numeroConectadoInicial,
  conexaoConfigurada,
}: {
  statusInicial: WhatsappStatus;
  numeroConectadoInicial: string | null;
  // false = URL/instância/chave incompletas — "Conectar" fica desabilitado.
  conexaoConfigurada: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(statusInicial);
  const [numero, setNumero] = useState(numeroConectadoInicial);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [carregandoQr, setCarregandoQr] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoDesconectar, setConfirmandoDesconectar] = useState(false);
  const [desconectando, setDesconectando] = useState(false);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const buscarStatus = useCallback(async () => {
    try {
      const resposta = await fetch("/api/whatsapp/status");
      if (!resposta.ok) return;
      const dados = (await resposta.json()) as StatusResposta;
      setStatus(dados.status);
      setNumero(dados.numeroConectado);
      if (dados.status === "conectado") setQrCode(null);
    } catch {
      // Transitório de rede: mantém o último status exibido, tenta de novo no próximo tick.
    }
  }, []);

  async function conectar() {
    setErro(null);
    setCarregandoQr(true);
    try {
      const resposta = await fetch("/api/whatsapp/conectar", { method: "POST" });
      const dados = (await resposta.json()) as ConectarResposta;
      if (!resposta.ok || "error" in dados) {
        setErro("error" in dados ? dados.error : "Não foi possível gerar o QR Code.");
        return;
      }
      setStatus(dados.status);
      setNumero(dados.numeroConectado);
      setQrCode(dados.qrCode);
    } catch {
      setErro("Não foi possível falar com o servidor. Tente novamente.");
    } finally {
      setCarregandoQr(false);
    }
  }

  // Polling de status a cada 5s enquanto a tela estiver com o QR aberto (aguardando_qr) — some
  // sozinho quando conecta ou quando o admin sai da aba "aguardando".
  useEffect(() => {
    if (status !== "aguardando_qr") return;
    const id = setInterval(buscarStatus, INTERVALO_STATUS_MS);
    return () => clearInterval(id);
  }, [status, buscarStatus]);

  // Renova o QR Code a cada 30s (o da Evolution API expira) enquanto ainda aguardando leitura.
  useEffect(() => {
    if (status !== "aguardando_qr" || !qrCode) return;
    const id = setInterval(() => {
      if (statusRef.current === "aguardando_qr") void conectar();
    }, INTERVALO_QR_MS);
    return () => clearInterval(id);
  }, [status, qrCode]);

  function desconectar() {
    setDesconectando(true);
    void (async () => {
      const r = await desconectarWhatsapp();
      setDesconectando(false);
      if ("error" in r) {
        setErro(r.error);
        return;
      }
      setConfirmandoDesconectar(false);
      setStatus("desconectado");
      setNumero(null);
      setQrCode(null);
      router.refresh();
    })();
  }

  const info = STATUS_INFO[status];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Status da conexão</span>
            <Badge variant="outline" className={info.classe}>
              {info.rotulo}
            </Badge>
          </div>
          {status === "conectado" ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmandoDesconectar(true)}>
              <LogOut />
              Desconectar
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={!conexaoConfigurada || carregandoQr} onClick={conectar}>
              {carregandoQr ? <Loader2 className="animate-spin" /> : <QrCode />}
              {carregandoQr ? "Gerando..." : "Conectar / Gerar QR Code"}
            </Button>
          )}
        </div>

        {status === "conectado" && numero && <p className="text-muted-foreground text-sm">Número conectado: {numero}</p>}

        {!conexaoConfigurada && status !== "conectado" && (
          <p className="text-muted-foreground text-sm">Preencha e salve a URL, a instância e a chave da API acima antes de conectar.</p>
        )}

        {erro && (
          <p role="alert" className="text-destructive text-sm">
            {erro}
          </p>
        )}

        {qrCode && status === "aguardando_qr" && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI gerado pela Evolution API, não um asset do projeto */}
            <img src={qrCode} alt="QR Code do WhatsApp" className="size-56 rounded-md bg-white p-2" />
            <p className="text-muted-foreground max-w-xs text-center text-xs">
              Abra o WhatsApp no celular, vá em Aparelhos conectados &gt; Conectar um aparelho e aponte a câmera. O código se renova
              sozinho a cada 30 segundos.
            </p>
          </div>
        )}
      </CardContent>

      <AlertDialog open={confirmandoDesconectar} onOpenChange={(aberto) => !desconectando && setConfirmandoDesconectar(aberto)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar WhatsApp</AlertDialogTitle>
            <AlertDialogDescription>
              O envio automático de mensagens para de funcionar até você conectar de novo (lendo um novo QR Code).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={desconectando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={desconectando} onClick={desconectar}>
              {desconectando ? "Desconectando..." : "Desconectar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
