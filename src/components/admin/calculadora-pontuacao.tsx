"use client";

import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { ConfigGamificacaoValues } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Pesos fixos de distribuição de créditos entre os 4 níveis de prêmio —
// somam 100% do total de créditos esperado no curso (10/20/35/35, mesma
// proporção crescente dos níveis de badge progressivo: bronze/prata mais
// fáceis e "baratos" em conjunto, ouro/diamante concentram a maior parte).
const PESOS_NIVEL = [0.1, 0.2, 0.35, 0.35] as const;

const NIVEIS = [
  { emoji: "🥉", label: "Nível 1" },
  { emoji: "🥈", label: "Nível 2" },
  { emoji: "🥇", label: "Nível 3" },
  { emoji: "💎", label: "Nível 4" },
] as const;

function toNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function CalculadoraPontuacao({ pontuacaoInicial }: { pontuacaoInicial: ConfigGamificacaoValues }) {
  const [totalAulas, setTotalAulas] = useState(20);
  const [aulasPorSemana, setAulasPorSemana] = useState(1);
  const [modulos, setModulos] = useState(4);
  const [quizzesPorAula, setQuizzesPorAula] = useState(1);
  const [provasPorModulo, setProvasPorModulo] = useState(1);
  const [frequenciaEsperada, setFrequenciaEsperada] = useState(75);
  const [duracaoMeses, setDuracaoMeses] = useState(12);

  const [quantidades, setQuantidades] = useState<[number, number, number, number]>([1, 1, 1, 1]);
  const [copiado, setCopiado] = useState(false);

  // duracaoMeses nasce com o padrão (12) e só é recalculada quando total de
  // aulas ou aulas/semana mudam (direto no handler, não via effect) — o
  // próprio campo continua editável livremente entre uma mudança e outra
  // (ver REGRA "calculado automaticamente, mas editável").
  function handleTotalAulasChange(value: string) {
    const novoTotal = toNumber(value);
    setTotalAulas(novoTotal);
    if (aulasPorSemana > 0) setDuracaoMeses(Math.max(1, Math.round(novoTotal / aulasPorSemana / 4)));
  }

  function handleAulasPorSemanaChange(value: string) {
    const novoValor = toNumber(value);
    setAulasPorSemana(novoValor);
    if (novoValor > 0) setDuracaoMeses(Math.max(1, Math.round(totalAulas / novoValor / 4)));
  }

  const resultado = useMemo(() => {
    const presencasEsperadas = totalAulas * (frequenciaEsperada / 100);
    const quizzesTotais = quizzesPorAula > 0 ? totalAulas * quizzesPorAula : 0;
    const provasTotais = provasPorModulo > 0 ? modulos * provasPorModulo : 0;

    const subtotalPresencas = presencasEsperadas * pontuacaoInicial.pts_presenca;
    const subtotalAulas = totalAulas * pontuacaoInicial.pts_aula_concluida;
    const subtotalQuizzes = quizzesTotais * pontuacaoInicial.pts_quiz_concluido * 0.75;
    const subtotalProvas = provasTotais * pontuacaoInicial.pts_nota_maxima * 0.75;
    const subtotalModulos = modulos * pontuacaoInicial.pts_modulo_concluido;
    const subtotalCurso = pontuacaoInicial.pts_curso_concluido;

    const totalPontosEsperados = Math.round(
      subtotalPresencas + subtotalAulas + subtotalQuizzes + subtotalProvas + subtotalModulos + subtotalCurso,
    );

    const totalCreditos = totalPontosEsperados;
    const custosPorNivel = quantidades.map((quantidade, index) => {
      if (quantidade <= 0) return null;
      return Math.round((totalCreditos * PESOS_NIVEL[index]) / quantidade);
    });

    return {
      presencasEsperadas: Math.round(presencasEsperadas),
      quizzesTotais,
      provasTotais,
      subtotalPresencas: Math.round(subtotalPresencas),
      subtotalAulas: Math.round(subtotalAulas),
      subtotalQuizzes: Math.round(subtotalQuizzes),
      subtotalProvas: Math.round(subtotalProvas),
      subtotalModulos: Math.round(subtotalModulos),
      subtotalCurso,
      totalPontosEsperados,
      custosPorNivel,
    };
  }, [totalAulas, modulos, quizzesPorAula, provasPorModulo, frequenciaEsperada, quantidades, pontuacaoInicial]);

  function handleQuantidadeChange(index: number, value: string) {
    setQuantidades((prev) => {
      const novo = [...prev] as [number, number, number, number];
      novo[index] = toNumber(value);
      return novo;
    });
  }

  async function handleCopiar() {
    const linhas = [
      `Total de pontos esperados: ${resultado.totalPontosEsperados}`,
      `Tempo estimado: ${duracaoMeses} meses`,
      "",
      "Breakdown:",
      `- Presenças: ${resultado.presencasEsperadas} x ${pontuacaoInicial.pts_presenca} = ${resultado.subtotalPresencas} pts`,
      `- Aulas concluídas: ${totalAulas} x ${pontuacaoInicial.pts_aula_concluida} = ${resultado.subtotalAulas} pts`,
    ];
    if (resultado.quizzesTotais > 0) {
      linhas.push(
        `- Quizzes: ${resultado.quizzesTotais} x ${pontuacaoInicial.pts_quiz_concluido} = ${resultado.subtotalQuizzes} pts`,
      );
    }
    if (resultado.provasTotais > 0) {
      linhas.push(
        `- Provas: ${resultado.provasTotais} x ${pontuacaoInicial.pts_nota_maxima} = ${resultado.subtotalProvas} pts`,
      );
    }
    linhas.push(
      `- Módulos: ${modulos} x ${pontuacaoInicial.pts_modulo_concluido} = ${resultado.subtotalModulos} pts`,
      `- Conclusão do curso: ${resultado.subtotalCurso} pts`,
      "",
      "Custo sugerido por nível:",
      ...NIVEIS.map((nivel, index) => {
        const custo = resultado.custosPorNivel[index];
        return `${nivel.emoji} ${nivel.label}: ${custo === null ? "—" : `${custo} créditos`} (para ${quantidades[index]} prêmio(s))`;
      }),
    );

    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Best-effort — sem clipboard disponível, só não mostra o feedback.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Parâmetros do Curso</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="calc-total-aulas">Total de aulas</Label>
              <Input
                id="calc-total-aulas"
                type="number"
                min={0}
                value={totalAulas}
                onChange={(e) => handleTotalAulasChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="calc-aulas-semana">Aulas por semana</Label>
              <Input
                id="calc-aulas-semana"
                type="number"
                min={1}
                value={aulasPorSemana}
                onChange={(e) => handleAulasPorSemanaChange(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="calc-modulos">Módulos no curso</Label>
              <Input
                id="calc-modulos"
                type="number"
                min={0}
                value={modulos}
                onChange={(e) => setModulos(toNumber(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="calc-frequencia">Frequência esperada (%)</Label>
              <Input
                id="calc-frequencia"
                type="number"
                min={0}
                max={100}
                value={frequenciaEsperada}
                onChange={(e) => setFrequenciaEsperada(toNumber(e.target.value))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="calc-quizzes">Quizzes por aula</Label>
              <Input
                id="calc-quizzes"
                type="number"
                min={0}
                value={quizzesPorAula}
                onChange={(e) => setQuizzesPorAula(toNumber(e.target.value))}
              />
              <p className="text-muted-foreground text-xs">Digite 0 se o curso não tem quizzes</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="calc-provas">Provas por módulo</Label>
              <Input
                id="calc-provas"
                type="number"
                min={0}
                value={provasPorModulo}
                onChange={(e) => setProvasPorModulo(toNumber(e.target.value))}
              />
              <p className="text-muted-foreground text-xs">Digite 0 se o curso não tem provas</p>
            </div>
            <div className="col-span-2 flex flex-col gap-2 sm:max-w-60">
              <Label htmlFor="calc-duracao">Duração em meses</Label>
              <Input
                id="calc-duracao"
                type="number"
                min={1}
                value={duracaoMeses}
                onChange={(e) => setDuracaoMeses(toNumber(e.target.value))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meta de Prêmios</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {NIVEIS.map((nivel, index) => (
              <div key={nivel.label} className="flex items-center gap-3">
                <span className="text-lg">{nivel.emoji}</span>
                <div className="flex flex-1 flex-col gap-2">
                  <Label htmlFor={`calc-qtd-${index}`}>{nivel.label} — quantidade desejada</Label>
                  <Input
                    id={`calc-qtd-${index}`}
                    type="number"
                    min={0}
                    value={quantidades[index]}
                    onChange={(e) => handleQuantidadeChange(index, e.target.value)}
                  />
                </div>
                <div className="w-32 text-right text-sm">
                  <p className="text-muted-foreground text-xs">Custo em créditos</p>
                  <p className="font-semibold">
                    {resultado.custosPorNivel[index] === null ? "—" : resultado.custosPorNivel[index]}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Resultado</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={handleCopiar}>
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copiado ? "Copiado" : "Copiar resultado"}
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-sm">
          <div>
            <p>
              Total de pontos esperados: <span className="font-semibold">{resultado.totalPontosEsperados}</span>
            </p>
            <p>
              Tempo estimado: <span className="font-semibold">{duracaoMeses} meses</span>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-semibold">Breakdown:</p>
            <p>
              Presenças: {resultado.presencasEsperadas} × {pontuacaoInicial.pts_presenca} ={" "}
              {resultado.subtotalPresencas} pts
            </p>
            <p>
              Aulas concluídas: {totalAulas} × {pontuacaoInicial.pts_aula_concluida} = {resultado.subtotalAulas}{" "}
              pts
            </p>
            {resultado.quizzesTotais > 0 && (
              <p>
                Quizzes: {resultado.quizzesTotais} × {pontuacaoInicial.pts_quiz_concluido} ={" "}
                {resultado.subtotalQuizzes} pts
              </p>
            )}
            {resultado.provasTotais > 0 && (
              <p>
                Provas: {resultado.provasTotais} × {pontuacaoInicial.pts_nota_maxima} = {resultado.subtotalProvas}{" "}
                pts
              </p>
            )}
            <p>
              Módulos: {modulos} × {pontuacaoInicial.pts_modulo_concluido} = {resultado.subtotalModulos} pts
            </p>
            <p>Conclusão do curso: {resultado.subtotalCurso} pts</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="font-semibold">Custo sugerido por nível:</p>
            {NIVEIS.map((nivel, index) => {
              const custo = resultado.custosPorNivel[index];
              return (
                <p key={nivel.label}>
                  {nivel.emoji} {nivel.label}: {custo === null ? "—" : `${custo} créditos`} (para{" "}
                  {quantidades[index]} prêmio(s))
                </p>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
