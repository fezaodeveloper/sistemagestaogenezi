"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { criarSenhaConecta } from "@/app/conecta/criar-senha/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SENHA_MIN_LENGTH = 8;

// Mesmo padrão de CampoSenha em trocar-senha-form.tsx (src/components/aluno).
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
          autoComplete="new-password"
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

export function ConectaCriarSenhaForm() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (novaSenha.length < SENHA_MIN_LENGTH) {
      setError(`A senha precisa ter pelo menos ${SENHA_MIN_LENGTH} caracteres.`);
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setError("A confirmação não bate com a nova senha.");
      return;
    }

    startTransition(async () => {
      // Sem tratamento de "sucesso" aqui de propósito: em caso de sucesso a
      // Server Action já faz redirect() pra /aluno/conecta — só chega a
      // resolver com um valor quando dá erro.
      const resultado = await criarSenhaConecta(novaSenha);
      if (resultado?.error) {
        setError(resultado.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <CampoSenha id="nova-senha" label="Nova senha" value={novaSenha} onChange={setNovaSenha} />
      <CampoSenha
        id="confirmar-senha"
        label="Confirmar senha"
        value={confirmarSenha}
        onChange={setConfirmarSenha}
      />

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Salvando..." : "Salvar senha e acessar →"}
      </Button>
    </form>
  );
}
