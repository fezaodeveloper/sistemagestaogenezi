import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getRankingGeral } from "@/lib/gamificacao/ranking";
import { getBadgesPublicosPorAluno } from "@/lib/gamificacao/badges";
import { isAvatarId } from "@/lib/avatares/catalog";
import { AlunoAvatar } from "@/components/gamificacao/aluno-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function RankingPage() {
  const user = await requireRole("aluno");

  const supabase = await createClient();
  const ranking = await getRankingGeral(supabase);
  const badgesPorAluno = await getBadgesPublicosPorAluno(
    supabase,
    ranking.map((r) => r.alunoId),
  );

  const minhaPosicao = ranking.findIndex((r) => r.alunoId === user.id);
  const meuTotal = minhaPosicao === -1 ? 0 : ranking[minhaPosicao].totalPontos;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ranking geral</h1>
        <p className="text-muted-foreground text-sm">
          Pontos por presença, aulas concluídas, quiz e prova — de todos os alunos da plataforma.
        </p>
      </div>

      <Card className="max-w-xs">
        <CardContent className="flex flex-col gap-1 py-4">
          <span className="text-muted-foreground text-sm">Seus pontos</span>
          <span className="text-2xl font-semibold">{meuTotal}</span>
          {minhaPosicao !== -1 && (
            <span className="text-muted-foreground text-xs">
              {minhaPosicao + 1}º lugar de {ranking.length}
            </span>
          )}
          <Link href="/aluno/perfil" className="text-primary text-xs hover:underline">
            Trocar avatar e ver conquistas
          </Link>
        </CardContent>
      </Card>

      {ranking.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Ninguém pontuou ainda. Conclua aulas e responda quiz/prova pra aparecer aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead className="text-right">Pontos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.map((entry, index) => {
                const souEu = entry.alunoId === user.id;
                const badges = badgesPorAluno.get(entry.alunoId) ?? [];
                return (
                  <TableRow key={entry.alunoId} className={souEu ? "bg-accent/50" : undefined}>
                    <TableCell className="font-medium">{index + 1}º</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <AlunoAvatar
                          avatarId={isAvatarId(entry.avatarId) ? entry.avatarId : "raposa"}
                          size="sm"
                        />
                        <span>{entry.fullName ?? "—"}</span>
                        {souEu && <Badge variant="secondary">Você</Badge>}
                        {badges.length > 0 && (
                          <span className="text-sm" title={badges.map((b) => b.nome).join(", ")}>
                            {badges.map((b) => b.icone).join(" ")}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">{entry.totalPontos}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
