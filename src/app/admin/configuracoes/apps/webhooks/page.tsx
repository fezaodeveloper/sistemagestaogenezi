import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMetricasWebhooks24h, percentual } from "@/lib/webhooks/metricas";
import { WebhooksView } from "@/components/admin/webhooks-view";
import type { CursoOpcao, WebhookItem } from "@/components/admin/webhook-dialog";
import { Card, CardContent } from "@/components/ui/card";

type LinhaWebhook = {
  id: string;
  nome: string;
  url: string;
  bearer_token: string | null;
  eventos: string[] | null;
  cursos_ids: string[] | null;
  ativo: boolean;
  created_at: string;
};

export default async function WebhooksPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [metricas, { data: webhooksData, error }, { data: cursosData }] = await Promise.all([
    getMetricasWebhooks24h(supabase),
    supabase
      .from("webhooks_config")
      .select("id, nome, url, bearer_token, eventos, cursos_ids, ativo, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("cursos").select("id, nome").order("nome"),
  ]);

  // O token criptografado nunca sai do servidor: só um booleano "tem token".
  const webhooks: WebhookItem[] = ((webhooksData ?? []) as LinhaWebhook[]).map((linha) => ({
    id: linha.id,
    nome: linha.nome,
    url: linha.url,
    eventos: linha.eventos ?? [],
    cursos_ids: linha.cursos_ids ?? [],
    ativo: linha.ativo,
    temToken: !!linha.bearer_token,
    created_at: linha.created_at,
  }));
  const cursos = (cursosData ?? []) as CursoOpcao[];

  const cartoes = [
    { rotulo: "Enviados", valor: metricas.enviados, detalhe: metricas.pendentes > 0 ? `${metricas.pendentes} em andamento` : "últimas 24h" },
    { rotulo: "Entregues", valor: metricas.entregues, detalhe: percentual(metricas.entregues, metricas.enviados), cor: "text-green-600 dark:text-green-400" },
    { rotulo: "Falharam", valor: metricas.falharam, detalhe: percentual(metricas.falharam, metricas.enviados), cor: "text-red-600 dark:text-red-400" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/admin/configuracoes/apps" className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1 text-sm">
          <ArrowLeft className="size-3.5" />
          Apps
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Webhooks</h1>
          <p className="text-muted-foreground text-sm">
            Avise outros sistemas (CRM, automações, planilhas) quando algo acontece na escola.
          </p>
        </div>
      </div>

      {(metricas.erro || error) && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler as tabelas de webhooks (a migration <code>webhooks_saida</code> já foi aplicada?).
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cartoes.map((cartao) => (
          <Card key={cartao.rotulo}>
            <CardContent className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs font-medium uppercase">{cartao.rotulo}</span>
              <span className={`text-3xl font-semibold tabular-nums ${cartao.cor ?? ""}`}>{cartao.valor}</span>
              <span className="text-muted-foreground text-xs">{cartao.detalhe}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <WebhooksView webhooks={webhooks} cursos={cursos} />
    </div>
  );
}
