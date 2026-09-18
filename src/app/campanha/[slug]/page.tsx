import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCampanhaPaginaPublica, contarRespostasAdmin } from "@/lib/campanha-paginas/campanha-paginas";
import { CampanhaPublicaView } from "@/components/campanha/campanha-publica-view";

// Página pública (sem login), acessível por qualquer visitante — sem
// requireRole. force-dynamic: status/vagas/período mudam a qualquer
// momento, não pode ser congelado como estática no build (mesmo motivo de
// /captacao e /agendar/[slug]).
export const dynamic = "force-dynamic";

export default async function CampanhaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // client admin (service_role), não o client autenticado normal — ver
  // comentário em getCampanhaPaginaPublica (src/lib/campanha-paginas/campanha-paginas.ts)
  // sobre o erro "JWT failed verification" com cookie de sessão inválido no
  // navegador do visitante (admin/aluno/empresa logado antes no mesmo
  // navegador). Página pública nunca deve depender de sessão nenhuma.
  const admin = createAdminClient();
  const pagina = await getCampanhaPaginaPublica(admin, slug);
  if (!pagina) notFound();

  const encerrada = pagina.status === "encerrada" || (pagina.data_fim && new Date() > new Date(pagina.data_fim));

  const totalRespostas = pagina.vagas_limite ? await contarRespostasAdmin(admin, pagina.id) : 0;
  const vagasEsgotadas = !!pagina.vagas_limite && totalRespostas >= pagina.vagas_limite;

  const escuro = pagina.tema === "escuro";

  return (
    <main
      className="flex min-h-svh flex-col items-center p-6"
      style={{ backgroundColor: pagina.cor_fundo, color: escuro ? "#f8fafc" : "#0f172a" }}
    >
      <div className="flex w-full max-w-lg flex-col gap-6 py-6">
        {encerrada ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <p className="text-xl font-semibold">Inscrições encerradas</p>
            <p className="text-sm opacity-70">Essa campanha não está mais recebendo inscrições.</p>
          </div>
        ) : vagasEsgotadas ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <p className="text-xl font-semibold">Vagas esgotadas</p>
            <p className="text-sm opacity-70">Todas as vagas dessa campanha já foram preenchidas.</p>
          </div>
        ) : (
          <CampanhaPublicaView pagina={pagina} />
        )}
      </div>
    </main>
  );
}
