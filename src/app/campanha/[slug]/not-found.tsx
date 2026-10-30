import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";

// TAREFA campanha 2.5 (PARTE 4) — substitui a página 404 genérica do Next quando o slug não
// existe ou a página está inativa (notFound() em page.tsx cai aqui, pelo segmento [slug]).
export default async function CampanhaNotFound() {
  const admin = createAdminClient();
  const { data: config } = await admin.from("configuracoes").select("escola_nome, escola_logo_url, escola_site").eq("id", true).maybeSingle();

  const urlSite = config?.escola_site ? (config.escola_site.startsWith("http") ? config.escola_site : `https://${config.escola_site}`) : "/";

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-center text-white">
      {config?.escola_logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo vem do Storage do próprio projeto
        <img src={config.escola_logo_url} alt={config?.escola_nome ?? "Gênezi"} className="h-12 object-contain" />
      ) : (
        <p className="text-lg font-semibold">{config?.escola_nome ?? "Gênezi — Educação Profissional"}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="text-2xl font-bold">Página não encontrada</p>
        <p className="text-sm text-white/70">Essa campanha não existe mais ou o link está incorreto.</p>
      </div>
      <Link href={urlSite} className="rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20">
        Voltar ao site principal
      </Link>
    </main>
  );
}
