"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  extrairVimeoId,
  extrairYoutubeId,
  TREINAMENTO_CATEGORIAS,
  TREINAMENTO_CATEGORIA_LABELS,
  TREINAMENTO_STATUSES,
  TREINAMENTO_STATUS_LABELS,
  TREINAMENTO_TIPOS_VIDEO,
  TREINAMENTO_TIPO_VIDEO_LABELS,
  type TreinamentoCategoria,
  type TreinamentoStatus,
  type TreinamentoTipoVideo,
} from "@/lib/treinamentos/schema";
import type { TreinamentoFormState } from "@/app/admin/treinamentos/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Salvando..." : label}
    </Button>
  );
}

export function TreinamentoForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (state: TreinamentoFormState, formData: FormData) => Promise<TreinamentoFormState>;
  defaultValues?: {
    titulo: string;
    descricao: string;
    categoria: TreinamentoCategoria;
    tipo_video: TreinamentoTipoVideo;
    youtube_url: string;
    embed_codigo: string;
    status: TreinamentoStatus;
    ordem: number;
  };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState<TreinamentoFormState, FormData>(action, undefined);

  const values = state?.values ?? {
    titulo: defaultValues?.titulo ?? "",
    descricao: defaultValues?.descricao ?? "",
    categoria: defaultValues?.categoria ?? "geral",
    tipo_video: defaultValues?.tipo_video ?? "youtube",
    youtube_url: defaultValues?.youtube_url ?? "",
    embed_codigo: defaultValues?.embed_codigo ?? "",
    status: defaultValues?.status ?? "ativo",
    ordem: String(defaultValues?.ordem ?? 0),
  };

  const [categoria, setCategoria] = useState<string>(values.categoria);
  const [status, setStatus] = useState<string>(values.status);
  const [tipoVideo, setTipoVideo] = useState<string>(values.tipo_video);
  const [youtubeUrl, setYoutubeUrl] = useState(values.youtube_url);
  const [embedCodigo, setEmbedCodigo] = useState(values.embed_codigo);

  const videoId = tipoVideo === "youtube" ? extrairYoutubeId(youtubeUrl) : null;
  const vimeoId = tipoVideo === "vimeo" ? extrairVimeoId(youtubeUrl) : null;

  return (
    <form
      key={JSON.stringify(state?.values)}
      action={formAction}
      className="flex max-w-xl flex-col gap-5"
    >
      <Card>
        <CardHeader>
          <CardTitle>Treinamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="titulo">Título</Label>
            <Input id="titulo" name="titulo" defaultValue={values.titulo} required />
            {state?.errors?.titulo && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.titulo[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              name="descricao"
              rows={3}
              defaultValue={values.descricao}
              placeholder="Opcional"
            />
            {state?.errors?.descricao && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.descricao[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="categoria">Categoria</Label>
            <Select
              name="categoria"
              items={TREINAMENTO_CATEGORIA_LABELS}
              value={categoria}
              onValueChange={(value) => setCategoria(value as string)}
            >
              <SelectTrigger id="categoria" className="w-full">
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {TREINAMENTO_CATEGORIAS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {TREINAMENTO_CATEGORIA_LABELS[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {state?.errors?.categoria && (
              <p role="alert" className="text-destructive text-sm">
                {state.errors.categoria[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo_video">Tipo de vídeo</Label>
            <Select
              name="tipo_video"
              items={TREINAMENTO_TIPO_VIDEO_LABELS}
              value={tipoVideo}
              onValueChange={(value) => setTipoVideo(value as string)}
            >
              <SelectTrigger id="tipo_video" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TREINAMENTO_TIPOS_VIDEO.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {TREINAMENTO_TIPO_VIDEO_LABELS[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipoVideo === "embed" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="embed_codigo">Código de embed</Label>
              <Textarea
                id="embed_codigo"
                name="embed_codigo"
                rows={4}
                value={embedCodigo}
                onChange={(e) => setEmbedCodigo(e.target.value)}
                placeholder='<iframe src="..." ...></iframe>'
              />
              {state?.errors?.embed_codigo && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.embed_codigo[0]}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="youtube_url">{tipoVideo === "vimeo" ? "URL do Vimeo" : "URL do YouTube"}</Label>
              <Input
                id="youtube_url"
                name="youtube_url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder={
                  tipoVideo === "vimeo" ? "https://vimeo.com/..." : "https://www.youtube.com/watch?v=..."
                }
              />
              {videoId && (
                // eslint-disable-next-line @next/next/no-img-element -- thumbnail externa do YouTube, não passa por upload
                <img
                  src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                  alt="Prévia do vídeo"
                  className="w-full max-w-xs rounded-lg border"
                />
              )}
              {vimeoId && (
                <iframe
                  src={`https://player.vimeo.com/video/${vimeoId}`}
                  className="aspect-video w-full max-w-xs rounded-lg border"
                  allow="autoplay; fullscreen; picture-in-picture"
                  title="Prévia do vídeo"
                />
              )}
              {state?.errors?.youtube_url && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.youtube_url[0]}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                name="status"
                items={TREINAMENTO_STATUS_LABELS}
                value={status}
                onValueChange={(value) => setStatus(value as string)}
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TREINAMENTO_STATUSES.map((opcao) => (
                    <SelectItem key={opcao} value={opcao}>
                      {TREINAMENTO_STATUS_LABELS[opcao]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ordem">Ordem</Label>
              <Input id="ordem" name="ordem" type="number" min={0} defaultValue={values.ordem} />
              <p className="text-muted-foreground text-xs">Controla a sequência dentro da categoria.</p>
              {state?.errors?.ordem && (
                <p role="alert" className="text-destructive text-sm">
                  {state.errors.ordem[0]}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} />
        <Button variant="outline" render={<Link href="/admin/treinamentos" />} nativeButton={false}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
