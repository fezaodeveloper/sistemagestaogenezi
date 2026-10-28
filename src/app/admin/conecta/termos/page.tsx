import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import {
  TERMO_LEGAL_CAMINHO_PUBLICO,
  TERMO_LEGAL_CHAVES_CONECTA,
  type TermoLegalChave,
} from "@/lib/termos-legais/schema";
import { TermoLegalEditor } from "@/components/admin/termo-legal-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TermoLegalRow = {
  chave: TermoLegalChave;
  titulo: string;
  conteudo: string;
  atualizado_em: string;
  atualizado_por: { full_name: string | null } | null;
};

const ABA_LABEL: Record<(typeof TERMO_LEGAL_CHAVES_CONECTA)[number], string> = {
  conecta_termos_uso: "Termos de Uso",
  conecta_privacidade: "Privacidade",
  conecta_cookies: "Cookies",
  conecta_lgpd: "LGPD",
  conecta_menor_termo: "Termo do Menor",
};

// Um único link no menu, uma única página com abas (REGRA da tarefa) — diferente do padrão do
// aluno (/admin/legal/[chave], 4 nav links separados, cada um pra sua própria página). Mesmo
// editor rico (Tiptap) e mesma tabela termos_legais por baixo, só a rota admin é diferente.
export default async function AdminConectaTermosPage() {
  await requireRole("admin");

  const supabase = await createClient();
  const { data } = await supabase
    .from("termos_legais")
    .select("chave, titulo, conteudo, atualizado_em, atualizado_por:profiles(full_name)")
    .in("chave", TERMO_LEGAL_CHAVES_CONECTA);

  const termos = (data as unknown as TermoLegalRow[] | null) ?? [];
  const termoPorChave = new Map(termos.map((termo) => [termo.chave, termo]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Termos Legais — Gênezi Conecta</h1>
        <p className="text-muted-foreground text-sm">
          Termos de uso, privacidade, cookies, LGPD e o termo de acompanhamento exibido a
          candidatos de 16-17 anos.
        </p>
      </div>

      <Tabs defaultValue="conecta_termos_uso">
        <TabsList>
          {TERMO_LEGAL_CHAVES_CONECTA.map((chave) => (
            <TabsTrigger key={chave} value={chave}>
              {ABA_LABEL[chave]}
            </TabsTrigger>
          ))}
        </TabsList>
        {TERMO_LEGAL_CHAVES_CONECTA.map((chave) => {
          const termo = termoPorChave.get(chave);
          if (!termo) return null;
          return (
            <TabsContent key={chave} value={chave}>
              <TermoLegalEditor
                chave={chave}
                titulo={termo.titulo}
                conteudoInicial={termo.conteudo}
                atualizadoEm={termo.atualizado_em}
                atualizadoPorNome={termo.atualizado_por?.full_name ?? null}
                previewHref={TERMO_LEGAL_CAMINHO_PUBLICO[chave]}
              />
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
