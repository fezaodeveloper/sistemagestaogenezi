export type Role = "admin" | "aluno";

export function roleHome(role: Role) {
  return role === "admin" ? "/admin" : "/aluno";
}
