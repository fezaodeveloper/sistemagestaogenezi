import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// TAREFA pedia a tabela "frequencias" — não existe no schema, o nome real é
// "presencas" (ver supabase/migrations/20260806100000_create_presencas.sql).
// Exportada com esse nome real. Colunas de cada tabela também ajustadas pro
// schema de verdade: alunos.nome não existe (é "full_name"); leads não tem
// "email" nem "whatsapp" (só "telefone"); cursos.valor (não
// "valor_mensalidade").
const TABELAS = {
  alunos: { colunas: "id, full_name, email, telefone, cpf, created_at" },
  matriculas: { colunas: "id, aluno_id, turma_id, status, created_at" },
  turmas: { colunas: "id, nome, curso_id, data_inicio, data_fim" },
  cursos: { colunas: "id, nome, tipo, valor" },
  parcelas: { colunas: "id, matricula_id, valor, status, data_vencimento, data_pagamento" },
  presencas: { colunas: "id, matricula_id, aula_id, status, created_at" },
  leads: { colunas: "id, nome, telefone, status, created_at" },
} as const;

type NomeTabela = keyof typeof TABELAS;
const NOMES_TABELAS = Object.keys(TABELAS) as NomeTabela[];

function parseTabelas(valor: string | null): NomeTabela[] {
  if (!valor) return NOMES_TABELAS;
  const pedidas = valor.split(",").map((t) => t.trim()) as NomeTabela[];
  const validas = pedidas.filter((t) => NOMES_TABELAS.includes(t));
  return validas.length > 0 ? validas : NOMES_TABELAS;
}

export async function GET(request: NextRequest) {
  await requireRole("admin");

  const searchParams = request.nextUrl.searchParams;
  const formato = searchParams.get("formato") === "excel" ? "excel" : "json";
  const tabelas = parseTabelas(searchParams.get("tabelas"));

  const supabase = await createClient();
  const resultados = await Promise.all(
    tabelas.map((tabela) => supabase.from(tabela).select(TABELAS[tabela].colunas)),
  );

  const dados: Record<string, unknown[]> = {};
  tabelas.forEach((tabela, index) => {
    dados[tabela] = resultados[index].data ?? [];
  });

  const hoje = new Date().toISOString().slice(0, 10);

  if (formato === "json") {
    const conteudo = { ...dados, gerado_em: new Date().toISOString() };
    return new NextResponse(JSON.stringify(conteudo, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-genezi-${hoje}.json"`,
      },
    });
  }

  const workbook = XLSX.utils.book_new();
  for (const tabela of tabelas) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(dados[tabela]), tabela);
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="backup-genezi-${hoje}.xlsx"`,
    },
  });
}
