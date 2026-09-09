"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { trocarSenha } from "@/app/aluno/perfil/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function CampoSenha({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visivel ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-10"
          autoComplete={id === "senha-atual" ? "current-password" : "new-password"}
        />
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </div>
  );
}

export function TrocarSenhaForm() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSucesso(false);

    if (novaSenha.length < 6) {
      setError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError("A confirmação não bate com a nova senha.");
      return;
    }

    startTransition(async () => {
      const resultado = await trocarSenha(senhaAtual, novaSenha);
      if (resultado.error) {
        setError(resultado.error);
        return;
      }
      setSucesso(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmarSenha("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <CampoSenha id="senha-atual" label="Senha atual" value={senhaAtual} onChange={setSenhaAtual} />
      <CampoSenha id="nova-senha" label="Nova senha" value={novaSenha} onChange={setNovaSenha} />
      <CampoSenha
        id="confirmar-senha"
        label="Confirmar nova senha"
        value={confirmarSenha}
        onChange={setConfirmarSenha}
      />

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {sucesso && <p className="text-sm text-green-600 dark:text-green-400">Senha alterada com sucesso.</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Alterando..." : "Alterar senha"}
      </Button>
    </form>
  );
}
