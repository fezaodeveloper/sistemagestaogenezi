import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EVENTO_TIPO_BADGE_CLASS, EVENTO_TIPO_LABELS, type EventoTipo } from "@/lib/calendario/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EventoProximo = { nome: string; tipo: EventoTipo; data_inicio: string; data_fim: string | null };

// Bolinha colorida por tipo, ao lado do nome do evento — mesma paleta de
// EVENTO_TIPO_BADGE_CLASS (src/lib/calendario/schema.ts), só que como
// indicador visual compacto em vez de badge.
const EVENTO_TIPO_DOT_CLASS: Record<EventoTipo, string> = {
  aula: "bg-blue-500",
  prova: "bg-amber-500",
  feriado: "bg-red-500",
  evento: "bg-green-500",
  outro: "bg-gray-500",
};

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// "Seg, 15/09" a partir de "yyyy-mm-dd" — monta a data com componentes
// locais explícitos (não `new Date(iso)` direto), mesmo motivo do padrão
// já usado em formatDataBR pelo resto do projeto: evita o desvio de fuso
// que `new Date("2026-09-15")` introduziria (interpretada como UTC
// meia-noite, podendo cair no dia anterior em fusos negativos).
function formatDataEvento(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia);
  return `${DIAS_SEMANA[data.getDay()]}, ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

export async function DashboardCalendario() {
  const supabase = await createClient();
  const hoje = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("eventos_calendario")
    .select("nome, tipo, data_inicio, data_fim")
    .gte("data_inicio", hoje)
    .order("data_inicio", { ascending: true })
    .limit(5);

  const eventos = (data as EventoProximo[] | null) ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>📅 Próximos eventos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {eventos.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum evento próximo</p>
        ) : (
          <div className="flex flex-col gap-3">
            {eventos.map((evento, indice) => (
              <div key={indice} className="flex items-center gap-3">
                <span className={`size-2.5 shrink-0 rounded-full ${EVENTO_TIPO_DOT_CLASS[evento.tipo]}`} />
                <span className="text-muted-foreground w-20 shrink-0 text-xs">
                  {formatDataEvento(evento.data_inicio)}
                </span>
                <span className="flex-1 truncate text-sm">{evento.nome}</span>
                <Badge className={EVENTO_TIPO_BADGE_CLASS[evento.tipo]}>{EVENTO_TIPO_LABELS[evento.tipo]}</Badge>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/admin/calendario"
          className="text-primary flex items-center gap-1 text-sm font-medium hover:underline"
        >
          Ver calendário completo
          <ArrowRight className="size-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}
