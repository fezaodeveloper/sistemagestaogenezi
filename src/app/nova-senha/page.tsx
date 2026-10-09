import { NovaSenhaForm } from "@/components/auth/nova-senha-form";
import { Card, CardContent } from "@/components/ui/card";

// Pública de propósito (REGRA da tarefa) — ver ROTAS_PUBLICAS em src/proxy.ts. Sem
// requireRole/getCurrentProfile aqui: o token de recovery chega no FRAGMENTO da URL
// (#access_token=...), que o navegador nunca envia numa requisição — o servidor não tem como
// saber se a sessão é válida na primeira resposta. Só o client (NovaSenhaForm) consegue
// detectar isso depois de montar.
export default function NovaSenhaPage() {
  return (
    <main className="dark bg-background text-foreground flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col gap-6 py-8">
          <div className="text-center">
            <h1 className="text-xl font-semibold">Definir nova senha</h1>
            <p className="text-muted-foreground text-sm">Escolha a nova senha para acessar sua conta.</p>
          </div>
          <NovaSenhaForm />
        </CardContent>
      </Card>
    </main>
  );
}
