import { AVATARES, type AvatarId } from "@/lib/avatares/catalog";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8",
  md: "size-10",
  lg: "size-16",
} as const;

// Ilustrações vendorizadas de public/avatares/*.svg (Noto Emoji, Apache
// 2.0 — ver public/avatares/LICENSE). Arquivo local, sem chamada de rede
// em runtime.
export function AlunoAvatar({
  avatarId,
  size = "md",
  className,
}: {
  avatarId: AvatarId;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const avatar = AVATARES[avatarId];

  return (
    // eslint-disable-next-line @next/next/no-img-element -- SVG estático local, next/image não traz benefício aqui
    <img
      src={`/avatares/${avatarId}.svg`}
      alt={avatar.label}
      className={cn("inline-block shrink-0 rounded-full", SIZES[size], className)}
    />
  );
}
