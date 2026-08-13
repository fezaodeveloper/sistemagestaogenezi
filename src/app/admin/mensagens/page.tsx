import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMensagensEnviadas } from "@/lib/mensagens/mensagens";
import { TabelaMensagensEnviadas } from "@/components/admin/tabela-mensagens-enviadas";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function MensagensPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const itens = await getMensagensEnviadas(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mensagens de WhatsApp</h1>
          <p className="text-muted-foreground text-sm">
            Histórico dos últimos 200 envios (matrícula criada, lembrete de aula, sentimos sua falta).
          </p>
        </div>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/mensagens/configuracao" />}>
          Configuração
        </Button>
      </div>

      {itens.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Nenhuma mensagem enviada ainda.
          </CardContent>
        </Card>
      ) : (
        <TabelaMensagensEnviadas itens={itens} />
      )}
    </div>
  );
}
