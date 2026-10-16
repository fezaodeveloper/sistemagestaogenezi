import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isFluxoGatilho } from "@/lib/whatsapp/fluxos-tipos";
import { contarExecucoes } from "@/app/admin/whatsapp-fluxos/actions";
import { WhatsappFluxoCard, type FluxoCardView } from "@/components/admin/whatsapp-fluxo-card";
import { WhatsappFluxoNovoDialog } from "@/components/admin/whatsapp-fluxo-novo-dialog";
import { Card, CardContent } from "@/components/ui/card";

type LinhaFluxo = { id: string; nome: string; descricao: string | null; gatilho: string; ativo: boolean };

export default async function WhatsappFluxosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_fluxos")
    .select("id, nome, descricao, gatilho, ativo")
    .order("created_at", { ascending: false });

  const linhas = ((data ?? []) as LinhaFluxo[]).filter((f) => isFluxoGatilho(f.gatilho));

  // Contagem de execuções por status, por fluxo — poucos fluxos esperados, 4 queries count-only
  // por linha é aceitável (mesmo critério já usado em outras listagens admin do projeto, ex.:
  // conquistas; antes era 1 query por linha, sem quebra por status — ver contarExecucoes).
  const contagens = await Promise.all(
    linhas.map(async (f) => {
      const resultado = await contarExecucoes(f.id);
      return [f.id, "error" in resultado ? { em_andamento: 0, concluido: 0, erro: 0, cancelado: 0 } : resultado] as const;
    }),
  );
  const contagensPorFluxo = new Map(contagens);

  const fluxos: FluxoCardView[] = linhas.map((f) => {
    const porStatus = contagensPorFluxo.get(f.id) ?? { em_andamento: 0, concluido: 0, erro: 0, cancelado: 0 };
    return {
      id: f.id,
      nome: f.nome,
      descricao: f.descricao,
      gatilho: f.gatilho as FluxoCardView["gatilho"],
      ativo: f.ativo,
      totalExecucoes: porStatus.em_andamento + porStatus.concluido + porStatus.erro + porStatus.cancelado,
      execucoesPorStatus: porStatus,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">GênZap — Fluxos de WhatsApp</h1>
          <p className="text-muted-foreground text-sm">
            Sequências de mensagens personalizadas, adicionais aos envios automáticos de Configurações &gt; WhatsApp.
          </p>
        </div>
        <WhatsappFluxoNovoDialog />
      </div>

      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler os fluxos (a migration <code>whatsapp_fluxos</code> já foi aplicada?).
        </p>
      )}

      {!error && fluxos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-muted-foreground text-sm">Nenhum fluxo criado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fluxos.map((f) => (
            <WhatsappFluxoCard key={f.id} fluxo={f} />
          ))}
        </div>
      )}
    </div>
  );
}
