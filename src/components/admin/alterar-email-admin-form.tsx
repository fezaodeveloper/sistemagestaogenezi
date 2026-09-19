"use client";

// "use client": formulário com estado e feedback do envio.

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { solicitarTrocaEmailAdmin } from "@/app/admin/configuracoes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AlterarEmailAdminForm({
  emailAtual,
  emailPendente,
}: {
  emailAtual: string;
  // new_email do auth.users: preenchido enquanto uma troca aguarda confirmação.
  emailPendente: string | null;
}) {
  const [novoEmail, setNovoEmail] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setErro(null);
    setEnviadoPara(null);
    startTransition(async () => {
      const resultado = await solicitarTrocaEmailAdmin(novoEmail);
      if ("error" in resultado) {
        setErro(resultado.error);
        return;
      }
      setEnviadoPara(resultado.email);
      setNovoEmail("");
    });
  }

  const pendente = enviadoPara ?? emailPendente;

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Label>E-mail de acesso atual</Label>
        <p className="text-sm font-medium">{emailAtual}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="novo_email">Novo e-mail</Label>
        <Input
          id="novo_email"
          type="email"
          autoComplete="email"
          placeholder="novo@exemplo.com"
          value={novoEmail}
          onChange={(event) => setNovoEmail(event.target.value)}
          required
        />
      </div>

      {erro && (
        <p role="alert" className="text-destructive text-sm">
          {erro}
        </p>
      )}

      {pendente && (
        <div className="flex gap-2 rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <Mail className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <p>
              Um e-mail de confirmação foi enviado para <strong>{pendente}</strong>. Confirme para concluir a troca.
            </p>
            <p className="text-xs opacity-80">
              Dependendo da configuração de segurança do projeto, também é enviado um e-mail ao endereço atual — nesse
              caso, confirme nos dois. Até lá, você continua entrando com o e-mail atual.
            </p>
          </div>
        </div>
      )}

      <Button type="submit" disabled={isPending || !novoEmail.trim()} className="w-fit">
        {isPending ? "Enviando..." : "Alterar e-mail"}
      </Button>
    </form>
  );
}
