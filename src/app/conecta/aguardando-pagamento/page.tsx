import Link from "next/link";
import { Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Pública de propósito — o candidato ainda não tem perfil ativo (nem
// necessariamente confirmou senha) quando chega aqui, é só o passo
// intermediário logo após o cadastro (REGRA da tarefa).
export default function ConectaAguardandoPagamentoPage() {
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
          <p className="text-muted-foreground text-sm">Já pagou? Aguarde alguns minutos e acesse:</p>
          <Button render={<Link href="/entrar" />} nativeButton={false}>
            Entrar
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
