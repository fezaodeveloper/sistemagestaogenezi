"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ExternalLink, GraduationCap, MessageCircle, Search } from "lucide-react";
import { VAGA_MODALIDADE_LABELS, VAGA_TIPO_LABELS, type VagaConectaComEmpresa } from "@/lib/conecta/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Paginacao } from "@/components/ui/paginacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TODOS = "todos";
const TODAS = "todas";
const TIPO_ITEMS: Record<string, string> = { [TODOS]: "Todos", ...VAGA_TIPO_LABELS };
const MODALIDADE_ITEMS: Record<string, string> = { [TODAS]: "Todas", ...VAGA_MODALIDADE_LABELS };

function formatSalario(vaga: VagaConectaComEmpresa): string {
  if (vaga.salario_oculto) return "A combinar";
  if (!vaga.salario_min && !vaga.salario_max) return "A combinar";
  const formatar = (valor: number) =>
    valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (vaga.salario_min && vaga.salario_max) {
    return `${formatar(vaga.salario_min)} - ${formatar(vaga.salario_max)}`;
  }
  return formatar(vaga.salario_min ?? vaga.salario_max ?? 0);
}

function formatDataCompleta(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function truncar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  return `${texto.slice(0, max).trimEnd()}...`;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).slice(0, 2);
  return partes.map((parte) => parte[0]?.toUpperCase() ?? "").join("");
}

function LogoOuIniciais({ vaga, className }: { vaga: VagaConectaComEmpresa; className: string }) {
  if (vaga.empresaLogoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
      <img src={vaga.empresaLogoUrl} alt={vaga.empresaNome} className={`${className} rounded-md object-contain`} />
    );
  }
  return (
    <div
      className={`${className} bg-muted text-muted-foreground flex items-center justify-center rounded-md font-semibold`}
    >
      {iniciais(vaga.empresaNome) || <Building2 className="size-4" />}
    </div>
  );
}

function BotaoWhatsapp({ vaga, className }: { vaga: VagaConectaComEmpresa; className?: string }) {
  const whatsappDigitos = vaga.empresaWhatsapp?.replace(/\D/g, "");
  const mensagem = encodeURIComponent(`Olá! Vi a vaga de ${vaga.titulo} no Gênezi Conecta e tenho interesse.`);

  if (!whatsappDigitos) {
    return (
      <Button disabled title="Empresa não informou WhatsApp para contato." className={className}>
        <MessageCircle className="size-4" />
        Candidatar via WhatsApp
      </Button>
    );
  }

  return (
    <Button
      className={`bg-green-600 hover:bg-green-700 ${className ?? ""}`}
      nativeButton={false}
      render={<a href={`https://wa.me/55${whatsappDigitos}?text=${mensagem}`} target="_blank" rel="noreferrer" />}
    >
      <MessageCircle className="size-4" />
      Candidatar via WhatsApp
    </Button>
  );
}

function VagaDetalhesDialog({ vaga }: { vaga: VagaConectaComEmpresa }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" className="w-full" />}>
        Ver detalhes
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <LogoOuIniciais vaga={vaga} className="size-10 shrink-0" />
            <div>
              <DialogTitle>{vaga.titulo}</DialogTitle>
              <p className="text-muted-foreground text-sm">{vaga.empresaNome}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{VAGA_TIPO_LABELS[vaga.tipo]}</Badge>
            <Badge variant="outline">{VAGA_MODALIDADE_LABELS[vaga.modalidade]}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-muted-foreground text-xs">Local da vaga</p>
              <p>
                {vaga.cidade}/{vaga.estado}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Salário</p>
              <p>{formatSalario(vaga)}</p>
            </div>
            {vaga.carga_horaria && (
              <div>
                <p className="text-muted-foreground text-xs">Carga horária</p>
                <p>{vaga.carga_horaria}</p>
              </div>
            )}
            {vaga.prazo_candidatura && (
              <div>
                <p className="text-muted-foreground text-xs">Candidaturas até</p>
                <p>{formatDataCompleta(vaga.prazo_candidatura)}</p>
              </div>
            )}
          </div>

          <div>
            <p className="mb-1 font-medium">Descrição</p>
            <p className="text-muted-foreground whitespace-pre-line">{vaga.descricao}</p>
          </div>

          {vaga.requisitos && (
            <div>
              <p className="mb-1 font-medium">Requisitos</p>
              <p className="text-muted-foreground whitespace-pre-line">{vaga.requisitos}</p>
            </div>
          )}

          <div className="bg-muted/50 flex flex-col gap-2 rounded-lg p-4 text-center">
            <p className="text-sm font-medium">💼 Quer aparecer para empresas como esta?</p>
            <Button size="sm" render={<Link href="/conecta/cadastro" />} nativeButton={false}>
              Assine o Gênezi Conecta →
            </Button>
          </div>
        </div>

        <DialogFooter>
          <BotaoWhatsapp vaga={vaga} className="w-full" />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VagaCard({ vaga }: { vaga: VagaConectaComEmpresa }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="flex items-center gap-2">
          <LogoOuIniciais vaga={vaga} className="size-8 shrink-0 text-xs" />
          <span className="text-muted-foreground truncate text-xs">{vaga.empresaNome}</span>
        </div>

        <h3 className="font-semibold">{vaga.titulo}</h3>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">{VAGA_TIPO_LABELS[vaga.tipo]}</Badge>
          <Badge variant="outline">{VAGA_MODALIDADE_LABELS[vaga.modalidade]}</Badge>
        </div>

        <div className="text-muted-foreground flex flex-col gap-0.5 text-xs">
          <span>
            {vaga.cidade}/{vaga.estado}
          </span>
          <span>{formatSalario(vaga)}</span>
          {vaga.carga_horaria && <span>{vaga.carga_horaria}</span>}
        </div>

        <p className="text-sm">{truncar(vaga.descricao, 150)}</p>

        <div className="flex flex-col gap-2 pt-1">
          <BotaoWhatsapp vaga={vaga} />
          <VagaDetalhesDialog vaga={vaga} />
        </div>
      </CardContent>
    </Card>
  );
}

function LogoGenezi({ logoUrl }: { logoUrl: string | null }) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- imagem vem do Storage do próprio projeto
      <img src={logoUrl} alt="Gênezi" className="size-16 rounded-2xl object-contain" />
    );
  }
  return (
    <div className="bg-muted flex size-16 items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/30">
      <span className="text-3xl">🎓</span>
    </div>
  );
}

export function ConectaVagasPublicasView({
  logoUrl,
  vagas,
  totalRegistros,
  paginaAtual,
  totalPaginas,
  limite,
  filtrosAtuais,
}: {
  logoUrl: string | null;
  vagas: VagaConectaComEmpresa[];
  totalRegistros: number;
  paginaAtual: number;
  totalPaginas: number;
  limite: number;
  filtrosAtuais: { q: string; tipo: string; modalidade: string; cidade: string };
}) {
  const router = useRouter();
  const [busca, setBusca] = useState(filtrosAtuais.q);
  const [cidade, setCidade] = useState(filtrosAtuais.cidade);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navegar(overrides: Partial<{ q: string; tipo: string; modalidade: string; cidade: string }>) {
    const proximo = { ...filtrosAtuais, ...overrides };
    const params = new URLSearchParams();
    if (proximo.q.trim()) params.set("q", proximo.q.trim());
    if (proximo.tipo) params.set("tipo", proximo.tipo);
    if (proximo.modalidade) params.set("modalidade", proximo.modalidade);
    if (proximo.cidade.trim()) params.set("cidade", proximo.cidade.trim());
    const query = params.toString();
    router.push(query ? `/conecta/vagas?${query}` : "/conecta/vagas");
  }

  function handleBuscaChange(valor: string) {
    setBusca(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navegar({ q: valor }), 400);
  }

  function handleCidadeChange(valor: string) {
    setCidade(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navegar({ cidade: valor }), 400);
  }

  const searchParamsAtuais: Record<string, string> = {};
  if (filtrosAtuais.q) searchParamsAtuais.q = filtrosAtuais.q;
  if (filtrosAtuais.tipo) searchParamsAtuais.tipo = filtrosAtuais.tipo;
  if (filtrosAtuais.modalidade) searchParamsAtuais.modalidade = filtrosAtuais.modalidade;
  if (filtrosAtuais.cidade) searchParamsAtuais.cidade = filtrosAtuais.cidade;

  return (
    <main className="dark bg-background text-foreground min-h-svh">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 p-6 py-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoGenezi logoUrl={logoUrl} />
          <h1 className="text-2xl font-bold">Gênezi Conecta — Portal de Empregos</h1>
          <p className="text-muted-foreground text-sm">
            Vagas de emprego e estágio para a região de Propriá/SE
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Button
            variant="outline"
            className="h-auto justify-start py-3 text-left whitespace-normal"
            render={<Link href="/entrar" />}
            nativeButton={false}
          >
            👨‍🎓 É aluno da Gênezi? Acesse o portal completo →
          </Button>
          <Button
            variant="outline"
            className="h-auto justify-start py-3 text-left whitespace-normal"
            render={<Link href="/empresa/cadastro" />}
            nativeButton={false}
          >
            🏢 Sua empresa quer contratar? Cadastre-se grátis →
          </Button>
          <Button
            variant="outline"
            className="h-auto justify-start py-3 text-left whitespace-normal"
            render={<Link href="/conecta/cadastro" />}
            nativeButton={false}
          >
            💼 Quer aparecer para empresas? Assine o Gênezi Conecta →
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={busca}
                onChange={(e) => handleBuscaChange(e.target.value)}
                placeholder="Buscar por cargo ou empresa..."
                className="pl-9"
              />
            </div>
            <Select
              items={TIPO_ITEMS}
              value={filtrosAtuais.tipo || TODOS}
              onValueChange={(value) => navegar({ tipo: value && value !== TODOS ? value : "" })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_ITEMS).map(([valor, label]) => (
                  <SelectItem key={valor} value={valor}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              items={MODALIDADE_ITEMS}
              value={filtrosAtuais.modalidade || TODAS}
              onValueChange={(value) => navegar({ modalidade: value && value !== TODAS ? value : "" })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MODALIDADE_ITEMS).map(([valor, label]) => (
                  <SelectItem key={valor} value={valor}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={cidade} onChange={(e) => handleCidadeChange(e.target.value)} placeholder="Cidade" />
          </div>

          {vagas.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                Nenhuma vaga disponível no momento.
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                {totalRegistros} vaga{totalRegistros === 1 ? "" : "s"} disponível{totalRegistros === 1 ? "" : "eis"}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vagas.map((vaga) => (
                  <VagaCard key={vaga.id} vaga={vaga} />
                ))}
              </div>
            </>
          )}

          <Paginacao
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            limite={limite}
            baseUrl="/conecta/vagas"
            searchParams={searchParamsAtuais}
          />
        </div>

        <footer className="flex flex-col items-center gap-2 border-t pt-6 text-center">
          <p className="text-muted-foreground text-sm">Gênezi Educação — Propriá/SE</p>
          <div className="text-muted-foreground flex flex-wrap justify-center gap-4 text-sm">
            <Link href="/empresa/cadastro" className="flex items-center gap-1 underline underline-offset-2">
              <Building2 className="size-3.5" />
              Para empresas
            </Link>
            <Link href="/conecta/cadastro" className="flex items-center gap-1 underline underline-offset-2">
              <ExternalLink className="size-3.5" />
              Para candidatos
            </Link>
            <Link href="/captacao" className="flex items-center gap-1 underline underline-offset-2">
              <GraduationCap className="size-3.5" />
              Nossos cursos
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
