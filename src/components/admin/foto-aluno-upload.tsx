"use client";

import { useRef, useState } from "react";
import { Pencil, User } from "lucide-react";
import { removerFotoAluno, salvarFotoAluno } from "@/app/admin/alunos/actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const FOTO_ALUNO_BUCKET = "fotos-alunos";
const FOTO_ALUNO_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const FOTO_ALUNO_TIPOS_ACEITOS = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

export function FotoAlunoUpload({
  alunoId,
  fotoUrlInicial,
}: {
  alunoId: string;
  fotoUrlInicial: string | null;
}) {
  const [fotoUrl, setFotoUrl] = useState(fotoUrlInicial);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleArquivoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!FOTO_ALUNO_TIPOS_ACEITOS.includes(file.type)) {
      setError("Formato não aceito. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > FOTO_ALUNO_MAX_BYTES) {
      setError("Arquivo muito grande. Máximo permitido: 5MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      // Nome fixo (fotos/{aluno_id}.jpg): upsert sobrescreve direto, sem
      // precisar remover antes — mesmo padrão já usado pela logo da
      // escola e pela assinatura do diretor neste projeto (upsert:true é
      // a solução, não "remover antes" — ver histórico dessas duas
      // features: "remover antes" foi tentado e trocado por upsert
      // justamente por gerar "resource already exists").
      const path = `fotos/${alunoId}.jpg`;

      const { error: uploadError } = await supabase.storage.from(FOTO_ALUNO_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });
      if (uploadError) {
        setError(`Erro no upload: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from(FOTO_ALUNO_BUCKET).getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const resultado = await salvarFotoAluno(alunoId, publicUrl, path);
      if (resultado.error) {
        setError("Foto enviada mas não foi possível salvar. Tente novamente.");
        return;
      }

      setFotoUrl(publicUrl);
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover() {
    setError(null);
    setRemovendo(true);
    try {
      const resultado = await removerFotoAluno(alunoId);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setFotoUrl(null);
      setExcluirOpen(false);
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <input
        ref={inputRef}
        type="file"
        accept={FOTO_ALUNO_TIPOS_ACEITOS.join(",")}
        onChange={handleArquivoChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        className="group hover:border-primary/50 relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-muted transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        {fotoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto */}
            <img src={fotoUrl} alt="Foto do aluno" className="size-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Pencil className="size-5 text-white" />
            </div>
          </>
        ) : (
          <User className="text-muted-foreground size-7" />
        )}
      </button>

      <div className="flex flex-col gap-1">
        {!fotoUrl && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
          >
            {enviando ? "Enviando..." : "Adicionar foto"}
          </button>
        )}
        {fotoUrl && (
          <AlertDialog open={excluirOpen} onOpenChange={setExcluirOpen}>
            <AlertDialogTrigger
              render={
                <Button type="button" variant="ghost" size="sm" className="w-fit">
                  Remover foto
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover foto do aluno</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja remover a foto? A lista de alunos volta a mostrar as
                  iniciais do nome no lugar dela.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" disabled={removendo} onClick={handleRemover}>
                  {removendo ? "Removendo..." : "Remover"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <p className="text-muted-foreground text-xs">JPG, PNG ou WebP. Máximo 5MB.</p>
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
