"use client";

// "use client": máscara aplicada a cada tecla digitada (onChange).

import * as React from "react";
import { Input } from "@/components/ui/input";

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

// Só formato celular (DDD + 9 dígitos, 11 no total) — diferente de formatTelefone()
// (src/lib/alunos/schema.ts), que também aceita fixo (10 dígitos). Pedido explícito: bloquear
// em 11 dígitos, sempre nesse formato. .slice(0, 11) descarta qualquer dígito além do 11º.
export function maskTelefone(valor: string): string {
  return apenasDigitos(valor)
    .slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function telefoneCompleto(valor: string): boolean {
  return apenasDigitos(valor).length === 11;
}

type TelefoneInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode" | "value" | "onChange"
> & {
  value: string;
  // Já recebe o valor COM máscara aplicada — mesmo padrão de CpfInput (src/components/ui/cpf-input.tsx).
  onValueChange: (valorMascarado: string) => void;
};

// Substitui um <Input> comum de telefone: aplica (00) 90000-0000 a cada tecla e trava em 11
// dígitos. Só aceita celular (11 dígitos) — um telefone fixo (10 dígitos) nunca completa o
// formato e não passa na validação de "11 dígitos" do formulário que usar este componente.
export function TelefoneInput({ value, onValueChange, placeholder = "(00) 90000-0000", ...props }: TelefoneInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={maskTelefone(value)}
      onChange={(evento) => onValueChange(maskTelefone(evento.target.value))}
    />
  );
}
