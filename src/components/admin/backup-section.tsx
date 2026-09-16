"use client";

import { useEffect, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { gerarBackup } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STORAGE_KEY = "genezi-ultimo-backup";

function formatDataHora(isoString: string): string {
  const date = new Date(isoString);
  const data = date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const hora = date.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${data} às ${hora}`;
}

// Download via fetch + blob (não um link direto) pra poder mostrar loading
// state nos botões (REGRA da TAREFA) — a Route Handler
// (src/app/admin/configuracoes/backup/route.ts) já devolve o arquivo pronto
// com Content-Disposition; aqui só criamos o link temporário pra disparar o
// download, mesmo padrão de handleGerarBackup logo abaixo.
function BackupDownloadSection() {
  const [baixandoJson, setBaixandoJson] = useState(false);
  const [baixandoExcel, setBaixandoExcel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(formato: "json" | "excel") {
    setError(null);
    const setBaixando = formato === "json" ? setBaixandoJson : setBaixandoExcel;
    setBaixando(true);
    try {
      const response = await fetch(`/admin/configuracoes/backup?formato=${formato}`);
      if (!response.ok) {
        setError("Não foi possível gerar o backup. Tente novamente.");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const hoje = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-genezi-${hoje}.${formato === "json" ? "json" : "xlsx"}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Não foi possível gerar o backup. Tente novamente.");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Exportar dados do sistema</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Exporta alunos, matrículas, turmas, cursos, parcelas, presenças e leads num único
          arquivo, no formato escolhido.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDownload("json")}
            disabled={baixandoJson || baixandoExcel}
          >
            <Download />
            {baixandoJson ? "Gerando..." : "📥 Baixar JSON"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleDownload("excel")}
            disabled={baixandoJson || baixandoExcel}
          >
            <Download />
            {baixandoExcel ? "Gerando..." : "📊 Baixar Excel"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <p className="text-muted-foreground text-xs">
          ⚠️ O backup inclui dados sensíveis. Armazene com segurança.
        </p>
      </CardContent>
    </Card>
  );
}

export function BackupSection() {
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null);
  const [hidratado, setHidratado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Leitura de localStorage só depois de montado — mesmo motivo do padrão
  // em admin-nav-groups.tsx (evita hydration mismatch, já que o servidor
  // nunca tem acesso ao localStorage do navegador).
  useEffect(() => {
    try {
      const salvo = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (salvo) setUltimoBackup(salvo);
    } catch {
      // Sem acesso a localStorage (modo privado, etc.) — só não mostra a
      // data do último backup, não impede gerar um novo.
    }
    setHidratado(true);
  }, []);

  function handleGerarBackup() {
    setError(null);
    startTransition(async () => {
      const resultado = await gerarBackup();
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }

      const conteudo = JSON.stringify(resultado.data, null, 2);
      const blob = new Blob([conteudo], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const hoje = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-genezi-${hoje}.json`;
      link.click();
      URL.revokeObjectURL(url);

      const agora = new Date().toISOString();
      try {
        localStorage.setItem(STORAGE_KEY, agora);
      } catch {
        // Best-effort: o backup já foi baixado, só não fica registrado
        // "último backup em" se o localStorage não estiver disponível.
      }
      setUltimoBackup(agora);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-4 py-4">
          <p className="text-muted-foreground text-sm">
            O backup exporta os dados principais do sistema em formato JSON. Recomendamos fazer
            backup semanalmente e armazenar em local seguro.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleGerarBackup} disabled={isPending}>
              <Download />
              {isPending ? "Gerando..." : "Gerar backup agora"}
            </Button>
            {hidratado && (
              <span className="text-muted-foreground text-sm">
                {ultimoBackup ? `Último backup: ${formatDataHora(ultimoBackup)}` : "Nenhum backup feito ainda."}
              </span>
            )}
          </div>

          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Recomendações de segurança</p>
            <ul className="text-muted-foreground list-disc pl-5 text-sm">
              <li>Faça backup semanalmente</li>
              <li>Armazene em Google Drive ou outro serviço na nuvem</li>
              <li>Nunca compartilhe o arquivo de backup</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <BackupDownloadSection />
    </div>
  );
}
