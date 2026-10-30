import { notFound } from "next/navigation";
import { getAgendamentoComPaginaPublico } from "@/lib/agendamentos/agendamentos";
import { AgendarTema } from "@/components/agendamentos/agendar-tema";
import { MeuAgendamentoView } from "@/components/agendamentos/meu-agendamento-view";

// Página pública (sem login) — o UUID na URL funciona como token de acesso (ver
// getAgendamentoComPaginaPublico). force-dynamic: status/disponibilidade mudam a qualquer
// momento.
export const dynamic = "force-dynamic";

export default async function MeuAgendamentoPage({
  params,
}: {
  params: Promise<{ slug: string; agendamentoId: string }>;
}) {
  const { slug, agendamentoId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(agendamentoId)) notFound();

  const encontrado = await getAgendamentoComPaginaPublico(agendamentoId, slug);
  if (!encontrado) notFound();

  return (
    <AgendarTema>
      <div className="flex w-full max-w-lg flex-col gap-6 py-6">
        <MeuAgendamentoView agendamento={encontrado.agendamento} pagina={encontrado.pagina} />
      </div>
    </AgendarTema>
  );
}
