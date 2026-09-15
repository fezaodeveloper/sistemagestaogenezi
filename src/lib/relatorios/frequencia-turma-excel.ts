import "server-only";

import * as XLSX from "xlsx";
import type { FrequenciaTurmaDados } from "@/lib/relatorios/frequencia-turma";

// Aba "Frequência": mesma tabela do PDF. Aba "Detalhes": uma linha por
// aluno/aula com o status daquele dia (REGRA da tarefa).
export function gerarExcelFrequenciaTurma(dados: FrequenciaTurmaDados): string {
  const workbook = XLSX.utils.book_new();

  const linhasFrequencia = dados.alunos.map((aluno) => ({
    Aluno: aluno.nome,
    "Total Aulas": aluno.totalAulas,
    Presenças: aluno.presencas,
    Faltas: aluno.faltas,
    "% Frequência": aluno.percentual,
  }));
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(linhasFrequencia), "Frequência");

  const linhasDetalhes = dados.alunos.flatMap((aluno) =>
    aluno.detalhes.map((detalhe) => ({
      Aluno: aluno.nome,
      Aula: detalhe.aulaTitulo,
      Data: detalhe.data,
      Status: detalhe.status,
    })),
  );
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(linhasDetalhes), "Detalhes");

  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
}
