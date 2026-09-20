import Link from "next/link";
import { BarChart3, FileText, MessageSquareText, Webhook, type LucideIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMetricasWebhooks24h } from "@/lib/webhooks/metricas";
import { INTEGRAX_CONFIG_ID } from "@/lib/integrax/config";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type App = {
  nome: string;
  descricao: string;
  icone: LucideIcon;
  cor: string;
  href?: string;
};

// Integrações da escola. As sem `href` ainda não existem: aparecem como "Em breve".
const APPS: App[] = [
  {
    nome: "Webhooks",
    descricao: "Envie eventos da escola (matrícula, pagamento, lead...) para outros sistemas em tempo real.",
    icone: Webhook,
    cor: "#7C3AED",
    href: "/admin/configuracoes/apps/webhooks",
  },
  {
    nome: "IntegraX SMS",
    descricao: "Envio de SMS para lembretes de aula, cobranças e avisos aos alunos.",
    icone: MessageSquareText,
    cor: "#0EA5E9",
    href: "/admin/configuracoes/apps/integrax",
  },
  {
    nome: "Spedy NF-e",
    descricao: "Emissão automática de notas fiscais eletrônicas a partir dos pagamentos.",
    icone: FileText,
    cor: "#16A34A",
  },
  {
    nome: "Pixels e Rastreamento",
    descricao: "Meta Pixel, Google Analytics e outros pixels nas páginas públicas.",
    icone: BarChart3,
    cor: "#F97316",
    href: "/admin/configuracoes/apps/pixels",
  },
];

export default async function AppsPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [metricas, { data: sms }, pixelsAtivos] = await Promise.all([
    getMetricasWebhooks24h(supabase),
    supabase.from("integracoes_sms_config").select("token, ativo").eq("id", INTEGRAX_CONFIG_ID).maybeSingle(),
    supabase.from("pixels_config").select("id", { count: "exact", head: true }).eq("ativo", true),
  ]);

  // Status real dos pixels: quantos estão ativos (tabela ausente = 0).
  const totalPixels = pixelsAtivos.error ? 0 : (pixelsAtivos.count ?? 0);
  const statusPixels =
    totalPixels > 0
      ? { texto: `${totalPixels} pixel${totalPixels > 1 ? "s" : ""} ativo${totalPixels > 1 ? "s" : ""}`, classe: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400" }
      : { texto: "Nenhum pixel ativo", classe: "bg-muted text-muted-foreground" };

  // Status real da IntegraX: ativo (token + ligada), configurado mas desligado, ou sem token.
  const statusSms = sms?.token
    ? sms.ativo
      ? { texto: "Ativo", classe: "bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400" }
      : { texto: "Configurado (inativo)", classe: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" }
    : { texto: "Não configurado", classe: "bg-muted text-muted-foreground" };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Apps</h1>
        <p className="text-muted-foreground text-sm">Integrações da plataforma com outros serviços.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {APPS.map((app) => {
          const Icone = app.icone;
          const conteudo = (
            <Card className={`h-full transition-colors ${app.href ? "group-hover:border-primary/50" : "opacity-70"}`}>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: app.cor }}
                  >
                    <Icone className="size-5" />
                  </span>
                  {!app.href && <Badge variant="secondary">Em breve</Badge>}
                  {app.nome === "IntegraX SMS" && <Badge className={statusSms.classe}>{statusSms.texto}</Badge>}
                  {app.nome === "Pixels e Rastreamento" && <Badge className={statusPixels.classe}>{statusPixels.texto}</Badge>}
                </div>
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{app.nome}</p>
                  <p className="text-muted-foreground text-sm">{app.descricao}</p>
                </div>

                {app.nome === "Webhooks" && (
                  <div className="mt-auto flex flex-col gap-1 border-t pt-3">
                    <span className="text-muted-foreground text-xs">Últimas 24h</span>
                    {metricas.erro ? (
                      <span className="text-muted-foreground text-xs">Métricas indisponíveis.</span>
                    ) : (
                      <div className="flex gap-4 text-sm tabular-nums">
                        <span>
                          <strong>{metricas.enviados}</strong> enviados
                        </span>
                        <span className="text-green-600 dark:text-green-400">
                          <strong>{metricas.entregues}</strong> entregues
                        </span>
                        <span className="text-red-600 dark:text-red-400">
                          <strong>{metricas.falharam}</strong> falharam
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );

          return app.href ? (
            <Link key={app.nome} href={app.href} className="group" aria-label={`Abrir ${app.nome}`}>
              {conteudo}
            </Link>
          ) : (
            <div key={app.nome} aria-disabled>
              {conteudo}
            </div>
          );
        })}
      </div>
    </div>
  );
}
