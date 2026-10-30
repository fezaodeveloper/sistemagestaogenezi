"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const INTERVALO_MS = 10_000;

// Mesmo endpoint/polling de AguardandoPagamentoPoller (src/components/conecta/), mas com cópia e
// destino de link diferentes: a empresa JÁ tem senha própria (escolhida no cadastro, diferente do
// candidato externo, que recebe link por email) — não precisa de "crie sua senha", só entrar.
export function EmpresaAguardandoPagamentoPoller({ paymentId }: { paymentId: string }) {
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
        <p className="text-muted-foreground text-sm">
          Seu acesso será liberado após a aprovação final da nossa equipe.
        </p>
        <Button nativeButton={false} render={<Link href="/empresa/login" />} className="w-full">
          Ir para o login
        </Button>
      </CardContent>
    </Card>
  );
}
