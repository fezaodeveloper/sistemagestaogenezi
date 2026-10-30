import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCampanhaPaginaPublica, contarRespostasAdmin } from "@/lib/campanha-paginas/campanha-paginas";
import { CampanhaPublicaView } from "@/components/campanha/campanha-publica-view";
import { getPixelsParaPagina } from "@/lib/pixels/injetar";
import { PixelsScripts } from "@/components/pixels/pixels-scripts";

// Página pública (sem login), acessível por qualquer visitante — sem
// requireRole. force-dynamic: status/vagas/período mudam a qualquer
// momento, não pode ser congelado como estática no build (mesmo motivo de
// /captacao e /agendar/[slug]).
export const dynamic = "force-dynamic";

// TAREFA campanha 2.5 (PARTE 4) — favicon dinâmico (logo da escola) + Open Graph (título,
// descrição, imagem) pra link bonito ao compartilhar no WhatsApp/Instagram. Página sem slug
// correspondente cai no not-found.tsx deste segmento (metadata genérica, sem consultar nada).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const admin = createAdminClient();
  const [pagina, { data: config }] = await Promise.all([
    getCampanhaPaginaPublica(admin, slug),
    admin.from("configuracoes").select("escola_nome, escola_logo_url").eq("id", true).maybeSingle(),
  ]);
  if (!pagina) return { title: "Página não encontrada" };

  const titulo = `${pagina.titulo} · ${config?.escola_nome ?? "Gênezi"}`;
  const descricao = pagina.subtitulo ?? pagina.descricao ?? "Preencha seus dados e garanta sua vaga.";
  const imagem = pagina.imagem_topo_url ?? pagina.logo_url ?? config?.escola_logo_url ?? undefined;

  return {
    title: titulo,
    description: descricao,
    icons: config?.escola_logo_url ? { icon: config.escola_logo_url } : undefined,
    openGraph: { title: titulo, description: descricao, images: imagem ? [imagem] : undefined },
  };
}

export default async function CampanhaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ utm_source?: string; utm_medium?: string; utm_campaign?: string }>;
}) {
  const { slug } = await params;
  // UTM (TAREFA CRM 2.2, PARTE 3) — lido aqui (Server Component) e passado como prop pro form
  // client incluir no FormData do envio, não um hook client-side de searchParams.
  const { utm_source, utm_medium, utm_campaign } = await searchParams;
  const utm = { source: utm_source ?? null, medium: utm_medium ?? null, campaign: utm_campaign ?? null };

  // client admin (service_role), não o client autenticado normal — ver
  // comentário em getCampanhaPaginaPublica (src/lib/campanha-paginas/campanha-paginas.ts)
  // sobre o erro "JWT failed verification" com cookie de sessão inválido no
  // navegador do visitante (admin/aluno/empresa logado antes no mesmo
  // navegador). Página pública nunca deve depender de sessão nenhuma.
  const admin = createAdminClient();
  const pagina = await getCampanhaPaginaPublica(admin, slug);
  if (!pagina) notFound();

  const encerrada = pagina.status === "encerrada" || !!(pagina.data_fim && new Date() > new Date(pagina.data_fim));

  const [totalRespostas, { data: config }] = await Promise.all([
    pagina.vagas_limite ? contarRespostasAdmin(admin, pagina.id) : Promise.resolve(0),
    admin.from("configuracoes").select("escola_telefone, escola_endereco").eq("id", true).maybeSingle(),
  ]);
  const vagasEsgotadas = !!pagina.vagas_limite && totalRespostas >= pagina.vagas_limite;

  const escuro = pagina.tema === "escuro";

  // Pixels de rastreamento (Apps > Pixels): os sem restrição de curso + os do curso da campanha.
  const pixels = await getPixelsParaPagina(pagina.curso_id);

  return (
    <main
      className="flex min-h-svh flex-col items-center p-6"
      style={{ backgroundColor: pagina.cor_fundo, color: escuro ? "#f8fafc" : "#0f172a" }}
    >
      <PixelsScripts pixels={pixels} />
      <div className="flex w-full max-w-lg flex-col gap-6 py-6">
        {/* Encerrada: a própria view mostra o banner vermelho "Inscrições
            encerradas!" no topo e bloqueia o formulário (o cabeçalho, com título e
            cards, continua visível). */}
        {encerrada ? (
          <CampanhaPublicaView
            pagina={pagina}
            encerrada
            utm={utm}
            escolaTelefone={config?.escola_telefone ?? null}
            escolaEndereco={config?.escola_endereco ?? null}
          />
        ) : vagasEsgotadas ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <p className="text-xl font-semibold">Vagas esgotadas</p>
            <p className="text-sm opacity-70">Todas as vagas dessa campanha já foram preenchidas.</p>
          </div>
        ) : (
          <CampanhaPublicaView
            pagina={pagina}
            utm={utm}
            escolaTelefone={config?.escola_telefone ?? null}
            escolaEndereco={config?.escola_endereco ?? null}
          />
        )}
      </div>
    </main>
  );
}
