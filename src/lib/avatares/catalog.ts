// Catálogo fixo de avatares — precisa bater exatamente com o `check`
// constraint de profiles.avatar_id (migration 20260822100000). Mudar o
// catálogo no futuro sempre exige alterar os dois lados juntos.
export const AVATAR_IDS = [
  "raposa",
  "coruja",
  "gato",
  "urso",
  "panda",
  "coelho",
  "tigre",
  "pinguim",
  "polvo",
  "coala",
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

// "bg" é só o fundo do tile no seletor de avatar (AvatarPicker) — a
// ilustração em si (avatar-icons.tsx) já é colorida e desenha seu
// próprio "rosto" circular, não precisa de fundo extra no AlunoAvatar.
export const AVATARES: Record<AvatarId, { label: string; bg: string }> = {
  raposa: { label: "Raposa", bg: "bg-orange-500/15" },
  coruja: { label: "Coruja", bg: "bg-amber-500/15" },
  gato: { label: "Gato", bg: "bg-slate-500/15" },
  urso: { label: "Urso", bg: "bg-yellow-500/15" },
  panda: { label: "Panda", bg: "bg-neutral-500/15" },
  coelho: { label: "Coelho", bg: "bg-pink-500/15" },
  tigre: { label: "Tigre", bg: "bg-red-500/15" },
  pinguim: { label: "Pinguim", bg: "bg-sky-500/15" },
  polvo: { label: "Polvo", bg: "bg-purple-500/15" },
  coala: { label: "Coala", bg: "bg-teal-500/15" },
};

export function isAvatarId(value: string): value is AvatarId {
  return (AVATAR_IDS as readonly string[]).includes(value);
}
