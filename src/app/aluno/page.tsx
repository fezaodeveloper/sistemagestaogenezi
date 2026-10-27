import Link from "next/link";
import { Trophy } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCursoProgresso, type CursoProgresso } from "@/lib/aulas-concluidas/progresso";
import { getMeusPontos } from "@/lib/gamificacao/ranking";
import { getRecursosHabilitadosAluno } from "@/lib/configuracoes/recursos";
import { verificarInadimplenciaAluno } from "@/lib/financeiro/inadimplencia";
import { getSaldoCreditos } from "@/lib/creditos/saldo";
import { CURSO_TIPOS, CURSO_TIPO_LABELS } from "@/lib/cursos/schema";
import { MATRICULA_STATUSES } from "@/lib/matriculas/schema";
import { isAvatarId } from "@/lib/avatares/catalog";
import { AlunoAvatar } from "@/components/gamificacao/aluno-avatar";
import { AvisoInadimplencia } from "@/components/aluno/aviso-inadimplencia";
import { BannerSlideshowPortal } from "@/components/aluno/banner-slideshow-portal";
import { Capa } from "@/components/aluno/capa";
import { CursoBloqueadoCard, type CursoBloqueado } from "@/components/aluno/curso-bloqueado-card";
import { CursoGratuitoCard, type CursoGratuitoAluno } from "@/components/aluno/curso-gratuito-card";
import { DocumentosPendentesCard } from "@/components/aluno/documentos-pendentes-card";
import { NotificacoesPushCard } from "@/components/aluno/notificacoes-push-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CursoTipo = (typeof CURSO_TIPOS)[number];

type MatriculaCursoRow = {
  status: (typeof MATRICULA_STATUSES)[number];
  data_expiracao: string;
  turmas: {
    cursos: {
      id: string;
      nome: string;
      tipo: CursoTipo;
      capa_url: string | null;
      gratuito: boolean;
      url_plataforma_externa: string | null;
    } | null;
  } | null;
};

type CursoAluno = {
  id: string;
  nome: string;
  tipo: CursoTipo;
  capaUrl: string | null;
  emAndamento: boolean;
  dataExpiracao: string;
  expirada: boolean;
  // Curso gratuito hospedado numa plataforma externa (/admin/cursos-gratuitos) — sem conteúdo
  // (módulos/aulas) nesta plataforma, então o card leva direto pra URL externa em vez da página
  // interna do curso.
  gratuito: boolean;
  urlPlataformaExterna: string | null;
};

type CursoGratuitoRow = {
  id: string;
  nome: string;
  descricao: string | null;
  foto_url: string | null;
  url_plataforma_externa: string | null;
  status: string;
};

function cursoGratuitoRowParaCard(curso: CursoGratuitoRow): CursoGratuitoAluno | null {
  // Sem RLS extra necessária pro aluno ler esse curso: a policy "Alunos podem ver o catalogo de
  // cursos ativos" (status = 'ativo', sem checar role nem vínculo) já cobre, mas o status pode
  // ter virado inativo DEPOIS do vínculo (aluno_cursos_gratuitos/curso_bonus_id) ser criado —
  // sem url também não tem pra onde linkar. Os dois casos saem do card, não travados nele.
  if (curso.status !== "ativo" || !curso.url_plataforma_externa) return null;
  return {
    id: curso.id,
    nome: curso.nome,
    descricao: curso.descricao,
    fotoUrl: curso.foto_url,
    url: curso.url_plataforma_externa,
  };
}

// Cursos gratuitos que o aluno tem acesso, combinando as duas formas de vínculo que existem hoje
// (ver migration 20261022150000 e commit a87616d): aluno_cursos_gratuitos (atribuição manual,
// /admin/cursos-gratuitos) e matriculas.curso_bonus_id (bônus de uma matrícula paga). Nenhum dos
// dois passa por turma_id — por isso nunca aparecia em "Meus Cursos" (que só lê
// matriculas->turmas->cursos) nem em lugar nenhum do portal antes desta correção.
async function getCursosGratuitosAluno(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alunoId: string,
): Promise<CursoGratuitoAluno[]> {
  const [{ data: vinculosData }, { data: matriculasBonusData }] = await Promise.all([
    supabase
      .from("aluno_cursos_gratuitos")
      .select("cursos(id, nome, descricao, foto_url, url_plataforma_externa, status)")
      .eq("aluno_id", alunoId),
    supabase.from("matriculas").select("curso_bonus_id").eq("aluno_id", alunoId).not("curso_bonus_id", "is", null),
  ]);

  // curso_bonus_id é uma FK direta pra cursos, separada do caminho turmas->cursos acima — resolvida
  // numa segunda consulta à parte (mesmo padrão de getMatricula em admin/matriculas/actions.ts),
  // mais simples do que arriscar um hint de FK errado num select dinâmico.
  const idsBonus = Array.from(
    new Set((matriculasBonusData ?? []).map((m) => m.curso_bonus_id as string)),
  );
  const { data: cursosBonusData } =
    idsBonus.length > 0
      ? await supabase
          .from("cursos")
          .select("id, nome, descricao, foto_url, url_plataforma_externa, status")
          .in("id", idsBonus)
      : { data: [] as CursoGratuitoRow[] };

  const mapa = new Map<string, CursoGratuitoAluno>();
  for (const linha of (vinculosData ?? []) as unknown as { cursos: CursoGratuitoRow | null }[]) {
    const card = linha.cursos ? cursoGratuitoRowParaCard(linha.cursos) : null;
    if (card) mapa.set(card.id, card);
  }
  for (const curso of (cursosBonusData ?? []) as CursoGratuitoRow[]) {
    if (mapa.has(curso.id)) continue;
    const card = cursoGratuitoRowParaCard(curso);
    if (card) mapa.set(card.id, card);
  }

  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

type DocumentosPendentes = { contratoPendente: string | null; termoImagemPendente: string | null };

// Contrato: mesma resolução de getContratoAluno (/aluno/contrato/actions.ts) — "o" contrato é o
// mais recente por aluno, pendente quando existe e status != "aceito" (sem linha nenhuma = nada
// pra assinar ainda, não é "pendente"). Termo de imagem: por matrícula, não por aluno — usa a
// matrícula ativa mais recente; sem matrícula ativa, não há nada pra checar.
async function getDocumentosPendentesAluno(
  supabase: Awaited<ReturnType<typeof createClient>>,
  alunoId: string,
): Promise<DocumentosPendentes> {
  const [{ data: contrato }, { data: matriculaAtiva }] = await Promise.all([
    supabase
      .from("contratos_assinados")
      .select("matricula_id, status")
      .eq("aluno_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("matriculas")
      .select("id")
      .eq("aluno_id", alunoId)
      .eq("status", "ativa")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const contratoPendente = contrato && contrato.status !== "aceito" ? (contrato.matricula_id as string) : null;

  let termoImagemPendente: string | null = null;
  if (matriculaAtiva) {
    const { data: termo } = await supabase
      .from("termos_imagem_assinados")
      .select("id")
      .eq("matricula_id", matriculaAtiva.id)
      .maybeSingle();
    if (!termo) termoImagemPendente = matriculaAtiva.id;
  }

  return { contratoPendente, termoImagemPendente };
}

function formatDateBR(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Verde acima de 75%, âmbar entre 50-75%, azul abaixo disso — mesma escala
// usada na barra de progresso do card redesenhado.
function corBarraProgresso(percentual: number): string {
  if (percentual > 75) return "bg-green-500";
  if (percentual >= 50) return "bg-amber-500";
  return "bg-blue-500";
}

function bordaStatusCurso(curso: { expirada: boolean; emAndamento: boolean }): string {
  if (curso.expirada) return "border-red-500/40";
  if (curso.emAndamento) return "border-cyan-500/40";
  return "border-green-500/40";
}

function badgeStatusCurso(curso: { expirada: boolean; emAndamento: boolean }) {
  if (curso.expirada) {
    return <Badge className="bg-red-500/90 text-white">Expirado</Badge>;
  }
  if (curso.emAndamento) {
    return <Badge className="bg-cyan-500/90 text-white">Em andamento</Badge>;
  }
  return <Badge className="bg-green-500/90 text-white">Concluído</Badge>;
}

// Um card por curso, não por matrícula/turma — o aluno pode ter mais de uma
// matrícula no mesmo curso (turmas diferentes), mas o conteúdo é o mesmo.
// Se qualquer matrícula naquele curso estiver "ativa", o curso conta como em
// andamento; só aparece como concluído se todas forem "concluida". Já a
// expiração usa só a matrícula mais recente (linhas vêm ordenadas por
// created_at desc) — mesmo critério de desempate de getMatriculaIdAtivaParaCurso
// em todo o resto do sistema, pra o badge aqui bater com o que a página do
// curso mostra ao clicar. Comparação de data em JS, não via RPC
// (matricula_expirada): é só um badge informativo, não fronteira de
// acesso — a página do curso, essa sim, usa a function SQL.
function agruparPorCurso(rows: MatriculaCursoRow[]): CursoAluno[] {
  const hoje = new Date().toISOString().slice(0, 10);
  const mapa = new Map<string, CursoAluno>();

  for (const row of rows) {
    const curso = row.turmas?.cursos;
    if (!curso) continue;

    const emAndamento = row.status === "ativa";
    const atual = mapa.get(curso.id);

    if (!atual) {
      mapa.set(curso.id, {
        id: curso.id,
        nome: curso.nome,
        tipo: curso.tipo,
        capaUrl: curso.capa_url,
        emAndamento,
        dataExpiracao: row.data_expiracao,
        expirada: row.data_expiracao < hoje,
        gratuito: curso.gratuito,
        urlPlataformaExterna: curso.url_plataforma_externa,
      });
    } else if (emAndamento) {
      atual.emAndamento = true;
    }
  }

  return Array.from(mapa.values()).sort((a, b) => a.nome.localeCompare(b.nome));
}

export default async function AlunoDashboardPage() {
  const user = await requireRole("aluno");
  const recursos = await getRecursosHabilitadosAluno(user.id);

  const supabase = await createClient();
  const [{ data, error }, meusPontos, statusInadimplencia, saldoCreditos, { data: configData }] = await Promise.all([
    supabase
      .from("matriculas")
      .select("status, data_expiracao, turmas(cursos(id, nome, tipo, capa_url, gratuito, url_plataforma_externa))")
      .eq("aluno_id", user.id)
      .in("status", ["ativa", "concluida"])
      .order("created_at", { ascending: false }),
    getMeusPontos(supabase, user.id),
    verificarInadimplenciaAluno(user.id),
    getSaldoCreditos(supabase, user.id),
    // Mesma coluna já lida em src/app/aluno/layout.tsx pra alimentar o toggle da sidebar — essa
    // seção na página principal (NotificacoesPushCard) precisa da própria cópia, já que layouts
    // não passam props pras pages no Next.
    supabase.from("configuracoes").select("push_vapid_public_key").eq("id", true).maybeSingle(),
  ]);

  const cursosBrutos = data ? agruparPorCurso(data as unknown as MatriculaCursoRow[]) : null;
  const cursosGratuitos = await getCursosGratuitosAluno(supabase, user.id);
  const documentosPendentes = await getDocumentosPendentesAluno(supabase, user.id);

  // Capa fica em bucket público — a URL é montada aqui (não precisa de
  // signed URL, mesma lógica já usada pra foto de prêmio).
  const cursos = cursosBrutos?.map((curso) => ({
    ...curso,
    capaUrl: curso.capaUrl ? supabase.storage.from("cursos").getPublicUrl(curso.capaUrl).data.publicUrl : null,
  }));

  const progressos: Record<string, CursoProgresso> = {};
  if (cursos && cursos.length > 0) {
    const resultados = await Promise.all(
      cursos.map((curso) => getCursoProgresso(supabase, curso.id)),
    );
    cursos.forEach((curso, i) => {
      progressos[curso.id] = resultados[i];
    });
  }

  // Cursos ativos que o aluno ainda não cursa — mesmo critério de "já
  // matriculado" usado em cursosBrutos (status ativa/concluida), reaproveitado
  // daqui em vez de uma segunda query em matriculas. Limitado a 6 no banco
  // (LIMIT), não em memória.
  const cursoIdsMatriculados = cursosBrutos?.map((curso) => curso.id) ?? [];
  let queryCursosBloqueados = supabase
    .from("cursos")
    .select("id, nome, tipo, capa_url, descricao")
    .eq("status", "ativo")
    .order("nome")
    .limit(6);
  if (cursoIdsMatriculados.length > 0) {
    queryCursosBloqueados = queryCursosBloqueados.not("id", "in", `(${cursoIdsMatriculados.join(",")})`);
  }
  const { data: cursosBloqueadosData, error: erroBloqueados } = await queryCursosBloqueados;
  if (erroBloqueados) {
    console.error('Erro ao buscar cursos bloqueados:', erroBloqueados);
  }

  // Vagas disponíveis por curso — calculado em JS a partir das turmas ativas
  // (supabase-js não expressa MIN()/GROUP BY nativamente); só turmas com
  // vaga sobrando entram no cálculo, mesmo critério da junção pedida
  // originalmente em SQL. Sem turma com vaga: vagasDisponiveis fica null
  // (vira "lista de espera" no card).
  const cursoIdsBloqueados = (cursosBloqueadosData ?? []).map((curso) => curso.id);
  const { data: turmasVagasData } =
    cursoIdsBloqueados.length > 0
      ? await supabase
          .from("turmas")
          .select("curso_id, vagas_total, vagas_ocupadas")
          .in("curso_id", cursoIdsBloqueados)
          .eq("status", "ativa")
      : { data: [] as { curso_id: string; vagas_total: number; vagas_ocupadas: number }[] };

  const vagasPorCurso = new Map<string, number>();
  for (const turma of turmasVagasData ?? []) {
    const disponiveis = turma.vagas_total - turma.vagas_ocupadas;
    if (disponiveis <= 0) continue;
    const atual = vagasPorCurso.get(turma.curso_id);
    vagasPorCurso.set(turma.curso_id, atual === undefined ? disponiveis : Math.min(atual, disponiveis));
  }

  const cursosBloqueados: CursoBloqueado[] = (cursosBloqueadosData ?? []).map((curso) => ({
    id: curso.id,
    nome: curso.nome,
    tipo: curso.tipo,
    descricao: curso.descricao,
    capaUrl: curso.capa_url ? supabase.storage.from("cursos").getPublicUrl(curso.capa_url).data.publicUrl : null,
    vagasDisponiveis: vagasPorCurso.get(curso.id) ?? null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <BannerSlideshowPortal />

      {statusInadimplencia.inadimplente && (
        <AvisoInadimplencia creditosDisponiveis={saldoCreditos.creditosDisponiveis} />
      )}

      <DocumentosPendentesCard
        matriculaIdContratoPendente={documentosPendentes.contratoPendente}
        matriculaIdTermoImagemPendente={documentosPendentes.termoImagemPendente}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlunoAvatar avatarId={isAvatarId(user.avatar_id) ? user.avatar_id : "raposa"} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold">Meus Cursos</h1>
            <p className="text-muted-foreground text-sm">
              Bem-vindo, {user.full_name ?? user.email}.
            </p>
          </div>
        </div>
        {recursos.gamificacao && (
          <Link
            href="/aluno/ranking"
            className="hover:bg-accent/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors"
          >
            <Trophy className="text-muted-foreground size-4" />
            <span>
              Seus pontos: <span className="font-semibold">{meusPontos}</span>
            </span>
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Meus Cursos</h2>
          <Badge variant="secondary">{cursos?.length ?? 0}</Badge>
        </div>

        {error ? (
          <Card>
            <CardContent className="text-destructive py-10 text-center text-sm">
              Não foi possível carregar seus cursos. Tente recarregar a página.
            </CardContent>
          </Card>
        ) : !cursos || cursos.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground text-sm">
                Você ainda não está matriculado em nenhum curso.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cursos.map((curso) => {
              const progresso = progressos[curso.id];
              const percentual =
                progresso && progresso.total > 0
                  ? Math.round((progresso.concluidas / progresso.total) * 100)
                  : 0;

              // Curso gratuito: sem conteúdo (módulos/aulas) nesta plataforma — o card leva
              // direto pra plataforma externa em nova aba, em vez da página interna do curso.
              const linkDestino =
                curso.gratuito && curso.urlPlataformaExterna
                  ? { href: curso.urlPlataformaExterna, target: "_blank", rel: "noopener noreferrer" as const }
                  : { href: `/aluno/cursos/${curso.id}` };

              return (
                <Link key={curso.id} {...linkDestino} className="group block">
                  <Card
                    className={cn(
                      "gap-0 overflow-hidden py-0 transition duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-foreground/10",
                      bordaStatusCurso(curso),
                    )}
                  >
                    <div className="relative aspect-video w-full overflow-hidden">
                      <Capa
                        capaUrl={curso.capaUrl}
                        nome={curso.nome}
                        aspect="16/9"
                        className="h-full w-full rounded-none object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent" />
                      <Badge className="bg-background/80 text-foreground absolute top-2 left-2">
                        {CURSO_TIPO_LABELS[curso.tipo]}
                      </Badge>
                      <div className="absolute top-2 right-2">{badgeStatusCurso(curso)}</div>
                      <h3 className="absolute right-3 bottom-2 left-3 line-clamp-2 text-base font-semibold text-white drop-shadow">
                        {curso.nome}
                      </h3>
                    </div>
                    <CardContent className="flex flex-col gap-3 p-4">
                      {curso.expirada && (
                        <p className="text-destructive text-xs">
                          Acesso expirado em {formatDateBR(curso.dataExpiracao)}
                        </p>
                      )}
                      {progresso && progresso.total > 0 && (
                        <div className="flex flex-col gap-1.5">
                          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                corBarraProgresso(percentual),
                              )}
                              style={{ width: `${percentual}%` }}
                            />
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {progresso.concluidas}/{progresso.total} aulas · {percentual}%
                          </span>
                        </div>
                      )}
                      <span className="flex items-center justify-center rounded-md bg-linear-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-medium text-white transition-opacity group-hover:opacity-90">
                        {curso.gratuito && curso.urlPlataformaExterna ? "Acessar Curso ↗" : "Continuar →"}
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {cursosGratuitos.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Cursos Gratuitos</h2>
            <Badge variant="secondary">{cursosGratuitos.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cursosGratuitos.map((curso) => (
              <CursoGratuitoCard key={curso.id} curso={curso} />
            ))}
          </div>
        </div>
      )}

      <NotificacoesPushCard vapidPublicKey={configData?.push_vapid_public_key ?? null} />

      {cursosBloqueados.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Conheça outros cursos</h2>
            <Badge variant="secondary">{cursosBloqueados.length}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cursosBloqueados.map((curso) => (
              <CursoBloqueadoCard key={curso.id} curso={curso} alunoId={user.id} />
            ))}
          </div>
          <p className="text-muted-foreground text-center text-xs">
            Clique em qualquer curso para demonstrar interesse 👆
          </p>
        </div>
      )}
    </div>
  );
}
