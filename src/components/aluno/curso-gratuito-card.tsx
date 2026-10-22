import { ExternalLink } from "lucide-react";
import { Capa } from "@/components/aluno/capa";
import { Card, CardContent } from "@/components/ui/card";

export type CursoGratuitoAluno = {
  id: string;
  nome: string;
  descricao: string | null;
  fotoUrl: string | null;
  url: string;
};

// Curso gratuito bônus (/admin/cursos-gratuitos) hospedado numa plataforma externa — sem
// módulos/aulas nesta plataforma, então o card nunca fica bloqueado: é só um link de saída.
// Normaliza a URL salva sem protocolo (ex.: "plataforma.com/curso") pra sempre virar https://
// — defensivo contra dado antigo/editado direto no banco, já que o form novo
// (curso-gratuito-form.tsx) exige protocolo via <Input type="url">.
function urlSegura(url: string): string {
  return url.startsWith("http") ? url : `https://${url}`;
}

export function CursoGratuitoCard({ curso }: { curso: CursoGratuitoAluno }) {
  return (
    <a
      href={urlSegura(curso.url)}
      target="_blank"
      rel="noopener noreferrer"
      className="group block"
    >
      <Card className="gap-0 overflow-hidden py-0 border-amber-500/40 transition duration-300 group-hover:scale-105 group-hover:shadow-lg group-hover:shadow-foreground/10">
        <div className="relative aspect-video w-full overflow-hidden">
          <Capa
            capaUrl={curso.fotoUrl}
            nome={curso.nome}
            aspect="16/9"
            className="h-full w-full rounded-none object-cover transition-transform duration-300 ease-out group-hover:scale-110"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/10 to-transparent" />
          <h3 className="absolute right-3 bottom-2 left-3 line-clamp-2 text-base font-semibold text-white drop-shadow">
            {curso.nome}
          </h3>
        </div>
        <CardContent className="flex flex-col gap-3 p-4">
          {curso.descricao && (
            <p className="text-muted-foreground line-clamp-2 text-xs">{curso.descricao}</p>
          )}
          <span className="flex items-center justify-center gap-1.5 rounded-md bg-linear-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white transition-opacity group-hover:opacity-90">
            Acessar Curso
            <ExternalLink className="size-4" />
          </span>
        </CardContent>
      </Card>
    </a>
  );
}
