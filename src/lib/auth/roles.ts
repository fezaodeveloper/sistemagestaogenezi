export type Role = "admin" | "aluno";

export function roleHome(role: Role) {
  return role === "admin" ? "/admin" : "/aluno";
}

// Tela de login por área — /login pro admin, /entrar pro aluno (telas
// separadas desde a Fase 15, cada uma com seu próprio carrossel de
// banners). Usado nos pontos que redirecionam por "não autenticado"
// sabendo qual área a pessoa tentou acessar (requireRole, proxy) ou no
// logout (que sabe o role de quem estava saindo antes de encerrar a
// sessão).
export function loginHome(role: Role) {
  return role === "admin" ? "/login" : "/entrar";
}
