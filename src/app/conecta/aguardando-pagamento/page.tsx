import Link from "next/link";
import { ExternalLink, MessageCircle, QrCode } from "lucide-react";
import { buscarCobrancaAsaas, buscarQrCodePixConecta } from "@/lib/asaas/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { PixCopiaCola } from "@/components/conecta/pix-copia-cola";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PASSOS_ACESSO = [
  { emoji: "✅", texto: "Aguarde a confirmação do pagamento (geralmente em minutos para PIX)" },
  { emoji: "📧", texto: "Você receberá um email com o link para criar sua senha" },
  { emoji: "🔐", texto: "Clique no link do email para criar sua senha de acesso" },
  { emoji: "🚀", texto: "Acesse o portal em /entrar com seu email e nova senha" },
] as const;

const MENSAGEM_WHATSAPP_SUPORTE = encodeURIComponent(
  "Olá! Me cadastrei no Gênezi Conecta e não recebi o email de acesso.",
);

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
      // Best-effort — sem isso, a página só cai no estado sem QR Code/link
      // direto; o candidato ainda recebeu o e-mail de cadastro e pode
      // voltar aqui depois, ou pagar por outra via do próprio Asaas.
    }
  }

  // Client admin: esta página é pública (sem sessão), e o grant de select
  // em configuracoes pra "anon" só libera escola_logo_url/login_rodape (ver
  // 20260916100000_banners_tamanho_texto.sql) — telefone/email da escola
  // exigem o bypass do service_role, mesmo padrão já usado noutras leituras
  // públicas deste projeto (REGRA da tarefa: buscar de configuracoes via
  // service_role). Não existe uma coluna "escola_whatsapp" dedicada — reuso
  // escola_telefone, que é o número já cadastrado pelo admin em
  // /admin/configuracoes.
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
              Seu acesso será liberado automaticamente assim que o pagamento for confirmado.
            </p>
          </CardContent>
        </Card>

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

        <Button render={<Link href="/entrar" />} nativeButton={false} className="w-full">
          Ir para o login
        </Button>

        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-muted-foreground text-sm">Não recebeu o email? Entre em contato:</p>
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
                <a
                  href={`mailto:${configuracoes.escola_email}`}
                  className="underline underline-offset-2"
                >
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
