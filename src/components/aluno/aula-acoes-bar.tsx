import Link from "next/link";
import { ArrowRight, ExternalLink, GraduationCap, HelpCircle } from "lucide-react";
import { PdfViewerButton } from "@/components/aluno/pdf-viewer-button";
import { MateriaisListButton } from "@/components/aluno/materiais-list-button";
import { ToggleAulaConcluidaButton } from "@/components/aluno/toggle-aula-concluida-button";
import { Button } from "@/components/ui/button";

type Material = { id: string; titulo: string };

type LinkMaterial = { id: string; titulo: string; url: string };

// Defensivo: a criação pelo admin já exige URL completa (z.url() em
// materialUrlFormSchema), mas uma linha editada direto no banco sem
// protocolo não pode virar um link quebrado pro aluno.
function urlSegura(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

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
  links,
  linksError,
  quizResumo,
  quizHref,
  provaResumo,
  provaHref,
  concluidaInicial,
  proximaAulaHref,
}: {
  cursoId: string;
  moduloId: string;
  aulaId: string;
  pdfs: Material[];
  pdfsError: boolean;
  links: LinkMaterial[];
  linksError: boolean;
  quizResumo: Resumo;
  quizHref: string;
  provaResumo: Resumo;
  provaHref: string;
  concluidaInicial: boolean;
  // Ausente/null = aula é a última do curso, o botão some.
  proximaAulaHref?: string | null;
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

      {linksError ? (
        <span className="text-destructive text-sm">Links indisponíveis.</span>
      ) : (
        links.map((link) => (
          <Button
            key={link.id}
            variant="outline"
            nativeButton={false}
            render={<a href={urlSegura(link.url)} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink />
            {link.titulo}
          </Button>
        ))
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

      {/* Mesma linha do "Aula concluída" (row acima é flex-wrap com gap) — ver CLAUDE.md/pedido:
          [Aula concluída ✓] [Próxima aula →] lado a lado. */}
      {proximaAulaHref && (
        <Button render={<Link href={proximaAulaHref} />} nativeButton={false}>
          Próxima aula
          <ArrowRight />
        </Button>
      )}
    </div>
  );
}
