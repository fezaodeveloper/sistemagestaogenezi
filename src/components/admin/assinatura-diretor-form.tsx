"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import {
  removerAssinaturaAdmin,
  salvarAssinaturaAdmin,
  salvarNomeDiretor,
} from "@/app/admin/configuracoes/actions";
import { createClient } from "@/lib/supabase/client";
import {
  ASSINATURA_ADMIN_BUCKET,
  ASSINATURA_ADMIN_EXTENSOES_POR_TIPO,
  ASSINATURA_ADMIN_MAX_BYTES,
  ASSINATURA_ADMIN_TIPOS_ACEITOS,
} from "@/lib/storage/assinatura-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function AssinaturaDiretorForm({
  defaultValues,
}: {
  defaultValues: {
    assinatura_admin_url: string | null;
    assinatura_admin_path: string | null;
    nome_diretor: string | null;
  };
}) {
  const [assinaturaUrl, setAssinaturaUrl] = useState(defaultValues.assinatura_admin_url);
  const [assinaturaPath, setAssinaturaPath] = useState(defaultValues.assinatura_admin_path);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [excluirOpen, setExcluirOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [nomeDiretor, setNomeDiretor] = useState(defaultValues.nome_diretor ?? "");
  const [isPendingNome, startTransitionNome] = useTransition();
  const [erroNome, setErroNome] = useState<string | null>(null);
  const [salvoNome, setSalvoNome] = useState(false);

  async function handleArquivoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (!ASSINATURA_ADMIN_TIPOS_ACEITOS.includes(file.type)) {
      setError("Formato não aceito. Use PNG, JPG/JPEG ou WebP.");
      return;
    }
    if (file.size > ASSINATURA_ADMIN_MAX_BYTES) {
      setError("Arquivo muito grande. Máximo permitido: 2MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();

      // Nome fixo (assinatura.{extensao}): mesma lógica anti-acúmulo da
      // logo da escola — upsert:true sobrescreve direto, sem remoção prévia.
      const extensao = ASSINATURA_ADMIN_EXTENSOES_POR_TIPO[file.type];
      const path = `assinatura.${extensao}`;

      const { error: uploadError } = await supabase.storage
        .from(ASSINATURA_ADMIN_BUCKET)
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: true,
        });
      if (uploadError) {
        setError(`Erro no upload: ${uploadError.message}`);
        return;
      }

      const { data: urlData } = supabase.storage.from(ASSINATURA_ADMIN_BUCKET).getPublicUrl(path);
      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const resultado = await salvarAssinaturaAdmin(publicUrl, path);
      if (resultado.error) {
        setError("Assinatura enviada mas não foi possível salvar. Tente novamente.");
        return;
      }

      setAssinaturaUrl(publicUrl);
      setAssinaturaPath(path);
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover() {
    setError(null);
    setRemovendo(true);
    try {
      if (assinaturaPath) {
        const supabase = createClient();
        await supabase.storage.from(ASSINATURA_ADMIN_BUCKET).remove([assinaturaPath]);
      }

      const resultado = await removerAssinaturaAdmin();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }

      setAssinaturaUrl(null);
      setAssinaturaPath(null);
      setExcluirOpen(false);
    } finally {
      setRemovendo(false);
    }
  }

  function handleSalvarNome() {
    setErroNome(null);
    setSalvoNome(false);
    startTransitionNome(async () => {
      const resultado = await salvarNomeDiretor(nomeDiretor);
      if (resultado.error) {
        setErroNome(resultado.error);
        return;
      }
      setSalvoNome(true);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ASSINATURA_ADMIN_TIPOS_ACEITOS.join(",")}
          onChange={handleArquivoChange}
          className="hidden"
        />

        <div className="flex items-center gap-4">
          {assinaturaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto, sem necessidade de otimização do next/image aqui
            <img
              src={assinaturaUrl}
              alt="Assinatura do diretor"
              className="h-20 w-40 rounded-xl border bg-white object-contain"
            />
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={enviando}
              className="text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 flex h-20 w-40 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-muted-foreground/30 text-center transition-colors disabled:pointer-events-none disabled:opacity-50"
            >
              <Upload className="size-5" />
              <span className="px-2 text-xs">{enviando ? "Enviando..." : "Adicionar assinatura"}</span>
            </button>
          )}

          {assinaturaUrl && (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={enviando}
                onClick={() => inputRef.current?.click()}
              >
                {enviando ? "Enviando..." : "Trocar assinatura"}
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
                    <AlertDialogTitle>Remover assinatura do diretor</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tem certeza que deseja remover a imagem da assinatura? Os contratos passam a
                      mostrar uma linha em branco no lugar dela.
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
        <p className="text-muted-foreground text-xs">PNG transparente recomendado. Máximo 2MB.</p>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <Label htmlFor="nome-diretor">Nome do diretor/responsável</Label>
        <Input
          id="nome-diretor"
          value={nomeDiretor}
          onChange={(event) => {
            setNomeDiretor(event.target.value);
            setSalvoNome(false);
          }}
          placeholder="Ex.: João da Silva"
        />
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" disabled={isPendingNome} onClick={handleSalvarNome}>
            {isPendingNome ? "Salvando..." : "Salvar nome"}
          </Button>
          {salvoNome && !erroNome && <span className="text-muted-foreground text-sm">Salvo.</span>}
        </div>
        {erroNome && (
          <p role="alert" className="text-destructive text-sm">
            {erroNome}
          </p>
        )}
      </div>
    </div>
  );
}
