import Link from "next/link";
import { GraduationCap, HelpCircle } from "lucide-react";
import { PdfViewerButton } from "@/components/aluno/pdf-viewer-button";
import { MateriaisListButton } from "@/components/aluno/materiais-list-button";
import { ToggleAulaConcluidaButton } from "@/components/aluno/toggle-aula-concluida-button";
import { Button } from "@/components/ui/button";

type Material = { id: string; titulo: string };

type Resumo = {
  tentativasUsadas: number;
  ultimaNota: number | null;
} | null;

export function AulaAcoesBar({
  cursoId,
  moduloId,
  aulaId,
  pdfs,
  pdfsError,
  quizResumo,
  quizHref,
  provaResumo,
  provaHref,
  concluidaInicial,
}: {
  cursoId: string;
  moduloId: string;
  aulaId: string;
  pdfs: Material[];
  pdfsError: boolean;
  quizResumo: Resumo;
  quizHref: string;
  provaResumo: Resumo;
  provaHref: string;
  concluidaInicial: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pdfsError ? (
        <span className="text-destructive text-sm">Materiais indisponíveis.</span>
      ) : (
        <>
          {pdfs.length === 1 && <PdfViewerButton materialId={pdfs[0].id} titulo={pdfs[0].titulo} />}
          {pdfs.length > 1 && <MateriaisListButton materiais={pdfs} />}
        </>
      )}

      {quizResumo && (
        <Link href={quizHref}>
          <Button variant="outline">
            <HelpCircle />
            Quiz — {quizResumo.tentativasUsadas > 0 ? `${quizResumo.ultimaNota}%` : "Disponível"}
          </Button>
        </Link>
      )}

      {provaResumo && (
        <Link href={provaHref}>
          <Button variant="outline">
            <GraduationCap />
            Prova — {provaResumo.tentativasUsadas > 0 ? `${provaResumo.ultimaNota}%` : "Disponível"}
          </Button>
        </Link>
      )}

      <ToggleAulaConcluidaButton
        cursoId={cursoId}
        moduloId={moduloId}
        aulaId={aulaId}
        concluidaInicial={concluidaInicial}
      />
    </div>
  );
}
