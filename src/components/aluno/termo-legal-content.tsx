import type { ReactNode } from "react";
import type { TermoLegal } from "@/lib/termos-legais/schema";

function formatDateBR(isoString: string): string {
  return new Date(isoString).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Server Component: sem interatividade, só decide entre o HTML editado pelo
// admin (src/components/admin/termo-legal-editor.tsx) e o texto padrão que
// já existia na página, estático, antes do editor rico existir.
export function TermoLegalContent({
  termo,
  fallback,
}: {
  termo: TermoLegal | null;
  fallback: ReactNode;
}) {
  const conteudo = termo?.conteudo?.trim();

  return (
    <>
      {conteudo ? (
        <div
          className="flex flex-col gap-2 text-sm leading-relaxed [&_blockquote]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
          // Conteúdo vem só do editor Tiptap do admin (termo-legal-editor.tsx), nunca de input de usuário externo.
          dangerouslySetInnerHTML={{ __html: conteudo }}
        />
      ) : (
        fallback
      )}
      {conteudo && termo && (
        <p className="text-muted-foreground mt-4 text-xs">
          Atualizado em {formatDateBR(termo.atualizado_em)}.
        </p>
      )}
    </>
  );
}
