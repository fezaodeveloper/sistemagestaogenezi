import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getPainelProfessor } from "@/lib/professor/panel";
import { extractYoutubeVideoId } from "@/lib/materiais/youtube";
import { PdfViewerButtonAdmin } from "@/components/admin/pdf-viewer-button-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProfessorPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const cursos = await getPainelProfessor(supabase);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Painel do Professor</h1>
        <p className="text-muted-foreground text-sm">
          Cursos presenciais e híbridos ativos — materiais para exibir durante a aula (PDF e vídeo) e
          atalho para o chat com os alunos de cada turma.
        </p>
      </div>

      {cursos.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Nenhum curso presencial ou híbrido ativo no momento.
          </CardContent>
        </Card>
      ) : (
        cursos.map((curso) => (
          <Card key={curso.id}>
            <CardHeader>
              <CardTitle>{curso.nome}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h3 className="text-muted-foreground text-sm font-medium">Conteúdo</h3>
                {curso.modulos.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum módulo cadastrado.</p>
                ) : (
                  curso.modulos.map((modulo) => (
                    <details key={modulo.id} className="rounded-lg border px-3 py-2">
                      <summary className="cursor-pointer text-sm font-medium">
                        Módulo {modulo.numero} — {modulo.titulo}
                      </summary>
                      <div className="mt-3 flex flex-col gap-3 border-l pl-4">
                        {modulo.aulas.length === 0 ? (
                          <p className="text-muted-foreground text-xs">Nenhuma aula cadastrada.</p>
                        ) : (
                          modulo.aulas.map((aula) => {
                            const video = aula.materiais.find((m) => m.tipo === "video_youtube");
                            const videoId = video ? extractYoutubeVideoId(video.url) : null;
                            const pdfs = aula.materiais.filter((m) => m.tipo === "pdf");

                            return (
                              <details key={aula.id} className="rounded-md border px-3 py-2">
                                <summary className="cursor-pointer text-sm">
                                  Aula {aula.numero} — {aula.titulo}
                                </summary>
                                <div className="mt-3 flex flex-col gap-3">
                                  {videoId && (
                                    <div className="aspect-video w-full max-w-xl overflow-hidden rounded-lg">
                                      <iframe
                                        className="h-full w-full"
                                        src={`https://www.youtube-nocookie.com/embed/${videoId}?modestbranding=1&rel=0&iv_load_policy=3`}
                                        title={`Vídeo da aula: ${aula.titulo}`}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                      />
                                    </div>
                                  )}
                                  {pdfs.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {pdfs.map((pdf) => (
                                        <PdfViewerButtonAdmin key={pdf.id} materialId={pdf.id} titulo={pdf.titulo} />
                                      ))}
                                    </div>
                                  )}
                                  {!videoId && pdfs.length === 0 && (
                                    <p className="text-muted-foreground text-xs">
                                      Nenhum material disponível para esta aula.
                                    </p>
                                  )}
                                </div>
                              </details>
                            );
                          })
                        )}
                      </div>
                    </details>
                  ))
                )}
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-muted-foreground text-sm font-medium">Turmas</h3>
                {curso.turmas.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma turma ativa.</p>
                ) : (
                  curso.turmas.map((turma) => (
                    <div key={turma.id} className="flex flex-col gap-1">
                      <p className="text-sm font-medium">{turma.nome}</p>
                      {turma.alunos.length === 0 ? (
                        <p className="text-muted-foreground text-xs">Nenhum aluno matriculado.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {turma.alunos.map((aluno) => (
                            <Button
                              key={aluno.id}
                              render={<Link href={`/admin/chat/${aluno.id}`} />}
                              nativeButton={false}
                              variant="outline"
                              size="sm"
                            >
                              <MessageCircle />
                              {aluno.nome ?? "Aluno"}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
