"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const INTERVALO_MS = 10_000;

// Polling a cada 10s (TAREFA: /conecta/aguardando-pagamento deve avisar quando o pagamento for
// confirmado, sem o candidato precisar recarregar a página) — para de consultar assim que
// confirma, nunca continua rodando em segundo plano depois disso.
export function AguardandoPagamentoPoller({ paymentId }: { paymentId: string }) {
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (confirmado) return;

    let cancelado = false;
    async function verificar() {
      try {
        const resposta = await fetch(`/api/conecta/status?payment=${encodeURIComponent(paymentId)}`);
        const dados = (await resposta.json()) as { pago?: boolean };
        if (!cancelado && dados.pago) setConfirmado(true);
      } catch {
        // Falha de rede pontual — a próxima tentativa do intervalo cobre.
      }
    }

    verificar();
    const intervalo = setInterval(verificar, INTERVALO_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [paymentId, confirmado]);

  if (!confirmado) return null;

  return (
    <Card className="border-green-500/30">
      <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
        <span className="text-3xl">✅</span>
        <p className="font-medium">Pagamento confirmado!</p>
        <p className="text-muted-foreground text-sm">Verifique seu WhatsApp e email para criar sua senha de acesso.</p>
        <Button nativeButton={false} render={<Link href="/entrar" />} className="w-full">
          Acessar meu perfil
        </Button>
      </CardContent>
    </Card>
  );
}
