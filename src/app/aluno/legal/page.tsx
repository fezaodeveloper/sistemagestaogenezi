import Link from "next/link";
import { Camera, ChevronRight, FileText, Lock, Shield, type LucideIcon } from "lucide-react";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TERMO_LEGAL_CHAVES, type TermoLegalChave } from "@/lib/termos-legais/schema";
import { Card, CardContent } from "@/components/ui/card";

// Índice dos documentos legais do portal do aluno: em vez de 4 links soltos no
// rodapé da sidebar, um único ponto de entrada ("Termos e Privacidade") com um
// card por documento.
const DOCUMENTOS: Record<
  TermoLegalChave,
  { titulo: string; descricao: string; icone: LucideIcon; href: string }
> = {
  privacidade: {
    titulo: "Política de Privacidade",
    descricao: "Quais dados coletamos, para que usamos e como os protegemos.",
    icone: Shield,
    href: "/aluno/legal/privacidade",
  },
  termos: {
    titulo: "Termos de Uso",
    descricao: "As regras de uso da plataforma e do relacionamento com a escola.",
    icone: FileText,
    href: "/aluno/legal/termos",
  },
  lgpd: {
    titulo: "LGPD — Seus direitos",
    descricao: "Seus direitos sobre os dados pessoais e como exercê-los.",
    icone: Lock,
    href: "/aluno/legal/lgpd",
  },
  imagem: {
    titulo: "Termo de Uso de Imagem",
    descricao: "Autorização para uso de imagem em atividades da escola.",
    icone: Camera,
    href: "/aluno/legal/imagem",
  },
};

type LinhaTermo = { chave: TermoLegalChave; conteudo: string; atualizado_em: string };

export default async function DocumentosLegaisPage() {
  await requireRole("aluno");

  const supabase = await createClient();
  const { data } = await supabase.from("termos_legais").select("chave, conteudo, atualizado_em");
  const linhas = (data as LinhaTermo[] | null) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Termos e Privacidade</h1>
        <p className="text-muted-foreground text-sm">
          Documentos legais da GÊNEZI Educação Profissional: como tratamos seus dados e as regras da plataforma.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {TERMO_LEGAL_CHAVES.map((chave) => {
          const documento = DOCUMENTOS[chave];
          const Icone = documento.icone;
          const linha = linhas.find((l) => l.chave === chave);
          // "Atualizado em" só quando um admin publicou texto próprio; com o
          // conteúdo vazio a página mostra o texto padrão (sem data de revisão).
          const atualizadoEm = linha?.conteudo?.trim()
            ? new Date(linha.atualizado_em).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
            : null;

          return (
            <Link key={chave} href={documento.href} className="group">
              <Card className="group-hover:border-primary/50 h-full transition-colors">
                <CardContent className="flex h-full flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                      <Icone className="size-4" />
                    </span>
                    <ChevronRight className="text-muted-foreground group-hover:text-foreground size-4 transition-colors" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{documento.titulo}</p>
                    <p className="text-muted-foreground text-sm">{documento.descricao}</p>
                  </div>
                  {atualizadoEm && <p className="text-muted-foreground mt-auto text-xs">Atualizado em {atualizadoEm}</p>}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
