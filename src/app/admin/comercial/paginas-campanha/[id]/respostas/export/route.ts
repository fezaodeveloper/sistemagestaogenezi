import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getCampanhaPagina } from "@/lib/campanha-paginas/campanha-paginas";
import {
  RESPOSTA_CHAVE_DECLARACAO,
  RESPOSTA_CHAVE_LGPD,
  formatarRespostaCampanha,
  type CampanhaResposta,
} from "@/lib/campanha-paginas/schema";

// Mesmo padrão de export server-side (SheetJS) do backup geral do sistema —
// ver src/app/admin/configuracoes/backup/route.ts.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;

  const supabase = await createClient();
  const pagina = await getCampanhaPagina(supabase, id);
  if (!pagina) {
    return NextResponse.json({ error: "Página não encontrada." }, { status: 404 });
  }

  const { data } = await supabase
    .from("campanha_respostas")
    .select("*")
    .eq("pagina_id", id)
    .order("created_at", { ascending: false });

  const respostas = (data as CampanhaResposta[] | null) ?? [];

  const perguntaPorId = new Map<string, string>();
  for (const etapa of pagina.etapas) {
    for (const questao of etapa.questoes) {
      perguntaPorId.set(questao.id, questao.pergunta);
    }
  }

  // A etapa de confirmação registra os dois aceites mesmo com os toggles da
  // aba Termos desligados.
  const temConfirmacao = pagina.etapas.some((etapa) => etapa.tipo === "confirmacao");

  const linhas = respostas.map((resposta) => {
    const linha: Record<string, unknown> = {
      Nome: resposta.nome,
      WhatsApp: resposta.whatsapp,
      Idade: resposta.idade ?? "",
      Email: resposta.email ?? "",
      Estado: resposta.estado ?? "",
      Cidade: resposta.cidade ?? "",
      "Data/Hora": new Date(resposta.created_at).toLocaleString("pt-BR"),
    };

    for (const [questaoId, pergunta] of perguntaPorId) {
      linha[pergunta] = formatarRespostaCampanha(resposta.respostas?.[questaoId]);
    }

    if (pagina.mostrar_lgpd || temConfirmacao) linha["Aceite LGPD"] = resposta.respostas?.[RESPOSTA_CHAVE_LGPD] ? "Sim" : "Não";
    if (pagina.mostrar_declaracao || temConfirmacao) linha["Aceite Declaração"] = resposta.respostas?.[RESPOSTA_CHAVE_DECLARACAO] ? "Sim" : "Não";

    return linha;
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(linhas), "Respostas");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="respostas-${pagina.slug}.xlsx"`,
    },
  });
}
