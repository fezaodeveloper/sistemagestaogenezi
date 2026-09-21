import { Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { exigirConquistasAtivo } from "@/lib/conquistas/config";
import { verificarConquistasPersonalizadas } from "@/lib/conquistas/verificar";
import {
  descreverGatilho,
  isConquistaGatilho,
  type ConquistaAlunoView,
} from "@/lib/conquistas/tipos";
import { ConquistasGrid } from "@/components/aluno/conquistas-grid";
import { Card, CardContent } from "@/components/ui/card";

type LinhaConquista = {
  id: string;
  titulo: string;
  descricao: string | null;
  gatilho: string;
  gatilho_valor: number | null;
  badge_url: string | null;
  badge_emoji: string | null;
  ordem: number;
  created_at: string;
};

export default async function ConquistasPage() {
  const user = await requireRole("aluno");
  const supabase = await createClient();
  await exigirConquistasAtivo(supabase);

  // Desbloqueia antes de listar: o que o aluno já merece (inclusive conquistas criadas depois)
  // aparece colorido nesta mesma carga. Nunca lança.
  await verificarConquistasPersonalizadas(user.id);

  const [{ data: catalogo, error: erroCatalogo }, { data: desbloqueios, error: erroDesbloqueios }] = await Promise.all([
    supabase
      .from("conquistas")
      .select("id, titulo, descricao, gatilho, gatilho_valor, badge_url, badge_emoji, ordem, created_at")
      .eq("ativo", true)
      .order("ordem")
      .order("created_at"),
    supabase.from("aluno_conquistas").select("conquista_id, desbloqueada_em").eq("aluno_id", user.id),
  ]);

  const erro = !!erroCatalogo || !!erroDesbloqueios;
  const quando = new Map(
    ((desbloqueios ?? []) as { conquista_id: string; desbloqueada_em: string }[]).map((d) => [d.conquista_id, d.desbloqueada_em]),
  );

  const todas: ConquistaAlunoView[] = ((catalogo ?? []) as LinhaConquista[]).map((c) => ({
    id: c.id,
    titulo: c.titulo,
    descricao: c.descricao,
    comoDesbloquear: isConquistaGatilho(c.gatilho) ? descreverGatilho(c.gatilho, c.gatilho_valor) : "",
    badgeUrl: c.badge_url,
    badgeEmoji: c.badge_emoji,
    desbloqueadaEm: quando.get(c.id) ?? null,
  }));

  // Desbloqueadas primeiro, depois as bloqueadas; dentro de cada grupo, a ordem do cadastro
  // (o array já vem por ordem/created_at e o sort é estável).
  const conquistas = [...todas].sort((a, b) => Number(!!b.desbloqueadaEm) - Number(!!a.desbloqueadaEm));
  const total = conquistas.length;
  const desbloqueadas = conquistas.filter((c) => c.desbloqueadaEm).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Conquistas</h1>
          <p className="text-muted-foreground text-sm">Desbloqueie conquistas conforme avança nos estudos.</p>
        </div>
        {!erro && total > 0 && (
          <div className="flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-1.5 text-sm font-medium">
            <Trophy className="size-4 text-amber-500" />
            {desbloqueadas} de {total} {total === 1 ? "conquista" : "conquistas"}
          </div>
        )}
      </div>

      {erro ? (
        <Card>
          <CardContent className="text-destructive py-10 text-center text-sm">
            Não foi possível carregar as conquistas. Tente recarregar a página.
          </CardContent>
        </Card>
      ) : total === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma conquista disponível ainda. Em breve você poderá desbloquear novas conquistas aqui.
          </CardContent>
        </Card>
      ) : (
        <ConquistasGrid conquistas={conquistas} />
      )}
    </div>
  );
}
