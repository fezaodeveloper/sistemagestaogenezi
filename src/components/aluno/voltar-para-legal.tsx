import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Link de retorno ao índice dos documentos legais (/aluno/legal), no topo de
// cada uma das 4 páginas (privacidade, termos, LGPD, uso de imagem).
export function VoltarParaLegal() {
  return (
    <Link
      href="/aluno/legal"
      className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm hover:underline"
    >
      <ArrowLeft className="size-3.5" />
      Documentos legais
    </Link>
  );
}
