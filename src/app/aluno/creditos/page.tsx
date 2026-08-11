import { Coins } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getSaldoCreditos } from "@/lib/creditos/saldo";
import { getMeusResgates, RESGATE_STATUS_LABELS, RESGATE_TIPO_LABELS } from "@/lib/creditos/resgates";
import type { Curso } from "@/lib/cursos/schema";
import type { Premio } from "@/lib/premios/schema";
import { ResgateItemCard } from "@/components/aluno/resgate-item-card";
import { resgatarCursoBonus, resgatarPremioFisico } from "./actions";
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

function formatDateBR(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function CreditosPage() {
  const user = await requireRole("aluno");
  const supabase = await createClient();

  const [saldo, meusResgates, { data: configData }, { data: cursosBonusData }, { data: premiosData }] =
    await Promise.all([
      getSaldoCreditos(supabase, user.id),
      getMeusResgates(supabase, user.id),
      supabase.from("configuracoes").select("max_cursos_bonus_por_aluno").single(),
      supabase
        .from("cursos")
        .select("id, nome, descricao, custo_creditos")
        .eq("disponivel_para_resgate", true)
        .eq("status", "ativo"),
      supabase
        .from("premios")
        .select("id, nome, descricao, foto_url, custo_creditos, estoque")
        .eq("ativo", true),
    ]);

  const maxCursosBonus = configData?.max_cursos_bonus_por_aluno ?? 1;
  const cursosBonusJaResgatados = meusResgates.filter((r) => r.tipo === "curso_bonus").length;
  const limiteCursosBonusAtingido = cursosBonusJaResgatados >= maxCursosBonus;

  const cursosBonus = (cursosBonusData ?? []) as Pick<
    Curso,
    "id" | "nome" | "descricao" | "custo_creditos"
  >[];
  const premios = (
    (premiosData ?? []) as Pick<
      Premio,
      "id" | "nome" | "descricao" | "foto_url" | "custo_creditos" | "estoque"
    >[]
  ).map((premio) => ({
    ...premio,
    // Bucket "premios" é público — foto_url guarda só o caminho, a URL
    // pública é montada aqui, mesma convenção de path relativo já usada
    // pra PDFs em "materiais" (que é privado e por isso usa signed URL
    // em vez disso).
    foto_url: premio.foto_url ? supabase.storage.from("premios").getPublicUrl(premio.foto_url).data.publicUrl : null,
  }));

  const faltamPontos = 50 - (saldo.pontosTotais % 50);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus Créditos</h1>
        <p className="text-muted-foreground text-sm">
          A cada 50 pontos acumulados você ganha 1 crédito — troque por cursos bônus ou prêmios.
        </p>
      </div>

      <Card className="max-w-sm">
        <CardContent className="flex flex-col gap-1 py-4">
          <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Coins className="size-4" />
            Créditos disponíveis
          </span>
          <span className="text-2xl font-semibold">{saldo.creditosDisponiveis}</span>
          <span className="text-muted-foreground text-xs">
            {saldo.pontosTotais} pontos no total · faltam {faltamPontos} pontos pro próximo crédito
          </span>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Cursos bônus</h2>
        {cursosBonus.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Nenhum curso bônus disponível no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cursosBonus.map((curso) => (
              <ResgateItemCard
                key={curso.id}
                titulo={curso.nome}
                descricao={curso.descricao}
                custoCreditos={curso.custo_creditos ?? 0}
                bloqueado={
                  limiteCursosBonusAtingido || saldo.creditosDisponiveis < (curso.custo_creditos ?? 0)
                }
                motivoBloqueio={
                  limiteCursosBonusAtingido
                    ? `Limite de ${maxCursosBonus} curso(s) bônus já atingido.`
                    : saldo.creditosDisponiveis < (curso.custo_creditos ?? 0)
                      ? "Créditos insuficientes."
                      : undefined
                }
                onConfirmar={resgatarCursoBonus.bind(null, curso.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Prêmios</h2>
        {premios.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Nenhum prêmio disponível no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {premios.map((premio) => {
              const semEstoque = premio.estoque !== null && premio.estoque <= 0;
              return (
                <ResgateItemCard
                  key={premio.id}
                  titulo={premio.nome}
                  descricao={premio.descricao}
                  custoCreditos={premio.custo_creditos}
                  imagemUrl={premio.foto_url}
                  bloqueado={semEstoque || saldo.creditosDisponiveis < premio.custo_creditos}
                  motivoBloqueio={
                    semEstoque
                      ? "Fora de estoque."
                      : saldo.creditosDisponiveis < premio.custo_creditos
                        ? "Créditos insuficientes."
                        : undefined
                  }
                  onConfirmar={resgatarPremioFisico.bind(null, premio.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Histórico de resgates</h2>
        {meusResgates.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-8 text-center text-sm">
              Você ainda não resgatou nada.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meusResgates.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.itemNome}</TableCell>
                    <TableCell>{RESGATE_TIPO_LABELS[r.tipo]}</TableCell>
                    <TableCell>{r.custoCreditos}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "pendente" ? "outline" : "default"}>
                        {RESGATE_STATUS_LABELS[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateBR(r.criadoEm)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
