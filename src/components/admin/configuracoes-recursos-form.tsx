"use client";

import { useState, useTransition } from "react";
import { salvarRecursos, type ConfigRecursosValues } from "@/app/admin/configuracoes/actions";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RecursoChave = "gamificacao" | "premios" | "ranking" | "chat" | "certificados";
type CursoTipoChave = "presencial" | "ead" | "hibrido";

const RECURSOS: { chave: RecursoChave; label: string }[] = [
  { chave: "gamificacao", label: "🎮 Gamificação (pontos, badges, ranking)" },
  { chave: "premios", label: "🎁 Prêmios e resgates" },
  { chave: "ranking", label: "🏆 Ranking" },
  { chave: "chat", label: "💬 Chat com admin" },
  { chave: "certificados", label: "📜 Certificados" },
];

const TIPOS: { chave: CursoTipoChave; label: string }[] = [
  { chave: "presencial", label: "Presencial" },
  { chave: "ead", label: "EAD" },
  { chave: "hibrido", label: "Híbrido" },
];

function campo(recurso: RecursoChave, tipo: CursoTipoChave) {
  return `recurso_${recurso}_${tipo}` as keyof ConfigRecursosValues;
}

// Cada switch salva sozinho, ao mudar (mesmo padrão de BannerRow em
// banners-login-form.tsx) — sem botão "Salvar" separado. O FormData enviado
// a cada toggle carrega os 15 valores (não só o que mudou): mais simples que
// um PATCH parcial, e o estado inteiro já vive no client de qualquer forma.
export function ConfiguracoesRecursosForm({ defaultValues }: { defaultValues: ConfigRecursosValues }) {
  const [valores, setValores] = useState(defaultValues);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleToggle(recurso: RecursoChave, tipo: CursoTipoChave, checked: boolean) {
    const chave = campo(recurso, tipo);
    const valoresAnteriores = valores;
    const proximosValores = { ...valores, [chave]: checked };
    setValores(proximosValores);
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      for (const [nome, valor] of Object.entries(proximosValores)) {
        formData.set(nome, String(valor));
      }
      const resultado = await salvarRecursos(formData);
      if (resultado.error) {
        setError(resultado.error);
        setValores(valoresAnteriores);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Recurso</TableHead>
            {TIPOS.map((tipo) => (
              <TableHead key={tipo.chave} className="text-center">
                {tipo.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {RECURSOS.map((recurso) => (
            <TableRow key={recurso.chave}>
              <TableCell className="text-sm">{recurso.label}</TableCell>
              {TIPOS.map((tipo) => {
                const chave = campo(recurso.chave, tipo.chave);
                return (
                  <TableCell key={chave} className="text-center">
                    <Switch
                      checked={valores[chave]}
                      disabled={isPending}
                      onCheckedChange={(checked) => handleToggle(recurso.chave, tipo.chave, checked === true)}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
