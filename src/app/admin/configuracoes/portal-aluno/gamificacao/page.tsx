import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isConquistaGatilho, type ConquistaAdminView } from "@/lib/conquistas/tipos";
import { ConquistasAdminLista } from "@/components/admin/conquistas-admin-lista";
import { ConquistasConfigForm } from "@/components/admin/conquistas-config-form";

type LinhaConquista = {
  id: string;
  titulo: string;
  descricao: string | null;
  gatilho: string;
  gatilho_valor: number | null;
  badge_url: string | null;
  badge_emoji: string | null;
  ativo: boolean;
  ordem: number;
};

export default async function PortalAlunoGamificacaoPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const [configResult, conquistasResult] = await Promise.all([
    supabase.from("configuracoes").select("portal_conquistas_ativo").eq("id", true).maybeSingle(),
    supabase
      .from("conquistas")
      .select("id, titulo, descricao, gatilho, gatilho_valor, badge_url, badge_emoji, ativo, ordem")
      .order("ordem")
      .order("created_at"),
  ]);

  const migrationPendente = !!configResult.error || !!conquistasResult.error;
  const linhas = (conquistasResult.data ?? []) as LinhaConquista[];

  // Quantos alunos desbloquearam cada conquista (uma contagem por conquista: o catálogo é
  // pequeno e a alternativa — agrupar linhas no servidor — bateria no teto de 1000 do PostgREST).
  const totais = await Promise.all(
    linhas.map(async (l) => {
      const { count } = await supabase
        .from("aluno_conquistas")
        .select("id", { count: "exact", head: true })
        .eq("conquista_id", l.id);
      return [l.id, count ?? 0] as const;
    }),
  );
  const desbloqueios = new Map(totais);

  const conquistas: ConquistaAdminView[] = linhas
    .filter((l) => isConquistaGatilho(l.gatilho))
    .map((l) => ({
      id: l.id,
      titulo: l.titulo,
      descricao: l.descricao,
      gatilho: l.gatilho as ConquistaAdminView["gatilho"],
      gatilhoValor: l.gatilho_valor,
      badgeUrl: l.badge_url,
      badgeEmoji: l.badge_emoji,
      ativo: l.ativo,
      ordem: l.ordem,
      totalDesbloqueios: desbloqueios.get(l.id) ?? 0,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Gamificação</h2>
        <p className="text-muted-foreground text-sm">
          Conquistas personalizadas que os alunos desbloqueiam sozinhos. Elas são independentes das medalhas do ranking e
          convivem com elas.
        </p>
      </div>

      {migrationPendente && (
        <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          Não foi possível ler as conquistas (a migration <code>conquistas_personalizadas</code> já foi aplicada?).
        </p>
      )}

      <ConquistasConfigForm ativoInicial={configResult.data?.portal_conquistas_ativo === true} />

      <ConquistasAdminLista key={JSON.stringify(conquistas)} conquistas={conquistas} />
    </div>
  );
}
