import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { exportarTabelas, TABELAS_BACKUP, type TabelaBackup } from "@/lib/backup/exportar";

// A TAREFA original pedia a tabela "frequencias" — não existe no schema, o
// nome real é "presencas" (ver supabase/migrations/20260806100000_create_presencas.sql).
// A lista de tabelas (e a leitura paginada, com aviso de falha) vive em
// src/lib/backup/exportar.ts, compartilhada com o botão "Gerar backup agora".

function parseTabelas(valor: string | null): readonly TabelaBackup[] {
  if (!valor) return TABELAS_BACKUP;
  const pedidas = valor.split(",").map((t) => t.trim());
  const validas = TABELAS_BACKUP.filter((t) => pedidas.includes(t));
  return validas.length > 0 ? validas : TABELAS_BACKUP;
}

// Excel só aceita valor simples por célula: jsonb (etapas de campanha,
// respostas, campos extras...) vira texto JSON. O limite de uma célula é 32767
// caracteres — corta um pouco antes.
function paraCelulaExcel(valor: unknown): unknown {
  if (valor !== null && typeof valor === "object") return JSON.stringify(valor).slice(0, 32000);
  return valor;
}

export async function GET(request: NextRequest) {
  await requireRole("admin");

  const searchParams = request.nextUrl.searchParams;
  const formato = searchParams.get("formato") === "excel" ? "excel" : "json";
  const tabelas = parseTabelas(searchParams.get("tabelas"));

  const supabase = await createClient();
  const { dados, avisos } = await exportarTabelas(supabase, tabelas);
  const contagem = Object.fromEntries(tabelas.map((t) => [t, dados[t]?.length ?? 0]));

  const hoje = new Date().toISOString().slice(0, 10);
  // A tela lê este cabeçalho pra avisar que o backup saiu incompleto.
  const cabecalhoAvisos = { "X-Backup-Avisos": String(avisos.length) };

  if (formato === "json") {
    const conteudo = {
      gerado_em: new Date().toISOString(),
      contagem,
      ...(avisos.length > 0 ? { avisos } : {}),
      ...dados,
    };
    return new NextResponse(JSON.stringify(conteudo, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-genezi-${hoje}.json"`,
        ...cabecalhoAvisos,
      },
    });
  }

  const workbook = XLSX.utils.book_new();
  for (const tabela of tabelas) {
    const linhas = (dados[tabela] ?? []).map((linha) =>
      Object.fromEntries(Object.entries(linha).map(([coluna, valor]) => [coluna, paraCelulaExcel(valor)])),
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(linhas), tabela);
  }
  if (avisos.length > 0) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(avisos.map((aviso) => ({ aviso }))), "avisos");
  }
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="backup-genezi-${hoje}.xlsx"`,
      ...cabecalhoAvisos,
    },
  });
}
