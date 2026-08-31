"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LIMITE_PADRAO, LIMITES_VALIDOS } from "@/lib/paginacao";

const LIMITE_ITEMS: Record<string, string> = Object.fromEntries(
  LIMITES_VALIDOS.map((limite) => [String(limite), String(limite)]),
);

const MAX_PAGINAS_VISIVEIS = 5;
const RETICENCIAS = "…";

type ItemPaginacao = number | typeof RETICENCIAS;

// Janela de até 5 números de página ao redor da página atual, com "…" pra
// indicar o trecho pulado — sempre mostra a primeira e a última página pra
// dar noção do tamanho total da lista.
function calcularPaginasVisiveis(paginaAtual: number, totalPaginas: number): ItemPaginacao[] {
  if (totalPaginas <= MAX_PAGINAS_VISIVEIS) {
    return Array.from({ length: totalPaginas }, (_, indice) => indice + 1);
  }

  const metade = Math.floor(MAX_PAGINAS_VISIVEIS / 2);
  let inicio = Math.max(1, paginaAtual - metade);
  let fim = inicio + MAX_PAGINAS_VISIVEIS - 1;
  if (fim > totalPaginas) {
    fim = totalPaginas;
    inicio = fim - MAX_PAGINAS_VISIVEIS + 1;
  }

  const paginas: ItemPaginacao[] = [];
  if (inicio > 1) {
    paginas.push(1);
    if (inicio > 2) paginas.push(RETICENCIAS);
  }
  for (let pagina = inicio; pagina <= fim; pagina++) {
    paginas.push(pagina);
  }
  if (fim < totalPaginas) {
    if (fim < totalPaginas - 1) paginas.push(RETICENCIAS);
    paginas.push(totalPaginas);
  }
  return paginas;
}

// page/limit só entram na URL quando diferentes do padrão (página 1, limite
// 20) — mantém a URL limpa em /admin/alunos em vez de
// /admin/alunos?page=1&limit=20.
function construirHref(
  baseUrl: string,
  searchParams: Record<string, string>,
  pagina: number,
  limite: number,
): string {
  const params = new URLSearchParams(searchParams);
  if (pagina > 1) {
    params.set("page", String(pagina));
  } else {
    params.delete("page");
  }
  if (limite !== LIMITE_PADRAO) {
    params.set("limit", String(limite));
  } else {
    params.delete("limit");
  }
  const query = params.toString();
  return query ? `${baseUrl}?${query}` : baseUrl;
}

export function Paginacao({
  paginaAtual,
  totalPaginas,
  totalRegistros,
  limite,
  baseUrl,
  searchParams = {},
}: {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
  limite: number;
  baseUrl: string;
  searchParams?: Record<string, string>;
}) {
  const router = useRouter();

  if (totalRegistros === 0) return null;

  const primeiroRegistro = (paginaAtual - 1) * limite + 1;
  const ultimoRegistro = Math.min(paginaAtual * limite, totalRegistros);
  const paginasVisiveis = calcularPaginasVisiveis(paginaAtual, totalPaginas);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <p className="text-muted-foreground text-sm">
        Mostrando {primeiroRegistro}-{ultimoRegistro} de {totalRegistros} registro
        {totalRegistros === 1 ? "" : "s"}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            render={<Link href={construirHref(baseUrl, searchParams, paginaAtual - 1, limite)} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            disabled={paginaAtual <= 1}
          >
            <ChevronLeft />
            Anterior
          </Button>

          {paginasVisiveis.map((item, indice) =>
            item === RETICENCIAS ? (
              <span key={`reticencias-${indice}`} className="text-muted-foreground px-2 text-sm">
                {RETICENCIAS}
              </span>
            ) : (
              <Button
                key={item}
                render={<Link href={construirHref(baseUrl, searchParams, item, limite)} />}
                nativeButton={false}
                variant={item === paginaAtual ? "default" : "outline"}
                size="sm"
                className="w-9"
              >
                {item}
              </Button>
            ),
          )}

          <Button
            render={<Link href={construirHref(baseUrl, searchParams, paginaAtual + 1, limite)} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            disabled={paginaAtual >= totalPaginas}
          >
            Próximo
            <ChevronRight />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">Por página:</span>
          <Select
            items={LIMITE_ITEMS}
            value={String(limite)}
            onValueChange={(value) => {
              router.push(construirHref(baseUrl, searchParams, 1, Number(value)));
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIMITES_VALIDOS.map((opcao) => (
                <SelectItem key={opcao} value={String(opcao)}>
                  {opcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
