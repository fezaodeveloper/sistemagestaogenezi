import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCatalogoBadges, getMeusBadges } from "@/lib/gamificacao/badges";
import { getStreakAluno } from "@/lib/gamificacao/streak";
import { alunoTemCursoPresencialOuHibrido } from "@/lib/matriculas/access";
import { isAvatarId } from "@/lib/avatares/catalog";
import { AvatarPicker } from "@/components/aluno/avatar-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function PerfilPage() {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const [catalogoBadges, meusBadges, temPresencialOuHibrido] = await Promise.all([
    getCatalogoBadges(supabase),
    getMeusBadges(supabase, user.id),
    alunoTemCursoPresencialOuHibrido(supabase, user.id),
  ]);

  const streak = temPresencialOuHibrido ? await getStreakAluno(supabase, user.id) : null;
  const badgesConquistadosIds = new Set(meusBadges.map((b) => b.badgeId));
  const avatarAtual = isAvatarId(user.avatar_id) ? user.avatar_id : "raposa";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm">
          Escolha seu avatar e acompanhe suas conquistas.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Avatar</CardTitle>
        </CardHeader>
        <CardContent>
          <AvatarPicker avatarIdInicial={avatarAtual} />
        </CardContent>
      </Card>

      {streak !== null && (
        <Card className="max-w-xs">
          <CardHeader>
            <CardTitle>Sua sequência</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <span className="text-2xl font-semibold">
              {streak} {streak === 1 ? "sessão" : "sessões"}
            </span>
            <span className="text-muted-foreground text-xs">
              Chamadas consecutivas sem falta. Uma falta sem justificativa zera a sequência.
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Minhas Conquistas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {catalogoBadges.map((badge) => {
              const conquistado = badgesConquistadosIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    conquistado ? "border-primary/50 bg-primary/5" : "opacity-50",
                  )}
                >
                  <span className="text-2xl">{badge.icone}</span>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{badge.nome}</span>
                    <span className="text-muted-foreground text-xs">{badge.descricao}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
