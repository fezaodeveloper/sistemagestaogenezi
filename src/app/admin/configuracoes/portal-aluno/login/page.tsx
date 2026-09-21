import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { chaveCriptografiaConfigurada } from "@/lib/gateways/crypto";
import { COLUNAS_PORTAL_LOGIN, lerConfigSenhaPortal, paraPortalLoginConfig } from "@/lib/portal-login/config";
import { PORTAL_LOGIN_PADRAO } from "@/lib/portal-login/tipos";
import { PortalLoginEditor } from "@/components/admin/portal-login-editor";

export default async function PortalAlunoLoginPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [{ data, error }, senhaPortal] = await Promise.all([
    supabase.from("configuracoes").select(`escola_logo_url, login_rodape, ${COLUNAS_PORTAL_LOGIN}`).maybeSingle(),
    lerConfigSenhaPortal(),
  ]);

  const linha = (data ?? null) as
    | (Parameters<typeof paraPortalLoginConfig>[0] & { escola_logo_url?: string | null; login_rodape?: string | null })
    | null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Login</h2>
        <p className="text-muted-foreground text-sm">
          Aparência da tela de entrada dos alunos (<code>/entrar</code>) e a forma como eles acessam a conta.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler as configurações do login (a migration <code>portal_login_config</code> já foi aplicada?). Enquanto isso, a
          tela dos alunos segue como estava.
        </p>
      )}

      <PortalLoginEditor
        inicial={linha ? paraPortalLoginConfig(linha) : PORTAL_LOGIN_PADRAO}
        senhaPadraoInicial={senhaPortal.senhaPadrao ?? ""}
        logoUrl={linha?.escola_logo_url ?? null}
        nomeEscola={linha?.escola_nome?.trim() || "GÊNEZI Educação"}
        rodape={linha?.login_rodape ?? null}
        criptografiaConfigurada={chaveCriptografiaConfigurada()}
      />
    </div>
  );
}
