// Personalização da tela de login do portal do aluno — tipos, padrões e utilitários de
// cor. Sem dependência de servidor: a tela real (/entrar), o preview do admin e a
// validação usam o mesmo código.

export const PORTAL_LOGIN_TEMPLATES = ["card", "split"] as const;
export type PortalLoginTemplate = (typeof PORTAL_LOGIN_TEMPLATES)[number];

export const PORTAL_LOGIN_TEMPLATE_LABELS: Record<PortalLoginTemplate, string> = {
  card: "Cartão",
  split: "Dividido (hero + formulário)",
};

export const PORTAL_LOGIN_TIPOS_SENHA = ["padrao", "aleatoria", "so_email"] as const;
export type PortalLoginTipoSenha = (typeof PORTAL_LOGIN_TIPOS_SENHA)[number];

export const PORTAL_LOGIN_TIPO_SENHA_INFO: Record<PortalLoginTipoSenha, { titulo: string; descricao: string }> = {
  padrao: {
    titulo: "E-mail e senha",
    descricao: "O aluno entra com e-mail e a senha cadastrada. Opcionalmente, todo aluno novo recebe uma senha padrão.",
  },
  aleatoria: {
    titulo: "Senha aleatória por e-mail",
    descricao: "Ao cadastrar o aluno, o sistema gera uma senha de 8 caracteres e a envia por e-mail. O login segue com e-mail e senha.",
  },
  so_email: {
    titulo: "Somente e-mail (link de acesso)",
    descricao: "O campo de senha some. O aluno informa o e-mail e recebe um link de acesso na caixa de entrada.",
  },
};

export type PortalLoginConfig = {
  template: PortalLoginTemplate;
  titulo: string;
  subtitulo: string;
  corPrimaria: string;
  corFundo: string;
  imagemFundoUrl: string | null;
  tipoSenha: PortalLoginTipoSenha;
  mostrarInstalarApp: boolean;
};

export const PORTAL_LOGIN_PADRAO: PortalLoginConfig = {
  template: "card",
  titulo: "Área do Aluno",
  subtitulo: "Entre com seu e-mail e senha",
  corPrimaria: "#0ea5e9",
  corFundo: "#18181b",
  imagemFundoUrl: null,
  tipoSenha: "padrao",
  mostrarInstalarApp: true,
};

export const REGEX_COR_HEX = /^#[0-9a-fA-F]{6}$/;

export function isPortalLoginTemplate(valor: unknown): valor is PortalLoginTemplate {
  return typeof valor === "string" && (PORTAL_LOGIN_TEMPLATES as readonly string[]).includes(valor);
}

export function isPortalLoginTipoSenha(valor: unknown): valor is PortalLoginTipoSenha {
  return typeof valor === "string" && (PORTAL_LOGIN_TIPOS_SENHA as readonly string[]).includes(valor);
}

// Cor do texto sobre um fundo colorido (botões, na cor primária escolhida): preto ou
// branco, o que der mais contraste (luminância relativa WCAG).
export function corTextoSobre(hex: string): string {
  if (!REGEX_COR_HEX.test(hex)) return "#ffffff";
  const canal = (inicio: number) => {
    const c = parseInt(hex.slice(inicio, inicio + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminancia = 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
  return luminancia > 0.4 ? "#0a0a0a" : "#ffffff";
}

// rgba() a partir de "#rrggbb" (overlay sobre imagem).
export function hexParaRgba(hex: string, alpha: number): string {
  if (!REGEX_COR_HEX.test(hex)) return `rgba(0,0,0,${alpha})`;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
