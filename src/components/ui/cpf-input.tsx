"use client";

// "use client": máscara aplicada a cada tecla digitada (onChange).

import * as React from "react";
import { Input } from "@/components/ui/input";

function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, "");
}

// Mesmo estilo de replace encadeado de formatCpf (src/lib/alunos/schema.ts) — cada regex só bate
// quando já tem dígitos suficientes, então o número parcial (ainda digitando) fica parcialmente
// mascarado em vez de esperar os 11 dígitos completos pra mostrar qualquer pontuação.
// .slice(0, 11) bloqueia o 12º dígito pra frente — dígito extra digitado é simplesmente ignorado.
export function maskCpf(valor: string): string {
  return apenasDigitos(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function cpfCompleto(valor: string): boolean {
  return apenasDigitos(valor).length === 11;
}

type CpfInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "inputMode" | "value" | "onChange"
> & {
  value: string;
  // Já recebe o valor COM máscara aplicada — o consumidor não precisa chamar maskCpf() de novo,
  // só guardar a string recebida (mesmo padrão de onChange de um <input>, só que sem o Event).
  onValueChange: (valorMascarado: string) => void;
};

// Substitui um <Input> comum de CPF: aplica a máscara 000.000.000-00 a cada tecla e trava em 11
// dígitos (dígito a mais é descartado, nunca aceito). Validar "não pode ter MENOS de 11 dígitos
// ao salvar" continua sendo responsabilidade do schema Zod do formulário (cpfSchema em
// src/lib/alunos/schema.ts já faz isso) — máscara no client nunca é a fronteira de validação de
// verdade, só ajuda a digitar.
export function CpfInput({ value, onValueChange, placeholder = "000.000.000-00", ...props }: CpfInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      placeholder={placeholder}
      value={maskCpf(value)}
      onChange={(evento) => {
        const mascarado = maskCpf(evento.target.value);
        // Mesmo caso do TelefoneInput (src/components/ui/telefone-input.tsx): quando o dígito
        // extra é descartado e o valor mascarado repete o anterior, React não re-renderiza e o
        // DOM ficaria com o caractere a mais já inserido pelo navegador. Força de volta aqui.
        evento.target.value = mascarado;
        onValueChange(mascarado);
      }}
    />
  );
}
