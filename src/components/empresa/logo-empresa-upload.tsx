"use client";

import { useRef, useState } from "react";
import { Building2, Pencil } from "lucide-react";
import { removerLogoEmpresa, salvarLogoEmpresa } from "@/app/empresa/(protegido)/perfil/actions";
import { createClient } from "@/lib/supabase/client";
import {
  LOGO_CONECTA_BUCKET,
  LOGO_CONECTA_EXTENSOES_POR_TIPO,
  LOGO_CONECTA_MAX_BYTES,
  LOGO_CONECTA_TIPOS_ACEITOS,
} from "@/lib/storage/conecta";
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

export function LogoEmpresaUpload({
  profileId,
  logoUrlInicial,
}: {
  profileId: string;
  logoUrlInicial: string | null;
}) {
  const [logoUrl, setLogoUrl] = useState(logoUrlInicial);
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

    if (!LOGO_CONECTA_TIPOS_ACEITOS.includes(file.type)) {
      setError("Formato não aceito. Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > LOGO_CONECTA_MAX_BYTES) {
      setError("Arquivo muito grande. Máximo permitido: 2MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      const extensao = LOGO_CONECTA_EXTENSOES_POR_TIPO[file.type];
      const path = `logos/${profileId}.${extensao}`;

      const { error: uploadError } = await supabase.storage.from(LOGO_CONECTA_BUCKET).upload(path, file, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });
      if (uploadError) {
        setError(`Erro no upload: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from(LOGO_CONECTA_BUCKET).getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const resultado = await salvarLogoEmpresa(publicUrl, path);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }

      setLogoUrl(publicUrl);
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover() {
    setError(null);
    setRemovendo(true);
    try {
      const resultado = await removerLogoEmpresa();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setLogoUrl(null);
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
        accept={LOGO_CONECTA_TIPOS_ACEITOS.join(",")}
        onChange={handleArquivoChange}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando}
        className="group hover:border-primary/50 relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted transition-colors disabled:pointer-events-none disabled:opacity-50"
      >
        {logoUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto */}
            <img src={logoUrl} alt="Logo da empresa" className="size-full object-contain" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <Pencil className="size-5 text-white" />
            </div>
          </>
        ) : (
          <Building2 className="text-muted-foreground size-7" />
        )}
      </button>

      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={enviando}
          className="text-muted-foreground hover:text-foreground w-fit text-sm underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50"
        >
          {enviando ? "Enviando..." : "Alterar logo"}
        </button>
        {logoUrl && (
          <AlertDialog open={excluirOpen} onOpenChange={setExcluirOpen}>
            <AlertDialogTrigger
              render={
                <Button type="button" variant="ghost" size="sm" className="text-destructive w-fit">
                  Remover logo
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover logo da empresa</AlertDialogTitle>
                <AlertDialogDescription>
                  Deseja remover a logo? Esta ação não pode ser desfeita.
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
        <p className="text-muted-foreground text-xs">JPG, PNG ou WebP. Máximo 2MB.</p>
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
