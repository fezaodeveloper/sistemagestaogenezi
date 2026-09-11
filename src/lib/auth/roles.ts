export type Role = "admin" | "aluno" | "empresa";

export function empresaHome() {
  return "/empresa/painel";
}

export function roleHome(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "empresa") return empresaHome();
  return "/aluno";
}

// Tela de login por área — /login pro admin, /entrar pro aluno, /empresa/login
// pra empresa (cada uma com seu próprio fluxo). Usado nos pontos que
// redirecionam por "não autenticado" sabendo qual área a pessoa tentou
// acessar (requireRole, proxy) ou no logout (que sabe o role de quem estava
// saindo antes de encerrar a sessão).
export function loginHome(role: Role) {
  if (role === "admin") return "/login";
  if (role === "empresa") return "/empresa/login";
  return "/entrar";
}
