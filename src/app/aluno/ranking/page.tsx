import Link from "next/link";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getRankingGeral } from "@/lib/gamificacao/ranking";
import { getBadgesPublicosPorAluno, getCatalogoBadges, getMeusBadges } from "@/lib/gamificacao/badges";
import {
  FREQUENCIA_NIVEIS,
  getProgressoBadgesProgressivos,
  MODULOS_NIVEIS,
  OFENSIVA_NIVEIS,
  PONTOS_NIVEIS,
  QUIZ_NIVEIS,
  type NivelBadge,
} from "@/lib/gamificacao/badges-progressivos";
import { isAvatarId } from "@/lib/avatares/catalog";
import { getRecursosHabilitadosAluno } from "@/lib/configuracoes/recursos";
import { cn } from "@/lib/utils";
import { AlunoAvatar } from "@/components/gamificacao/aluno-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CategoriaProgressiva = { chave: string; titulo: string; niveis: NivelBadge[]; valor: number };

// "21/08/2026" — mesmo padrão de data usado em outras telas (ver
// termos-view.tsx, contratos-view.tsx).
function formatDataConquista(isoString: string): string {
  return new Date(isoString).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export default async function RankingPage() {
  const user = await requireRole("aluno");

  const recursos = await getRecursosHabilitadosAluno(user.id);
  if (!recursos.ranking) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold">Ranking geral</h1>
        </div>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground text-sm">
              Ranking não disponível para seu tipo de curso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const ranking = await getRankingGeral(supabase);
  const badgesPorAluno = await getBadgesPublicosPorAluno(
    supabase,
    ranking.map((r) => r.alunoId),
  );

  const minhaPosicao = ranking.findIndex((r) => r.alunoId === user.id);
  const meuTotal = minhaPosicao === -1 ? 0 : ranking[minhaPosicao].totalPontos;

  // Ofensiva: entre todas as matrículas do aluno, a de maior ofensiva ATUAL
  // ativa agora — best-effort (nunca calculada ainda = sem linha em
  // `ofensivas`, mostra 0 normalmente).
  const { data: ofensivaData } = await supabase
    .from("ofensivas")
    .select("ofensiva_atual, ofensiva_maxima")
    .eq("aluno_id", user.id)
    .order("ofensiva_atual", { ascending: false })
    .limit(1)
    .maybeSingle();
  const ofensivaAtual = (ofensivaData?.ofensiva_atual as number | undefined) ?? 0;

  const [catalogoBadges, meusBadges, progresso] = await Promise.all([
    getCatalogoBadges(supabase),
    getMeusBadges(supabase, user.id),
    getProgressoBadgesProgressivos(user.id),
  ]);

  const catalogoPorId = new Map(catalogoBadges.map((b) => [b.id, b]));
  const conquistadosSet = new Set(meusBadges.map((b) => b.badgeId));
  const conquistadoEmPorId = new Map(meusBadges.map((b) => [b.badgeId, b.conquistadoEm]));

  const proximoMarcoOfensiva = OFENSIVA_NIVEIS.find((nivel) => ofensivaAtual < nivel.limiar);
  const marcoMaximoOfensiva = OFENSIVA_NIVEIS[OFENSIVA_NIVEIS.length - 1].limiar;

  const categoriasProgressivas: CategoriaProgressiva[] = [
    { chave: "ofensiva", titulo: "🔥 Ofensiva", niveis: OFENSIVA_NIVEIS, valor: progresso.ofensivaMaxima },
    { chave: "frequencia", titulo: "✅ Frequência", niveis: FREQUENCIA_NIVEIS, valor: progresso.frequenciaCount },
    { chave: "modulos", titulo: "📚 Estudioso", niveis: MODULOS_NIVEIS, valor: progresso.modulosConcluidos },
    { chave: "quiz", titulo: "🎯 Quiz", niveis: QUIZ_NIVEIS, valor: progresso.quizCount },
    { chave: "pontos", titulo: "💰 Colecionador", niveis: PONTOS_NIVEIS, valor: progresso.totalPontos },
  ];

  function renderGradeCategoria(categoria: CategoriaProgressiva) {
    return (
      <div key={categoria.chave} className="flex flex-col gap-2">
        <span className="text-sm font-medium">{categoria.titulo}</span>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {categoria.niveis.map((nivel) => {
            const conquistado = conquistadosSet.has(nivel.badgeId);
            const info = catalogoPorId.get(nivel.badgeId);
            const valorExibido = Math.min(categoria.valor, nivel.limiar);
            const pct = Math.min(100, (categoria.valor / nivel.limiar) * 100);
            const conquistadoEm = conquistadoEmPorId.get(nivel.badgeId);
            return (
              <Card
                key={nivel.badgeId}
                className={cn(
                  "relative overflow-hidden transition-shadow",
                  conquistado
                    ? "border-amber-400/60 bg-amber-500/10 hover:shadow-[0_0_18px_2px_rgba(250,204,21,0.35)]"
                    : "grayscale opacity-70",
                )}
              >
                {conquistado && (
                  <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                    ✅
                  </span>
                )}
                <CardContent className="flex flex-col items-center gap-1 py-4 text-center">
                  <span className="text-2xl">{info?.icone ?? "🏅"}</span>
                  <span className="text-xs font-medium">{info?.nome ?? nivel.badgeId}</span>
                  {conquistado && conquistadoEm ? (
                    <span className="text-muted-foreground text-[11px]">
                      Conquistada em {formatDataConquista(conquistadoEm)}
                    </span>
                  ) : (
                    <div className="flex w-full flex-col gap-1">
                      <div className="bg-muted h-1 w-full overflow-hidden rounded-full">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-muted-foreground text-[11px]">
                        {valorExibido}/{nivel.limiar}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Ranking geral</h1>
        <p className="text-muted-foreground text-sm">
          Pontos por presença, aulas concluídas, quiz e prova — de todos os alunos da plataforma.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
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

        <Card className="max-w-xs">
          <CardContent className="flex flex-col gap-1 py-4">
            <span className="text-muted-foreground text-sm">Ofensiva</span>
            <span className="flex items-center gap-2 text-2xl font-semibold">
              🔥 {ofensivaAtual}
            </span>
            <span className="text-muted-foreground text-xs">
              {ofensivaAtual === 1 ? "1 aula seguida" : `${ofensivaAtual} aulas seguidas`} no
              cronograma
            </span>
            {proximoMarcoOfensiva ? (
              <div className="mt-1 flex flex-col gap-1">
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-orange-500"
                    style={{
                      width: `${Math.min(100, (ofensivaAtual / proximoMarcoOfensiva.limiar) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-muted-foreground text-xs">
                  {ofensivaAtual}/{proximoMarcoOfensiva.limiar} até o próximo marco
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">
                Marco máximo atingido ({marcoMaximoOfensiva}+)
              </span>
            )}
          </CardContent>
        </Card>
      </div>

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

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold">Medalhas progressivas</h2>
          <p className="text-muted-foreground text-sm">
            Bronze, prata, ouro e diamante em cada categoria — conquistadas automaticamente conforme
            você avança.
          </p>
        </div>

        <Tabs defaultValue="todas">
          <TabsList>
            <TabsTrigger value="todas">Todas</TabsTrigger>
            {categoriasProgressivas.map((categoria) => (
              <TabsTrigger key={categoria.chave} value={categoria.chave}>
                {categoria.titulo}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="todas" className="flex flex-col gap-4 pt-4">
            {categoriasProgressivas.map((categoria) => renderGradeCategoria(categoria))}
          </TabsContent>

          {categoriasProgressivas.map((categoria) => (
            <TabsContent key={categoria.chave} value={categoria.chave} className="pt-4">
              {renderGradeCategoria(categoria)}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
