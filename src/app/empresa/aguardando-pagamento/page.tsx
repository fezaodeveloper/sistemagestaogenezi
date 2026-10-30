import Link from "next/link";
import { ExternalLink, MessageCircle, QrCode } from "lucide-react";
import { buscarCobrancaAsaas, buscarQrCodePixConecta } from "@/lib/asaas/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { EmpresaAguardandoPagamentoPoller } from "@/components/empresa/empresa-aguardando-pagamento-poller";
import { PixCopiaCola } from "@/components/conecta/pix-copia-cola";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PASSOS_ACESSO = [
  { emoji: "✅", texto: "Aguarde a confirmação do pagamento (geralmente em minutos para PIX)" },
  { emoji: "🔎", texto: "Nossa equipe faz a aprovação final do cadastro" },
  { emoji: "📧", texto: "Você receberá um e-mail quando o acesso for liberado" },
  { emoji: "🚀", texto: "Acesse o painel em /empresa/login com o e-mail e a senha cadastrados" },
] as const;

const MENSAGEM_WHATSAPP_SUPORTE = encodeURIComponent(
  "Olá! Cadastrei minha empresa no Gênezi Conecta e preciso de ajuda com o pagamento.",
);

// Pública de propósito — a empresa ainda não tem acesso liberado (nem necessariamente pagou)
// quando chega aqui, é só o passo intermediário logo após o cadastro (mesmo padrão de
// /conecta/aguardando-pagamento, pro candidato externo).
export default async function EmpresaAguardandoPagamentoPage({
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
      // Best-effort — sem isso, a página só cai no estado sem QR Code/link direto; a empresa
      // ainda pode pagar por outra via do próprio Asaas (ex.: e-mail de cobrança).
    }
  }

  const admin = createAdminClient();
  const { data: configuracoes } = await admin
    .from("configuracoes")
    .select("escola_telefone, escola_email")
    .eq("id", true)
    .maybeSingle();

  const whatsappDigitos = configuracoes?.escola_telefone?.replace(/\D/g, "");

  return (
    <main className="dark bg-background text-foreground flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-5xl">⏳</span>
            <h1 className="text-xl font-semibold">Pagamento em análise</h1>
            <p className="text-muted-foreground text-sm">
              Sua conta será ativada após confirmação do pagamento e aprovação da nossa equipe.
            </p>
          </CardContent>
        </Card>

        {paymentId && <EmpresaAguardandoPagamentoPoller paymentId={paymentId} />}

        {(pix ?? cobranca?.invoiceUrl) && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
              {pix && (
                <>
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
                </>
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
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col gap-3 py-6">
            <h2 className="text-sm font-semibold">Como acessar após a confirmação</h2>
            <ol className="flex flex-col gap-2">
              {PASSOS_ACESSO.map((passo, indice) => (
                <li key={passo.texto} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground font-mono text-xs">{indice + 1}.</span>
                  <span>
                    {passo.emoji} {passo.texto}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Button render={<Link href="/empresa/login" />} nativeButton={false} className="w-full">
          Ir para o login
        </Button>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-muted-foreground text-sm">Precisa de ajuda com o pagamento?</p>
            {whatsappDigitos && (
              <Button
                variant="outline"
                className="w-full text-green-600 dark:text-green-400"
                nativeButton={false}
                render={
                  <a
                    href={`https://wa.me/55${whatsappDigitos}?text=${MENSAGEM_WHATSAPP_SUPORTE}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <MessageCircle className="size-4" />
                Falar no WhatsApp
              </Button>
            )}
            {configuracoes?.escola_email && (
              <p className="text-muted-foreground text-xs">
                Ou envie um email para{" "}
                <a href={`mailto:${configuracoes.escola_email}`} className="underline underline-offset-2">
                  {configuracoes.escola_email}
                </a>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
