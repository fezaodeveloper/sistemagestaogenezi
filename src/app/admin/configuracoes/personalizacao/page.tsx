import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CAMPOS_IMAGEM, type CampoImagem } from "@/lib/personalizacao/campos";
import { PersonalizacaoForm, type PersonalizacaoInicial } from "@/components/admin/personalizacao-form";

const NOME_PADRAO = "GÊNEZI Educação Profissional";

const CAMPOS = Object.keys(CAMPOS_IMAGEM) as CampoImagem[];

export default async function PersonalizacaoPage() {
  await requireRole("admin");

  const supabase = await createClient();

  // Consulta completa; se alguma coluna nova ainda não existe (migrations pendentes) o PostgREST
  // recusa a consulta inteira — cai para as colunas que já existiam antes, sem quebrar a tela.
  const colunas = ["escola_nome", "escola_cor_primaria", "escola_cor_pwa", ...CAMPOS].join(", ");
  const completa = await supabase.from("configuracoes").select(colunas).eq("id", true).maybeSingle();

  let linha = (completa.data ?? null) as Record<string, string | null> | null;
  const migracaoPendente = !!completa.error;
  if (migracaoPendente) {
    const basica = await supabase.from("configuracoes").select("escola_nome, escola_logo_url").eq("id", true).maybeSingle();
    linha = (basica.data ?? null) as Record<string, string | null> | null;
  }

  const imagens = Object.fromEntries(CAMPOS.map((campo) => [campo, linha?.[campo] ?? null])) as Record<CampoImagem, string | null>;

  const inicial: PersonalizacaoInicial = {
    nome: linha?.escola_nome?.trim() || NOME_PADRAO,
    corPrimaria: linha?.escola_cor_primaria ?? "",
    corPwa: linha?.escola_cor_pwa ?? "",
    imagens,
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Personalização</h1>
        <p className="text-muted-foreground text-sm">Identidade visual do sistema: nome, cores, logos, favicon e app instalável (PWA).</p>
      </div>

      {migracaoPendente && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Alguns campos ainda não existem no banco (a migration <code>personalizacao_visual</code>
          {" "}e a <code>portal_login_config</code> já foram aplicadas?). Salvar pode falhar até isso ser feito.
        </p>
      )}

      <PersonalizacaoForm inicial={inicial} />
    </div>
  );
}
