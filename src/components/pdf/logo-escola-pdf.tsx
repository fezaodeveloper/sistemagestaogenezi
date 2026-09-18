import { Image } from "@react-pdf/renderer";

// Logo da escola no cabeçalho dos PDFs. `logoUrl` é o data URI devolvido por
// carregarLogoEscolaParaPdf / getLogoEscolaPdf (ou null — sem logo cadastrada
// ou em formato que o @react-pdf não desenha: nesse caso não renderiza nada).
export function LogoEscolaPdf({ logoUrl }: { logoUrl?: string | null }) {
  if (!logoUrl) return null;
  return (
    // eslint-disable-next-line jsx-a11y/alt-text -- <Image> aqui é o componente do @react-pdf/renderer, não um <img> HTML
    <Image src={logoUrl} style={{ width: 120, height: 40, objectFit: "contain", objectPositionX: 0, marginBottom: 6 }} />
  );
}
