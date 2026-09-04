"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Maximize2 } from "lucide-react";
import { extractYoutubeVideoId } from "@/lib/materiais/youtube";
import type { AulaPainel, CursoPainel, ModuloPainel } from "@/lib/professor/panel";
import { PdfViewerButtonAdmin } from "@/components/admin/pdf-viewer-button-admin";
import { ProfessorFullscreen } from "@/components/admin/professor-fullscreen";
import { Capa } from "@/components/aluno/capa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ===== NÍVEL 1 — grade de cursos =====

function CursoCard({ curso, onSelecionar }: { curso: CursoPainel; onSelecionar: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelecionar}
      className="block w-full appearance-none border-0 bg-transparent p-0 text-left"
    >
      <Card className="group hover:bg-accent/50 hover:shadow-lg hover:shadow-foreground/10 gap-0 overflow-hidden py-0 transition duration-300">
        <Capa
          capaUrl={curso.capaUrl}
          nome={curso.nome}
          className="w-full rounded-none transition-transform duration-300 ease-out group-hover:scale-105"
        />
        <CardContent className="flex flex-col gap-1.5 p-3">
          <h3 className="line-clamp-2 text-sm font-medium">{curso.nome}</h3>
          <Badge variant="secondary" className="w-fit text-xs">
            {curso.modulos.length} {curso.modulos.length === 1 ? "módulo" : "módulos"}
          </Badge>
        </CardContent>
      </Card>
    </button>
  );
}

// ===== NÍVEL 2 — grade de módulos do curso =====

function ModuloCard({ modulo, onSelecionar }: { modulo: ModuloPainel; onSelecionar: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelecionar}
      className="block w-full appearance-none border-0 bg-transparent p-0 text-left"
    >
      <Card className="hover:bg-accent/50 overflow-hidden pt-0 transition-colors">
        <Capa
          capaUrl={modulo.capaUrl}
          nome={modulo.titulo}
          aspect="16/9"
          icone={BookOpen}
          className="w-full rounded-none"
        />
        <CardHeader>
          <CardTitle>
            Módulo {modulo.numero} — {modulo.titulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Badge variant="secondary">
            {modulo.aulas.length} {modulo.aulas.length === 1 ? "aula" : "aulas"}
          </Badge>
        </CardContent>
      </Card>
    </button>
  );
}

// ===== NÍVEL 3 — lista de aulas + player =====

// Player com botão de tela cheia próprio (TAREFA: overlay a 90%) — o
// iframe embutido continua com allowFullScreen, então o fullscreen nativo
// do YouTube também funciona independente deste botão.
function VideoPlayerProfessor({ videoId, titulo }: { videoId: string; titulo: string }) {
  const [fullscreen, setFullscreen] = useState(false);
  const src = `https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3`;

  return (
    <div className="flex flex-col gap-2">
      <div className="aspect-video w-full overflow-hidden rounded-lg">
        <iframe
          className="h-full w-full"
          src={src}
          title={`Vídeo da aula: ${titulo}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setFullscreen(true)}>
        <Maximize2 />
        Tela cheia
      </Button>

      {fullscreen && (
        <ProfessorFullscreen titulo={titulo} onClose={() => setFullscreen(false)}>
          <iframe
            className="aspect-video h-full max-h-full w-full max-w-full"
            src={src}
            title={`Vídeo da aula: ${titulo}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </ProfessorFullscreen>
      )}
    </div>
  );
}

function AulaConteudo({ aula }: { aula: AulaPainel }) {
  const video = aula.materiais.find((m) => m.tipo === "video_youtube");
  const videoId = video ? extractYoutubeVideoId(video.url) : null;
  const pdfs = aula.materiais.filter((m) => m.tipo === "pdf");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Aula {aula.numero} — {aula.titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {videoId && <VideoPlayerProfessor videoId={videoId} titulo={aula.titulo} />}
        {pdfs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {pdfs.map((pdf) => (
              <PdfViewerButtonAdmin key={pdf.id} materialId={pdf.id} titulo={pdf.titulo} />
            ))}
          </div>
        )}
        {!videoId && pdfs.length === 0 && (
          <p className="text-muted-foreground text-sm">Nenhum material disponível para esta aula.</p>
        )}
      </CardContent>
    </Card>
  );
}

function NivelModulo({
  modulo,
  onVoltar,
}: {
  modulo: ModuloPainel;
  onVoltar: () => void;
}) {
  const [aulaSelecionadaId, setAulaSelecionadaId] = useState<string | null>(modulo.aulas[0]?.id ?? null);
  const aulaSelecionada = modulo.aulas.find((a) => a.id === aulaSelecionadaId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onVoltar}>
          <ArrowLeft />
          Voltar
        </Button>
        <h2 className="text-xl font-semibold">
          Módulo {modulo.numero} — {modulo.titulo}
        </h2>
      </div>

      {modulo.aulas.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhuma aula cadastrada neste módulo.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_7fr]">
          <div className="flex flex-col gap-1.5">
            {modulo.aulas.map((aula) => (
              <button
                key={aula.id}
                type="button"
                onClick={() => setAulaSelecionadaId(aula.id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  aula.id === aulaSelecionadaId
                    ? "border-primary bg-primary/10 font-medium"
                    : "hover:bg-accent/50",
                )}
              >
                Aula {aula.numero} — {aula.titulo}
              </button>
            ))}
          </div>

          <div>{aulaSelecionada && <AulaConteudo aula={aulaSelecionada} />}</div>
        </div>
      )}
    </div>
  );
}

function NivelCurso({
  curso,
  onVoltar,
}: {
  curso: CursoPainel;
  onVoltar: () => void;
}) {
  const [moduloSelecionado, setModuloSelecionado] = useState<ModuloPainel | null>(null);

  if (moduloSelecionado) {
    return <NivelModulo modulo={moduloSelecionado} onVoltar={() => setModuloSelecionado(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button type="button" variant="ghost" size="sm" className="-ml-2" onClick={onVoltar}>
          <ArrowLeft />
          Voltar
        </Button>
        <h2 className="text-xl font-semibold">{curso.nome}</h2>
      </div>

      {curso.modulos.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhum módulo cadastrado para este curso.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curso.modulos.map((modulo) => (
            <ModuloCard key={modulo.id} modulo={modulo} onSelecionar={() => setModuloSelecionado(modulo)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProfessorView({ cursos }: { cursos: CursoPainel[] }) {
  const [busca, setBusca] = useState("");
  const [cursoSelecionado, setCursoSelecionado] = useState<CursoPainel | null>(null);

  const cursosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return cursos;
    return cursos.filter((curso) => curso.nome.toLowerCase().includes(termo));
  }, [cursos, busca]);

  if (cursoSelecionado) {
    return <NivelCurso curso={cursoSelecionado} onVoltar={() => setCursoSelecionado(null)} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Input
        placeholder="Buscar curso..."
        value={busca}
        onChange={(event) => setBusca(event.target.value)}
        className="max-w-sm"
      />

      {cursosFiltrados.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {cursos.length === 0 ? "Nenhum curso presencial ou híbrido ativo no momento." : "Nenhum curso encontrado."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {cursosFiltrados.map((curso) => (
            <CursoCard key={curso.id} curso={curso} onSelecionar={() => setCursoSelecionado(curso)} />
          ))}
        </div>
      )}
    </div>
  );
}
