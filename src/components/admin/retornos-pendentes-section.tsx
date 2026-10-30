"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RetornoPendente } from "@/lib/leads/leads";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function LeadPendenteCard({ lead }: { lead: RetornoPendente }) {
  const whatsappDigitos = (lead.whatsapp ?? lead.telefone).replace(/\D/g, "");

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium">{lead.nome}</span>
          <Badge variant="outline">{lead.colunaNome}</Badge>
        </div>
        <a
          href={`https://wa.me/55${whatsappDigitos}`}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground w-fit text-xs hover:underline"
        >
          📱 {lead.whatsapp ?? lead.telefone}
        </a>
        <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ {lead.motivo}</p>
      </CardContent>
    </Card>
  );
}

// TAREFA PARTE 4 — seção colapsável acima do Kanban, com badge vermelho de contagem. "Atender"
// abre a página de edição do lead (não o drawer do Kanban): getRetornosPendentes devolve só os
// campos leves necessários pro alerta (RetornoPendente), não o LeadComCurso completo que o
// drawer exige — duplicar aqui um segundo drawer só pra isso não compensava.
export function RetornosPendentesSection({ leads }: { leads: RetornoPendente[] }) {
  const [aberta, setAberta] = useState(true);

  if (leads.length === 0) return null;

  return (
    <div className="mb-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setAberta((atual) => !atual)}
        className="flex w-fit items-center gap-2 text-sm font-semibold"
      >
        <Badge className="bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400">{leads.length}</Badge>
        ⚠️ Retornos pendentes
        {aberta ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>

      {aberta && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {leads.map((lead) => (
            <div key={lead.id} className="flex flex-col gap-2">
              <LeadPendenteCard lead={lead} />
              <Button
                size="sm"
                variant="outline"
                nativeButton={false}
                render={<a href={`/admin/leads/${lead.id}/editar`} />}
              >
                Atender
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
