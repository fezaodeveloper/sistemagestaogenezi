"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, X } from "lucide-react";
import {
  removerCurriculoConecta,
  salvarPerfilConecta,
  toggleVisibilidadePerfil,
  uploadCurriculoConecta,
} from "@/app/aluno/conecta/actions";
import { createClient } from "@/lib/supabase/client";
import { formatTelefone } from "@/lib/alunos/schema";
import {
  CURRICULO_CONECTA_BUCKET,
  CURRICULO_CONECTA_MAX_BYTES,
  CURRICULO_CONECTA_TIPO_ACEITO,
} from "@/lib/storage/conecta";
import {
  DISPONIBILIDADE_LABELS,
  DISPONIBILIDADES,
  MODALIDADE_PREFERIDA_LABELS,
  MODALIDADES_PREFERIDAS,
  type PerfilConecta,
} from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const DISPONIBILIDADE_ITEMS = Object.fromEntries(
  DISPONIBILIDADES.map((valor) => [valor, DISPONIBILIDADE_LABELS[valor]]),
);
const MODALIDADE_ITEMS = Object.fromEntries(
  MODALIDADES_PREFERIDAS.map((valor) => [valor, MODALIDADE_PREFERIDA_LABELS[valor]]),
);

function VisibilidadeToggle({ perfil }: { perfil: PerfilConecta | null }) {
  const [visivel, setVisivel] = useState(perfil?.visivel ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleChange(novoValor: boolean) {
    setError(null);
    startTransition(async () => {
      const resultado = await toggleVisibilidadePerfil(novoValor);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setVisivel(novoValor);
    });
  }

  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-medium">Tornar meu perfil visível para empresas</p>
            <p className="text-muted-foreground text-sm">
              Quando ativo, empresas podem ver seu nome, WhatsApp, cursos concluídos na Gênezi e
              currículo.
            </p>
          </div>
          <Switch checked={visivel} onCheckedChange={handleChange} disabled={isPending} />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CurriculoUpload({ perfil }: { perfil: PerfilConecta | null }) {
  const [nomeArquivo, setNomeArquivo] = useState(perfil?.curriculo_url ?? null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleArquivoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;

    setError(null);

    if (file.type !== CURRICULO_CONECTA_TIPO_ACEITO) {
      setError("Formato não aceito. Envie um arquivo PDF.");
      return;
    }
    if (file.size > CURRICULO_CONECTA_MAX_BYTES) {
      setError("Arquivo muito grande. Máximo permitido: 5MB.");
      return;
    }

    setEnviando(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Sessão expirada. Recarregue a página.");
        return;
      }

      const path = `curriculos/${user.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from(CURRICULO_CONECTA_BUCKET)
        .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: true });
      if (uploadError) {
        setError(`Erro no upload: ${uploadError.message}`);
        return;
      }

      const resultado = await uploadCurriculoConecta(path, file.name);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setNomeArquivo(file.name);
    } finally {
      setEnviando(false);
    }
  }

  async function handleRemover() {
    setError(null);
    setRemovendo(true);
    try {
      const resultado = await removerCurriculoConecta();
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setNomeArquivo(null);
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Currículo (PDF)</Label>
      <input ref={inputRef} type="file" accept="application/pdf" onChange={handleArquivoChange} className="hidden" />
      {nomeArquivo ? (
        <div className="flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <FileText className="text-muted-foreground size-4" />
          <span className="truncate">{nomeArquivo}</span>
          <button
            type="button"
            onClick={handleRemover}
            disabled={removendo}
            aria-label="Remover currículo"
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
        >
          {enviando ? "Enviando..." : "Enviar currículo (PDF)"}
        </Button>
      )}
      <p className="text-muted-foreground text-xs">PDF, máximo 5MB.</p>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function ConectaPerfilForm({
  perfilInicial,
  cursosConcluidos,
}: {
  perfilInicial: PerfilConecta | null;
  cursosConcluidos: string[];
}) {
  const [whatsapp, setWhatsapp] = useState(perfilInicial?.whatsapp ?? "");
  const [resumo, setResumo] = useState(perfilInicial?.resumo ?? "");
  const [experiencias, setExperiencias] = useState(perfilInicial?.experiencias ?? "");
  const [error, setError] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSalvo(false);
    startTransition(async () => {
      const resultado = await salvarPerfilConecta(formData);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSalvo(true);
    });
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <VisibilidadeToggle perfil={perfilInicial} />

      <Card>
        <CardHeader>
          <CardTitle>Cursos concluídos na Gênezi (visíveis para empresas)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {cursosConcluidos.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Você ainda não concluiu nenhum curso — assim que concluir, ele aparece aqui automaticamente.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {cursosConcluidos.map((nome) => (
                  <Badge key={nome} variant="secondary">
                    {nome}
                  </Badge>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                Estes cursos são exibidos automaticamente para empresas quando seu perfil está visível.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados profissionais</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  placeholder="(00) 00000-0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(formatTelefone(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" name="cidade" defaultValue={perfilInicial?.cidade ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="estado">Estado</Label>
                <Input id="estado" name="estado" maxLength={2} defaultValue={perfilInicial?.estado ?? ""} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="disponibilidade">Disponibilidade</Label>
                <Select
                  name="disponibilidade"
                  items={DISPONIBILIDADE_ITEMS}
                  defaultValue={perfilInicial?.disponibilidade ?? "imediato"}
                >
                  <SelectTrigger id="disponibilidade" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISPONIBILIDADES.map((valor) => (
                      <SelectItem key={valor} value={valor}>
                        {DISPONIBILIDADE_LABELS[valor]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="modalidade_preferida">Modalidade preferida</Label>
                <Select
                  name="modalidade_preferida"
                  items={MODALIDADE_ITEMS}
                  defaultValue={perfilInicial?.modalidade_preferida ?? "presencial"}
                >
                  <SelectTrigger id="modalidade_preferida" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODALIDADES_PREFERIDAS.map((valor) => (
                      <SelectItem key={valor} value={valor}>
                        {MODALIDADE_PREFERIDA_LABELS[valor]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="linkedin_url">LinkedIn (opcional)</Label>
                <Input
                  id="linkedin_url"
                  name="linkedin_url"
                  placeholder="https://linkedin.com/in/..."
                  defaultValue={perfilInicial?.linkedin_url ?? ""}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="resumo">Resumo profissional</Label>
              <Textarea
                id="resumo"
                name="resumo"
                rows={3}
                maxLength={500}
                value={resumo}
                onChange={(e) => setResumo(e.target.value)}
              />
              <span className="text-muted-foreground self-end text-xs">{resumo.length}/500</span>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="experiencias">Experiências anteriores</Label>
              <Textarea
                id="experiencias"
                name="experiencias"
                rows={4}
                maxLength={1000}
                value={experiencias}
                onChange={(e) => setExperiencias(e.target.value)}
              />
              <span className="text-muted-foreground self-end text-xs">{experiencias.length}/1000</span>
            </div>

            <CurriculoUpload perfil={perfilInicial} />

            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            {salvo && !error && (
              <p className="text-sm text-green-600 dark:text-green-400">Perfil salvo com sucesso.</p>
            )}

            <Button type="submit" disabled={isPending} className="w-fit">
              {isPending ? "Salvando..." : "Salvar perfil"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
