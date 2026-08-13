"use client";

import { useState, useTransition } from "react";
import { updateLeadStatus } from "@/app/admin/leads/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAD_STATUSES, LEAD_STATUSES_AUTOMATICOS, LEAD_STATUS_LABELS } from "@/lib/leads/schema";

export function LeadStatusCard({ leadId, status }: { leadId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(value: string | null) {
    if (!value) return;
    setError(null);
    startTransition(async () => {
      const result = await updateLeadStatus(leadId, value);
      if (result.error) setError(result.error);
    });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Status</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Select key={status} items={LEAD_STATUS_LABELS} defaultValue={status} onValueChange={handleChange} disabled={isPending}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
                {LEAD_STATUSES_AUTOMATICOS.includes(s) ? " (normalmente automático)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          aluno_ativo, ex_aluno e desistente costumam ser atualizados automaticamente quando o sistema
          detecta uma matrícula, conclusão ou cancelamento com o mesmo telefone e curso. Mudar aqui
          manualmente serve como correção pontual.
        </p>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
