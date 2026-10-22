import { PushSubscribeAluno } from "@/components/aluno/push-subscribe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Mesmo componente de toggle já usado no footer da sidebar (src/components/aluno/aluno-sidebar.tsx)
// — Fernando não encontrou a opção lá, pouco visível num footer compacto. Esta seção dedicada na
// página principal do portal (/aluno) é só um Card em volta do mesmo componente, com
// exibirIndisponivel=true pra mostrar também o estado "navegador sem suporte" aqui (no footer
// compacto esse estado continua mudo, ver push-subscribe.tsx).
export function NotificacoesPushCard({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>🔔 Notificações</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Receba avisos de novas aulas, lembretes e atualizações direto no seu navegador.
        </p>
        <PushSubscribeAluno vapidPublicKey={vapidPublicKey} exibirIndisponivel />
      </CardContent>
    </Card>
  );
}
