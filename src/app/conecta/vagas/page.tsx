import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCidadesAprovadas, getVagasPublicasConecta } from "@/lib/conecta/publico";
import { VAGA_MODALIDADES, VAGA_TIPOS, type VagaModalidade, type VagaTipo } from "@/lib/conecta/schema";
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

const LIMITE = 12;

function paramValido<T extends string>(valores: readonly T[], valor: string | undefined): T | undefined {
  return valores.includes(valor as T) ? (valor as T) : undefined;
}

// Pública de propósito, sem requireRole (REGRA da tarefa — SEO e
// compartilhamento). Dados de vagas via getVagasPublicasConecta
// (service_role, ver src/lib/conecta/publico.ts); logo da escola via client
// autenticado normal mesmo sem sessão — "anon" já tem grant de select
// (escola_logo_url, login_rodape) em configuracoes desde
// 20260916100000_banners_tamanho_texto.sql (mesmo usado em /entrar).
export default async function ConectaVagasPublicasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tipo?: string; modalidade?: string; cidade?: string; page?: string }>;
}) {
  const params = await searchParams;
  const paginaAtual = Number(params.page) > 0 ? Number(params.page) : 1;

  const tipo = paramValido<VagaTipo>(VAGA_TIPOS, params.tipo);
  const modalidade = paramValido<VagaModalidade>(VAGA_MODALIDADES, params.modalidade);

  const [supabase, resultado, cidadesAprovadas] = await Promise.all([
    createClient(),
    getVagasPublicasConecta({
      query: params.q,
      tipo,
      modalidade,
      cidade: params.cidade,
      page: paginaAtual,
      limit: LIMITE,
    }),
    getCidadesAprovadas(),
  ]);

  const { data: configuracoes } = await supabase
    .from("configuracoes")
    .select("escola_logo_url")
    .eq("id", true)
    .maybeSingle();

  // Botões "Para empresas" → WhatsApp (TAREFA 3, cadastro via escola) — mesmo padrão já usado
  // em src/app/conecta/aguardando-pagamento/page.tsx: não existe uma coluna "escola_whatsapp"
  // dedicada nem uma env var NEXT_PUBLIC_WHATSAPP_ESCOLA no projeto, então reaproveita
  // escola_telefone. O grant de select em configuracoes pra "anon" só libera escola_logo_url/
  // login_rodape, por isso o client admin aqui.
  const admin = createAdminClient();
  const { data: configuracoesWhatsapp } = await admin
    .from("configuracoes")
    .select("escola_telefone")
    .eq("id", true)
    .maybeSingle();
  const whatsappEscolaDigitos = configuracoesWhatsapp?.escola_telefone?.replace(/\D/g, "") ?? null;

  const totalPaginas = Math.max(1, Math.ceil(resultado.total / LIMITE));

  return (
    <ConectaVagasPublicasView
      logoUrl={configuracoes?.escola_logo_url ?? null}
      whatsappEscolaDigitos={whatsappEscolaDigitos}
      vagas={resultado.vagas}
      totalRegistros={resultado.total}
      paginaAtual={paginaAtual}
      totalPaginas={totalPaginas}
      limite={LIMITE}
      cidadesAprovadas={cidadesAprovadas}
      filtrosAtuais={{
        q: params.q ?? "",
        tipo: tipo ?? "",
        modalidade: modalidade ?? "",
        cidade: params.cidade ?? "",
      }}
    />
  );
}
