import { requireRole } from "@/lib/auth/dal";
import { getEventos } from "@/app/admin/calendario/actions";
import { CalendarioView } from "@/components/admin/calendario-view";

export default async function CalendarioPage() {
  await requireRole("admin");

  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth() + 1;

  const eventos = await getEventos(ano, mes);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Calendário Acadêmico</h1>
        <p className="text-muted-foreground text-sm">
          Aulas, provas, eventos e feriados do ano letivo.
        </p>
      </div>
      <CalendarioView eventosIniciais={eventos} anoInicial={ano} mesInicial={mes} />
    </div>
  );
}
