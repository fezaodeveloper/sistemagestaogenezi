"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import {
  deleteBannerLogin,
  updateBannerLogin,
  uploadBannerLogin,
} from "@/app/admin/configuracoes/actions";
import { createClient } from "@/lib/supabase/client";
import { BANNER_BUCKET, BANNER_TAMANHO_MAXIMO_BYTES, BANNER_TIPOS_ACEITOS } from "@/lib/storage/banners";
import {
  LOGIN_BANNER_TIPOS,
  LOGIN_BANNER_TIPO_BADGE_CLASS,
  LOGIN_BANNER_TIPO_LABELS,
  type LoginBanner,
  type LoginBannerTipo,
} from "@/lib/login-banners/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const TELA_DESTINO_LABELS: Record<LoginBannerTipo, string> = {
  admin: "Tela do Admin (/login)",
  aluno: "Tela do Aluno (/entrar)",
};

function BannerRow({ banner }: { banner: LoginBanner }) {
  const [titulo, setTitulo] = useState(banner.titulo ?? "");
  const [subtitulo, setSubtitulo] = useState(banner.subtitulo ?? "");
  const [ordem, setOrdem] = useState(banner.ordem);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [excluirOpen, setExcluirOpen] = useState(false);

  function salvar(dados: Partial<{ titulo: string; subtitulo: string; ordem: number; ativo: boolean }>) {
    setError(null);
    startTransition(async () => {
      const resultado = await updateBannerLogin(banner.id, {
        titulo,
        subtitulo,
        ordem,
        ativo: banner.ativo,
        ...dados,
      });
      if (resultado.error) setError(resultado.error);
    });
  }

  function handleExcluir() {
    setError(null);
    startTransition(async () => {
      const resultado = await deleteBannerLogin(banner.id);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setExcluirOpen(false);
    });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto, sem necessidade de otimização do next/image aqui */}
        <img
          src={banner.public_url}
          alt={banner.titulo ?? "Banner do login"}
          className="h-[90px] w-40 shrink-0 rounded-md border object-cover"
        />

        <div className="flex flex-1 flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-muted-foreground text-xs">Tela</Label>
            <Badge className={`w-fit ${LOGIN_BANNER_TIPO_BADGE_CLASS[banner.tipo]}`}>
              {LOGIN_BANNER_TIPO_LABELS[banner.tipo]}
            </Badge>
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <Label className="text-muted-foreground text-xs">Título</Label>
            <Input
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              onBlur={() => salvar({ titulo })}
              placeholder="Opcional"
            />
          </div>
          <div className="flex min-w-40 flex-1 flex-col gap-1">
            <Label className="text-muted-foreground text-xs">Subtítulo</Label>
            <Input
              value={subtitulo}
              onChange={(event) => setSubtitulo(event.target.value)}
              onBlur={() => salvar({ subtitulo })}
              placeholder="Opcional"
            />
          </div>
          <div className="flex w-20 flex-col gap-1">
            <Label className="text-muted-foreground text-xs">Ordem</Label>
            <Input
              type="number"
              min={0}
              value={ordem}
              onChange={(event) => setOrdem(Number(event.target.value))}
              onBlur={() => salvar({ ordem })}
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <Label className="text-muted-foreground text-xs">Ativo</Label>
            <Switch checked={banner.ativo} onCheckedChange={(checked) => salvar({ ativo: checked === true })} />
          </div>
        </div>

        <AlertDialog open={excluirOpen} onOpenChange={setExcluirOpen}>
          <AlertDialogTrigger render={<Button variant="ghost" size="sm">Excluir</Button>} />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir banner</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este banner? O arquivo também será removido do Storage. Essa
                ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction variant="destructive" disabled={isPending} onClick={handleExcluir}>
                {isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {error && <p className="text-destructive w-full text-xs">{error}</p>}
      </CardContent>
    </Card>
  );
}

function AdicionarBannerDialog() {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [tipo, setTipo] = useState<LoginBannerTipo>("admin");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  function resetar() {
    setTitulo("");
    setSubtitulo("");
    setTipo("admin");
    setArquivo(null);
    setError(null);
  }

  function handleArquivoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setArquivo(null);
      return;
    }
    if (!BANNER_TIPOS_ACEITOS.includes(file.type as (typeof BANNER_TIPOS_ACEITOS)[number])) {
      setError("Formato não aceito. Envie um arquivo JPG, PNG ou WebP.");
      setArquivo(null);
      return;
    }
    if (file.size > BANNER_TAMANHO_MAXIMO_BYTES) {
      setError("O arquivo pode ter no máximo 5MB.");
      setArquivo(null);
      return;
    }
    setArquivo(file);
  }

  async function handleUpload() {
    if (!arquivo) {
      setError("Selecione uma imagem.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const supabase = createClient();
      // Nome único (timestamp + nome original) — evita colisão e, junto
      // com o storage_path salvo na tabela, permite excluir o arquivo
      // certo do Storage depois (ver deleteBannerLogin).
      const path = `${Date.now()}-${arquivo.name}`;

      const { error: uploadError } = await supabase.storage.from(BANNER_BUCKET).upload(path, arquivo);
      if (uploadError) {
        setError("Não foi possível enviar a imagem. Tente novamente.");
        return;
      }

      const { data: urlData } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path);

      const formData = new FormData();
      formData.set("storage_path", path);
      formData.set("public_url", urlData.publicUrl);
      formData.set("titulo", titulo);
      formData.set("subtitulo", subtitulo);
      formData.set("tipo", tipo);

      const resultado = await uploadBannerLogin(formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }

      setOpen(false);
      resetar();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) resetar();
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus />
            Adicionar banner
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo banner</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="banner-arquivo">Imagem</Label>
            <Input
              id="banner-arquivo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleArquivoChange}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="banner-tipo">Tela de destino</Label>
            <Select
              value={tipo}
              onValueChange={(value) => setTipo(value as LoginBannerTipo)}
              items={TELA_DESTINO_LABELS}
            >
              <SelectTrigger id="banner-tipo" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOGIN_BANNER_TIPOS.map((opcao) => (
                  <SelectItem key={opcao} value={opcao}>
                    {TELA_DESTINO_LABELS[opcao]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="banner-titulo">Título</Label>
            <Input
              id="banner-titulo"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="banner-subtitulo">Subtítulo</Label>
            <Input
              id="banner-subtitulo"
              value={subtitulo}
              onChange={(event) => setSubtitulo(event.target.value)}
              placeholder="Opcional"
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" disabled={enviando} onClick={handleUpload}>
            {enviando ? "Enviando..." : "Adicionar banner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FILTRO_TODOS = "todos";
const FILTRO_ITEMS: Record<string, string> = {
  [FILTRO_TODOS]: "Todos",
  ...LOGIN_BANNER_TIPO_LABELS,
};

export function BannersLoginForm({ banners }: { banners: LoginBanner[] }) {
  const [filtro, setFiltro] = useState<string>(FILTRO_TODOS);

  const bannersFiltrados = useMemo(() => {
    if (filtro === FILTRO_TODOS) return banners;
    return banners.filter((banner) => banner.tipo === filtro);
  }, [banners, filtro]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Faça upload de banners para a tela de login. Tamanho recomendado: 1280x720px (paisagem). Formatos
        aceitos: JPG, PNG, WebP.
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Label className="text-muted-foreground text-xs">Filtrar por tela</Label>
          <Select items={FILTRO_ITEMS} value={filtro} onValueChange={(value) => setFiltro(value as string)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(FILTRO_ITEMS).map((chave) => (
                <SelectItem key={chave} value={chave}>
                  {FILTRO_ITEMS[chave]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AdicionarBannerDialog />
      </div>

      <p className="text-sm font-medium">
        {bannersFiltrados.length} banner{bannersFiltrados.length === 1 ? "" : "s"}
      </p>

      {bannersFiltrados.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {banners.length === 0
            ? "Nenhum banner cadastrado — as telas de login estão usando os banners padrão da Gênezi."
            : "Nenhum banner encontrado com o filtro aplicado."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {bannersFiltrados.map((banner) => (
            <BannerRow key={banner.id} banner={banner} />
          ))}
        </div>
      )}
    </div>
  );
}
