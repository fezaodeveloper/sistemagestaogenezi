"use client";

import Link from "next/link";
import {
  UserPlus,
  ClipboardCheck,
  Wallet,
  FileBarChart,
  CalendarDays,
  GraduationCap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ATALHOS = [
  { href: "/admin/matriculas/nova", label: "Nova matrícula", icone: GraduationCap },
  { href: "/admin/alunos/novo", label: "Novo aluno", icone: UserPlus },
  { href: "/admin/turmas", label: "Registrar chamada", icone: ClipboardCheck, sublabel: "Escolha a turma e abra a aba Presenças" },
  { href: "/admin/financeiro", label: "Ver financeiro", icone: Wallet },
  { href: "/admin/relatorios/academico", label: "Ver relatórios", icone: FileBarChart },
  { href: "/admin/calendario", label: "Ver calendário", icone: CalendarDays },
] as const;

export function AtalhosRapidos() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Atalhos rápidos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ATALHOS.map((atalho) => {
          const Icone = atalho.icone;
          return (
            <Link
              key={atalho.href + atalho.label}
              href={atalho.href}
              className="hover:bg-accent/50 hover:border-primary/30 flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-colors"
            >
              <Icone className="text-primary size-5" />
              <span className="text-sm font-medium">{atalho.label}</span>
              {"sublabel" in atalho && (
                <span className="text-muted-foreground text-xs">{atalho.sublabel}</span>
              )}
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
