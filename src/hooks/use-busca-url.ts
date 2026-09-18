"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE_MS = 400;

// Campo de busca das listagens paginadas: digitar (com debounce) coloca `q` na
// URL e VOLTA PARA A PÁGINA 1 (o parâmetro `page` é removido), e o Server
// Component refaz a consulta sobre todos os registros. Sem isso a busca só
// filtrava, no navegador, a página que já estava carregada.
//
// `paramsAtuais` são os demais parâmetros da URL a preservar (limit, orderBy,
// status...), já sem `q`/`page`.
export function useBuscaUrl(baseUrl: string, qAtual: string, paramsAtuais: Record<string, string> = {}) {
  const router = useRouter();
  const [busca, setBusca] = useState(qAtual);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Espelha `paramsAtuais` sem recriar o handler a cada render.
  const paramsRef = useRef(paramsAtuais);
  useEffect(() => {
    paramsRef.current = paramsAtuais;
  });
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function alterarBusca(valor: string) {
    setBusca(valor);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams(paramsRef.current);
      params.delete("page");
      const termo = valor.trim();
      if (termo) params.set("q", termo);
      else params.delete("q");
      const query = params.toString();
      router.push(query ? `${baseUrl}?${query}` : baseUrl);
    }, DEBOUNCE_MS);
  }

  return { busca, alterarBusca };
}
