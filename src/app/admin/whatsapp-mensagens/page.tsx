import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { calcularOffset, calcularTotalPaginas, parseLimite, parsePagina } from "@/lib/paginacao";
import { WhatsappMensagensView, type MensagemRecebidaView } from "@/components/admin/whatsapp-mensagens-view";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_VALIDOS = ["pendentes", "processadas"] as const;
type StatusFiltro = (typeof STATUS_VALIDOS)[number];

function parseStatus(valor: string | undefined): StatusFiltro | "" {
  return (STATUS_VALIDOS as readonly string[]).includes(valor ?? "") ? (valor as StatusFiltro) : "";
}

export default async function WhatsappMensagensPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; limit?: string; status?: string }>;
}) {
  await requireRole("admin");
  const { page, limit, status: statusParam } = await searchParams;
  const status = parseStatus(statusParam);

  const paginaAtual = parsePagina(page);
  const limite = parseLimite(limit);
  const offset = calcularOffset(paginaAtual, limite);

  const supabase = await createClient();
  let query = supabase
    .from("whatsapp_mensagens_recebidas")
    .select("id, telefone, nome_contato, mensagem, tipo, processado, created_at", { count: "exact" })
    .order("created_at", { ascending: false });

  if (status === "pendentes") query = query.eq("processado", false);
  if (status === "processadas") query = query.eq("processado", true);

  const { data, error, count } = await query.range(offset, offset + limite - 1);

  const mensagens = (data ?? []) as MensagemRecebidaView[];
  const totalRegistros = count ?? 0;
  const totalPaginas = calcularTotalPaginas(totalRegistros, limite);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">WhatsApp — Mensagens recebidas</h1>
        <p className="text-muted-foreground text-sm">
          Log de mensagens recebidas pelo número conectado do GênZap.
        </p>
      </div>

      {error ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as mensagens (a migration <code>whatsapp_webhook_entrada</code> já foi aplicada?).
          </CardContent>
        </Card>
      ) : totalRegistros === 0 && !status ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhuma mensagem recebida ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="p-4">
          <WhatsappMensagensView
            mensagens={mensagens}
            totalRegistros={totalRegistros}
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            limite={limite}
            statusFiltro={status}
          />
        </Card>
      )}
    </div>
  );
}
