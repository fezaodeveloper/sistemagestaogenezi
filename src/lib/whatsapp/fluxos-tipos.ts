// Fluxos de WhatsApp (GênZap Fase 3) — tipos, validação e utilitários puros. SEM "server-only"
// de propósito: importado pelo editor visual (client component) e pelo executor (server-only,
// em src/lib/whatsapp/fluxos.ts) — mesmo motivo da separação em src/lib/whatsapp/templates.ts.

export const TIPOS_NO = ["gatilho", "mensagem", "aguardar", "condicao", "fim"] as const;
export type TipoNo = (typeof TIPOS_NO)[number];

export const TIPO_NO_INFO: Record<TipoNo, { label: string; emoji: string; cor: string }> = {
  gatilho: { label: "Gatilho", emoji: "🎯", cor: "#22c55e" },
  mensagem: { label: "Mensagem", emoji: "💬", cor: "#3b82f6" },
  aguardar: { label: "Aguardar", emoji: "⏳", cor: "#eab308" },
  condicao: { label: "Condição", emoji: "❓", cor: "#a855f7" },
  fim: { label: "Fim", emoji: "🏁", cor: "#6b7280" },
};

export const FLUXO_GATILHOS = [
  "matricula_criada",
  "agendamento_criado",
  "lead_criado",
  "pagamento_recebido",
  "cobranca_atrasada",
  "manual",
] as const;
export type FluxoGatilho = (typeof FLUXO_GATILHOS)[number];

export const FLUXO_GATILHO_LABELS: Record<FluxoGatilho, string> = {
  matricula_criada: "Matrícula criada",
  agendamento_criado: "Agendamento criado",
  lead_criado: "Lead criado",
  pagamento_recebido: "Pagamento recebido",
  cobranca_atrasada: "Cobrança atrasada",
  manual: "Manual (só pelo botão \"Testar fluxo\")",
};

// Variáveis que cada gatilho normalmente disponibiliza (documentação pra tela — o fluxo pode
// usar outras se o evento passar mais dados; ver os pontos de disparo em cada arquivo).
export const FLUXO_GATILHO_VARIAVEIS: Record<FluxoGatilho, string[]> = {
  matricula_criada: ["telefone", "nome", "curso", "turma"],
  agendamento_criado: ["telefone", "nome", "data", "horario", "titulo_pagina"],
  lead_criado: ["telefone", "nome", "curso"],
  pagamento_recebido: ["telefone", "nome", "valor", "curso"],
  cobranca_atrasada: ["telefone", "nome", "valor", "vencimento", "dias_atraso"],
  manual: ["telefone", "nome"],
};

export function isFluxoGatilho(valor: unknown): valor is FluxoGatilho {
  return typeof valor === "string" && (FLUXO_GATILHOS as readonly string[]).includes(valor);
}

export type Posicao = { x: number; y: number };

export type DadosGatilho = { evento: FluxoGatilho };
export type DadosMensagem = { texto: string };
export type DadosAguardar = { segundos: number };

export const CONDICAO_OPERADORES = ["igual", "diferente", "contem", "vazio", "nao_vazio", "maior", "menor"] as const;
export type CondicaoOperador = (typeof CONDICAO_OPERADORES)[number];
export const CONDICAO_OPERADOR_LABELS: Record<CondicaoOperador, string> = {
  igual: "é igual a",
  diferente: "é diferente de",
  contem: "contém",
  vazio: "está vazio",
  nao_vazio: "não está vazio",
  maior: "é maior que (número)",
  menor: "é menor que (número)",
};
export type DadosCondicao = { campo: string; operador: CondicaoOperador; valor: string };

export type DadosNo = DadosGatilho | DadosMensagem | DadosAguardar | DadosCondicao | Record<string, never>;

export type NoFluxo = {
  id: string;
  tipo: TipoNo;
  posicao: Posicao;
  dados: Partial<DadosGatilho & DadosMensagem & DadosAguardar & DadosCondicao>;
  // "mensagem"/"aguardar"/"gatilho": proximos[0] é o próximo nó (sequencial).
  // "condicao": proximos[0] = destino se VERDADEIRO, proximos[1] = destino se FALSO.
  // "fim": sempre [].
  proximos: string[];
};

function posicaoValida(valor: unknown): valor is Posicao {
  return !!valor && typeof valor === "object" && typeof (valor as Posicao).x === "number" && typeof (valor as Posicao).y === "number";
}

// Filtra só os nós estruturalmente válidos (id/tipo/posicao/proximos com o formato certo) — um
// nó corrompido não derruba o fluxo inteiro, só desaparece (o autor percebe e reconstrói).
export function parseNos(bruto: unknown): NoFluxo[] {
  if (!Array.isArray(bruto)) return [];
  const nos: NoFluxo[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const { id, tipo, posicao, dados, proximos } = item as Record<string, unknown>;
    if (typeof id !== "string" || !id) continue;
    if (!(TIPOS_NO as readonly string[]).includes(tipo as string)) continue;
    if (!posicaoValida(posicao)) continue;
    if (!Array.isArray(proximos) || !proximos.every((p) => typeof p === "string")) continue;
    nos.push({ id, tipo: tipo as TipoNo, posicao, dados: (dados as NoFluxo["dados"]) ?? {}, proximos: proximos as string[] });
  }
  return nos;
}

export function encontrarGatilho(nos: NoFluxo[]): NoFluxo | undefined {
  return nos.find((n) => n.tipo === "gatilho");
}

export function encontrarNo(nos: NoFluxo[], id: string | null | undefined): NoFluxo | undefined {
  if (!id) return undefined;
  return nos.find((n) => n.id === id);
}

// Substituição simples de {chave} — mesma semântica de renderizarTemplateWhatsapp
// (src/lib/whatsapp/templates.ts): chave sem valor correspondente fica visível no texto, não
// some silenciosamente.
export function renderizarTextoFluxo(texto: string, variaveis: Record<string, string>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in variaveis ? variaveis[chave] : inteiro));
}

export function avaliarCondicao(dados: DadosCondicao, variaveis: Record<string, string>): boolean {
  const atual = (variaveis[dados.campo] ?? "").trim();
  const alvo = (dados.valor ?? "").trim();
  switch (dados.operador) {
    case "igual":
      return atual.toLowerCase() === alvo.toLowerCase();
    case "diferente":
      return atual.toLowerCase() !== alvo.toLowerCase();
    case "contem":
      return atual.toLowerCase().includes(alvo.toLowerCase());
    case "vazio":
      return atual === "";
    case "nao_vazio":
      return atual !== "";
    case "maior":
      return Number(atual) > Number(alvo);
    case "menor":
      return Number(atual) < Number(alvo);
    default:
      return false;
  }
}

// Atalhos de "aguardar" (a tela guarda sempre em segundos).
export const DELAY_UNIDADES = [
  { chave: "segundos", label: "segundos", segundos: 1 },
  { chave: "minutos", label: "minutos", segundos: 60 },
  { chave: "horas", label: "horas", segundos: 3600 },
  { chave: "dias", label: "dias", segundos: 86400 },
] as const;

export function novoId(nos: NoFluxo[]): string {
  let contador = nos.length + 1;
  while (nos.some((n) => n.id === `n${contador}`)) contador++;
  return `n${contador}`;
}

// Fluxo mínimo pra um fluxo novo: só o nó de gatilho, sem sucessor ainda.
export function nosIniciais(evento: FluxoGatilho): NoFluxo[] {
  return [{ id: "n1", tipo: "gatilho", posicao: { x: 60, y: 60 }, dados: { evento }, proximos: [] }];
}
