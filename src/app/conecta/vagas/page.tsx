import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCidadesComContagemVagas } from "@/lib/conecta/publico";
import { ConectaVagasPublicasView } from "@/components/conecta/vagas-publicas-view";

export const metadata: Metadata = {
  title: "Gênezi Conecta — Vagas de Emprego em Propriá/SE",
  description:
    "Portal de empregos e estágios para a região de Propriá, Porto Real do Colégio e região. Encontre sua oportunidade!",
  openGraph: {
    title: "Gênezi Conecta — Vagas de Emprego",
    description: "Vagas de emprego e estágio em Propriá/SE",
    type: "website",
  },
};

// force-dynamic: sem isso, sem nenhuma API dinâmica (nem searchParams, que a versão anterior
// desta página usava) o Next prerenderia a página no build e congelaria a contagem de vagas por
// cidade até o próximo deploy — precisa ser recalculada a cada request.
export const dynamic = "force-dynamic";

// Pública de propósito, sem requireRole (REGRA da tarefa — SEO e compartilhamento). Cidades +
// contagem de vagas via service_role (getCidadesComContagemVagas, client admin): o grant de
// select em configuracoes pra "anon"/"authenticated" só libera escola_logo_url/login_rodape
// (ver 20260916100000_banners_tamanho_texto.sql), não escola_telefone — busca os dois campos
// com o mesmo client admin numa única query, em vez de dois clients diferentes como antes.
export default async function ConectaVagasPublicasPage() {
  const admin = createAdminClient();

  const [cidades, { data: configuracoes }] = await Promise.all([
    getCidadesComContagemVagas(),
    admin.from("configuracoes").select("escola_logo_url, escola_telefone").eq("id", true).maybeSingle(),
  ]);

  const whatsappEscolaDigitos = configuracoes?.escola_telefone?.replace(/\D/g, "") ?? null;

  return (
    <ConectaVagasPublicasView
      logoUrl={configuracoes?.escola_logo_url ?? null}
      cidades={cidades}
      whatsappEscolaDigitos={whatsappEscolaDigitos}
    />
  );
}
