import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

// CSV dos envios de uma campanha (um por destinatário). Separador ";" e BOM UTF-8: é o
// que o Excel em português abre certo, com acentos.

const PAGINA = 1000;

function celula(valor: string | null | undefined): string {
  const texto = (valor ?? "").replace(/\r?\n/g, " ");
  // Aspas dobradas; e aspas em volta sempre. Evita "injeção de fórmula" no Excel (=, +, -, @).
  const seguro = /^[=+\-@]/.test(texto) ? `'${texto}` : texto;
  return `"${seguro.replace(/"/g, '""')}"`;
}

const STATUS_ROTULO: Record<string, string> = { pendente: "Pendente", enviado: "Enviado", erro: "Erro" };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Campanha inválida", { status: 400 });

  const supabase = await createClient();
  const { data: campanha } = await supabase.from("email_campanhas_marketing").select("nome").eq("id", id).maybeSingle();
  if (!campanha) return new NextResponse("Campanha não encontrada", { status: 404 });

  const linhas: string[] = [["E-mail", "Nome", "Status", "Erro", "Enviado em"].map(celula).join(";")];
  for (let de = 0; de < 500_000; de += PAGINA) {
    const { data, error } = await supabase
      .from("email_campanhas_envios")
      .select("email, nome, status, erro, enviado_at")
      .eq("campanha_id", id)
      .order("created_at")
      .order("id")
      .range(de, de + PAGINA - 1);
    if (error) return new NextResponse("Não foi possível gerar o arquivo", { status: 500 });

    for (const envio of data ?? []) {
      linhas.push(
        [
          celula(envio.email),
          celula(envio.nome),
          celula(STATUS_ROTULO[envio.status as string] ?? (envio.status as string)),
          celula(envio.erro),
          celula(envio.enviado_at ? new Date(envio.enviado_at as string).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : ""),
        ].join(";"),
      );
    }
    if ((data ?? []).length < PAGINA) break;
  }

  const nomeArquivo = `envios-${String(campanha.nome).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "campanha"}.csv`;
  return new NextResponse("﻿" + linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
