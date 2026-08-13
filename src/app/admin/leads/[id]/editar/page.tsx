import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getLead } from "@/lib/leads/leads";
import { LeadForm } from "@/components/admin/lead-form";
import { updateLead } from "@/app/admin/leads/actions";
import { LeadStatusCard } from "@/components/admin/lead-status-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MENSAGEM_STATUS_LABELS, MENSAGEM_TIPO_LABELS } from "@/lib/mensagens/schema";
import type { MensagemStatus, MensagemTipo } from "@/lib/mensagens/schema";

function formatDateTimeBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

type MensagemDoLead = {
  id: string;
  tipo: MensagemTipo;
  status: MensagemStatus;
  erro_detalhe: string | null;
  created_at: string;
};

export default async function EditarLeadPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const [lead, { data: cursos }, { data: mensagens }] = await Promise.all([
    getLead(supabase, id),
    supabase.from("cursos").select("id, nome").eq("status", "ativo").order("nome"),
    supabase
      .from("mensagens_enviadas")
      .select("id, tipo, status, erro_detalhe, created_at")
      .eq("lead_id", id)
      .order("created_at", { ascending: false }) as unknown as Promise<{ data: MensagemDoLead[] | null }>,
  ]);

  if (!lead) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar lead</h1>
        <p className="text-muted-foreground text-sm">{lead.nome}</p>
      </div>

      <LeadStatusCard leadId={lead.id} status={lead.status} />

      <LeadForm
        action={updateLead.bind(null, lead.id)}
        cursos={cursos ?? []}
        submitLabel="Salvar alterações"
        defaultValues={{
          nome: lead.nome,
          telefone: lead.telefone,
          curso_id: lead.curso_id,
          origem: lead.origem,
          observacoes: lead.observacoes ?? undefined,
        }}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Histórico de mensagens</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {!mensagens || mensagens.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma mensagem enviada pra este lead ainda.</p>
          ) : (
            mensagens.map((m) => (
              <div key={m.id} className="flex flex-col gap-1 border-b pb-2 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{MENSAGEM_TIPO_LABELS[m.tipo]}</span>
                  <Badge variant={m.status === "falha" ? "destructive" : "secondary"}>
                    {MENSAGEM_STATUS_LABELS[m.status]}
                  </Badge>
                </div>
                <span className="text-muted-foreground text-xs">{formatDateTimeBR(m.created_at)}</span>
                {m.erro_detalhe && <span className="text-destructive text-xs">{m.erro_detalhe}</span>}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
