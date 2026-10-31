import { Inter, Poppins, Roboto } from "next/font/google";
import type { FonteAgendamento } from "@/lib/agendamentos/schema";

// Fontes selecionáveis na seção "Aparência" do editor de página de agendamento (TAREFA — PARTE
// 4). Mesmo padrão de src/lib/campanha-paginas/fontes.ts: next/font/google baixa os arquivos no
// build e serve do próprio domínio (sem requisição a fonts.googleapis.com em tempo de execução).
// Georgia é fonte de sistema (serif web-safe) — não precisa de next/font.
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700", "900"], display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800"], display: "swap", preload: false });

export const FONTE_AGENDAMENTO_CSS: Record<FonteAgendamento, string> = {
  Inter: inter.style.fontFamily,
  Roboto: roboto.style.fontFamily,
  Poppins: poppins.style.fontFamily,
  Georgia: "Georgia, serif",
};
