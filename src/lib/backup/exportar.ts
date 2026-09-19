import "server-only";

import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Tabelas de negócio incluídas no backup — nada de auth.users/sessões nem
// segredos (senhas de acesso remoto, chaves VAPID). Mesma lista usada pelo
// download JSON/Excel (rota /admin/configuracoes/backup) e pelo botão "Gerar
// backup agora" (Server Action gerarBackup), pra os dois nunca divergirem.
export const TABELAS_BACKUP = [
  // Núcleo acadêmico/financeiro
  "alunos",
  "matriculas",
  "turmas",
  "cursos",
  "parcelas",
  "presencas",
  "gastos",
  // CRM
  "leads",
  "kanban_colunas",
  // Agendamentos
  "agendamento_paginas",
  "agendamentos",
  // Campanhas
  "campanhas_marketing",
  "campanha_paginas",
  "campanha_respostas",
] as const;

export type TabelaBackup = (typeof TABELAS_BACKUP)[number];

// O PostgREST devolve no máximo 1000 linhas por requisição (limite padrão do
// projeto) — sem paginar, uma tabela maior que isso seria exportada
// TRUNCADA e em silêncio, o pior defeito possível num backup.
const TAMANHO_PAGINA = 1000;
const LIMITE_LINHAS_POR_TABELA = 200_000;

export type ResultadoExportacao = {
  dados: Record<string, Record<string, unknown>[]>;
  // Problemas por tabela (consulta que falhou, tabela cortada no limite). Um
  // backup parcial SEM aviso passa a falsa sensação de segurança, então isso
  // vai dentro do arquivo e é mostrado ao admin.
  avisos: string[];
};

export async function exportarTabelas(
  supabase: SupabaseServerClient,
  tabelas: readonly TabelaBackup[],
): Promise<ResultadoExportacao> {
  const dados: Record<string, Record<string, unknown>[]> = {};
  const avisos: string[] = [];

  await Promise.all(
    tabelas.map(async (tabela) => {
      const linhas: Record<string, unknown>[] = [];
      let completa = false;

      for (let inicio = 0; inicio < LIMITE_LINHAS_POR_TABELA; inicio += TAMANHO_PAGINA) {
        // select("*"): backup completo (todas as colunas). Ordenado por id pra a
        // paginação por range ser estável.
        const { data, error } = await supabase
          .from(tabela)
          .select("*")
          .order("id", { ascending: true })
          .range(inicio, inicio + TAMANHO_PAGINA - 1);

        if (error) {
          avisos.push(`Tabela "${tabela}" não foi exportada por completo: ${error.message}`);
          completa = true; // já avisado; não repete o aviso de limite
          break;
        }

        linhas.push(...((data ?? []) as Record<string, unknown>[]));
        if (!data || data.length < TAMANHO_PAGINA) {
          completa = true;
          break;
        }
      }

      if (!completa) {
        avisos.push(`Tabela "${tabela}" foi cortada em ${LIMITE_LINHAS_POR_TABELA} linhas.`);
      }
      dados[tabela] = linhas;
    }),
  );

  return { dados, avisos: avisos.sort() };
}
