import { Inter, Montserrat, Open_Sans, Poppins, Roboto } from "next/font/google";
import type { FonteCampanha } from "@/lib/campanha-paginas/schema";

// Fontes selecionáveis na aba "Visual" > "Tipografia e espaçamento" do editor de
// campanha. next/font/google BAIXA os arquivos no build e os serve do próprio
// domínio (sem requisição a fonts.googleapis.com em tempo de execução — nada de
// terceiro no navegador do visitante, coerente com a LGPD).
//
// preload: false — as 5 famílias são declaradas aqui, mas só a escolhida pela
// página é de fato baixada pelo navegador (o @font-face é lazy; sem preload não
// há <link rel="preload"> pra fonte nenhuma). O conjunto "latin" cobre o
// português (acentos e cedilha).
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false });
const roboto = Roboto({ subsets: ["latin"], weight: ["400", "500", "700", "900"], display: "swap", preload: false });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "600", "700", "800"], display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap", preload: false });
const openSans = Open_Sans({ subsets: ["latin"], display: "swap", preload: false });

// font-family CSS de cada opção (a opção "sistema" não entra: mantém a fonte
// do app, sem override).
export const FONTE_CSS: Record<Exclude<FonteCampanha, "sistema">, string> = {
  inter: inter.style.fontFamily,
  roboto: roboto.style.fontFamily,
  poppins: poppins.style.fontFamily,
  montserrat: montserrat.style.fontFamily,
  open_sans: openSans.style.fontFamily,
};
