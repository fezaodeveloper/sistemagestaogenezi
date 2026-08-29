"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { removerLogoEscola, salvarLogoEscola } from "@/app/admin/configuracoes/actions";
import { createClient } from "@/lib/supabase/client";
import {
  ESCOLA_LOGO_BUCKET,
  ESCOLA_LOGO_EXTENSOES_POR_TIPO,
  ESCOLA_LOGO_TAMANHO_MAXIMO_BYTES,
  ESCOLA_LOGO_TIPOS_ACEITOS,
} from "@/lib/storage/escola-logo";
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

export function LogoEscolaForm({
  defaultValues,
}: {
  defaultValues: { escola_logo_url: string | null; escola_logo_path: string | null };
}) {
  const [logoUrl, setLogoUrl] = useState(defaultValues.escola_logo_url);
  const [logoPath, setLogoPath] = useState(defaultValues.escola_logo_path);
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

    if (!ESCOLA_LOGO_TIPOS_ACEITOS.includes(file.type)) {
      setError("Formato não aceito. Envie um arquivo PNG, JPG, JPEG, SVG ou WebP.");
      return;
    }
    if (file.size > ESCOLA_LOGO_TAMANHO_MAXIMO_BYTES) {
      setError("O arquivo pode ter no máximo 2MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();

      // Remove o arquivo anterior antes de subir o novo — evita acúmulo de
      // arquivos órfãos no bucket (ver TAREFA 5).
      if (logoPath) {
        await supabase.storage.from(ESCOLA_LOGO_BUCKET).remove([logoPath]);
      }

      // Nome fixo (logo.{extensao}): anti-acúmulo, sempre sobrescreve o
      // arquivo anterior em vez de acumular um novo nome por upload.
      const extensao = ESCOLA_LOGO_EXTENSOES_POR_TIPO[file.type];
      const path = `logo.${extensao}`;

      const { error: uploadError } = await supabase.storage.from(ESCOLA_LOGO_BUCKET).upload(path, file);
      if (uploadError) {
        setError("Não foi possível enviar a logo. Tente novamente.");
        return;
      }

      const { data: urlData } = supabase.storage.from(ESCOLA_LOGO_BUCKET).getPublicUrl(path);
      // Nome fixo faz a URL pública não mudar entre uploads — o `?v=` evita
      // que o navegador continue mostrando a imagem antiga em cache.
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const resultado = await salvarLogoEscola(publicUrl, path);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }

      setLogoUrl(publicUrl);
      setLogoPath(path);
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover() {
    setError(null);
    setRemovendo(true);
    try {
      if (logoPath) {
        const supabase = createClient();
        await supabase.storage.from(ESCOLA_LOGO_BUCKET).remove([logoPath]);
      }

      const resultado = await removerLogoEscola();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }

      setLogoUrl(null);
      setLogoPath(null);
      setExcluirOpen(false);
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept={ESCOLA_LOGO_TIPOS_ACEITOS.join(",")}
        onChange={handleArquivoChange}
        className="hidden"
      />

      <div className="flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto, sem necessidade de otimização do next/image aqui
          <img src={logoUrl} alt="Logo da escola" className="h-30 w-30 rounded-xl border object-contain" />
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className="text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 flex h-30 w-30 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-muted-foreground/30 text-center transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <Upload className="size-5" />
            <span className="px-2 text-xs">{enviando ? "Enviando..." : "Clique para adicionar a logo"}</span>
          </button>
        )}

        {logoUrl && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={enviando}
              onClick={() => inputRef.current?.click()}
            >
              {enviando ? "Enviando..." : "Trocar logo"}
            </Button>

            <AlertDialog open={excluirOpen} onOpenChange={setExcluirOpen}>
              <AlertDialogTrigger
                render={
                  <Button type="button" variant="ghost" size="sm">
                    Remover
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover logo da escola</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja remover a logo? O arquivo também será removido do Storage e as
                    telas de login voltam a mostrar o ícone padrão.
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
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
