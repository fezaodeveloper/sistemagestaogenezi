import Link from "next/link";
import { ExternalLink, Hourglass, QrCode } from "lucide-react";
import { buscarCobrancaAsaas, buscarQrCodePixConecta } from "@/lib/asaas/client";
import { PixCopiaCola } from "@/components/conecta/pix-copia-cola";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Pública de propósito — o candidato ainda não tem perfil ativo (nem
// necessariamente confirmou senha) quando chega aqui, é só o passo
// intermediário logo após o cadastro (REGRA da tarefa).
//
// ?payment=<id> vem do redirect de cadastrarCandidatoExterno (best-effort —
// pode não vir, se a busca da cobrança falhar lá). Busca de novo aqui em
// vez de confiar num invoiceUrl passado cru pela URL: garante o dado
// atualizado (ex.: status já pago) e é o único jeito de conseguir o QR Code
// Pix, que exige uma chamada própria por paymentId (ver buscarQrCodePixConecta).
export default async function ConectaAguardandoPagamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment: paymentId } = await searchParams;

  let cobranca: Awaited<ReturnType<typeof buscarCobrancaAsaas>> | null = null;
  let pix: Awaited<ReturnType<typeof buscarQrCodePixConecta>> | null = null;

  if (paymentId) {
    try {
      cobranca = await buscarCobrancaAsaas(paymentId);
      if (cobranca.billingType === "PIX") {
        pix = await buscarQrCodePixConecta(paymentId);
      }
    } catch {
      // Best-effort — sem isso, a página só cai no estado genérico abaixo
      // (sem QR Code/link direto), o candidato ainda recebeu o e-mail com
      // os dados de acesso e pode voltar aqui depois.
    }
  }

  return (
    <main className="dark bg-background text-foreground flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <Hourglass className="text-primary size-10" />
          <h1 className="text-xl font-semibold">Aguardando confirmação do pagamento</h1>
          <p className="text-muted-foreground text-sm">
            Assim que seu pagamento for confirmado, seu perfil será ativado automaticamente. Você
            receberá um e-mail de confirmação.
          </p>

          {pix && (
            <div className="flex w-full flex-col items-center gap-3 border-t pt-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <QrCode className="size-4" />
                Escaneie o QR Code ou copie o código para pagar
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element -- imagem gerada sob demanda pelo Asaas (data URI base64), não é um asset do projeto pra otimizar via next/image */}
              <img
                src={`data:image/png;base64,${pix.encodedImage}`}
                alt="QR Code Pix"
                className="size-48 rounded-md border bg-white p-2"
              />
              <PixCopiaCola payload={pix.payload} />
            </div>
          )}

          {cobranca?.invoiceUrl && (
            <Button
              render={<a href={cobranca.invoiceUrl} target="_blank" rel="noreferrer" />}
              nativeButton={false}
              className="w-full"
            >
              <ExternalLink className="size-4" />
              Clique aqui para pagar
            </Button>
          )}

          <p className="text-muted-foreground text-sm">Já pagou? Aguarde alguns minutos e acesse:</p>
          <Button render={<Link href="/entrar" />} nativeButton={false} variant="outline" className="w-full">
            Entrar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
