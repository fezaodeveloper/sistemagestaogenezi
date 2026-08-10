"use client";

import { useState, useTransition } from "react";
import { updateAvatar } from "@/app/aluno/perfil/actions";
import { AVATAR_IDS, AVATARES, type AvatarId } from "@/lib/avatares/catalog";
import { AlunoAvatar } from "@/components/gamificacao/aluno-avatar";
import { cn } from "@/lib/utils";

export function AvatarPicker({ avatarIdInicial }: { avatarIdInicial: AvatarId }) {
  const [avatarId, setAvatarId] = useState(avatarIdInicial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSelect(novoAvatarId: AvatarId) {
    if (novoAvatarId === avatarId || isPending) return;

    const anterior = avatarId;
    setAvatarId(novoAvatarId);
    setError(null);
    startTransition(async () => {
      const result = await updateAvatar(novoAvatarId);
      if (result.error) {
        setError(result.error);
        setAvatarId(anterior);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-3">
        {AVATAR_IDS.map((id) => {
          const avatar = AVATARES[id];
          const selecionado = id === avatarId;
          return (
            <button
              key={id}
              type="button"
              disabled={isPending}
              onClick={() => handleSelect(id)}
              aria-pressed={selecionado}
              aria-label={avatar.label}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors",
                avatar.bg,
                selecionado ? "border-primary ring-primary ring-1" : "border-border",
                isPending ? "opacity-60" : "hover:border-primary/50",
              )}
            >
              <AlunoAvatar avatarId={id} size="md" />
              <span className="text-muted-foreground">{avatar.label}</span>
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
