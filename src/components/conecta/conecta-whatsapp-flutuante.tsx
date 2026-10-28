import { MessageCircle } from "lucide-react";

const MENSAGEM_DUVIDAS = encodeURIComponent("Olá! Tenho dúvidas sobre o Gênezi Conecta.");

// Sem estado/hooks — não precisa de "use client" próprio, mesmo sendo renderizado dentro de um
// componente client (vagas-publicas-view.tsx).
export function ConectaWhatsappFlutuante({ whatsappEscolaDigitos }: { whatsappEscolaDigitos: string | null }) {
  if (!whatsappEscolaDigitos) return null;

  return (
    <a
      href={`https://wa.me/55${whatsappEscolaDigitos}?text=${MENSAGEM_DUVIDAS}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed right-5 bottom-5 z-40 flex items-center gap-2 rounded-full bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-green-700"
    >
      <MessageCircle className="size-5" />
      Fale conosco
    </a>
  );
}
