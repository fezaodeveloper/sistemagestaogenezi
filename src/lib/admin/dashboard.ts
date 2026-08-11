import type { LucideIcon } from "lucide-react";

// Contrato comum pra qualquer "balão" de pendência no dashboard do
// admin — cada domínio (resgates, e no futuro certificados/mensagens)
// implementa sua própria function que devolve esse formato (ou null se
// não há nada pendente). O componente DashboardBalao não sabe nada
// sobre o domínio de origem, só sabe renderizar esse contrato — um
// balão novo é 1 function nova + 1 entrada no array da página, sem
// mexer no componente nem no layout.
export type DashboardNotificacao = {
  chave: string;
  titulo: string;
  quantidade: number;
  href: string;
  icone: LucideIcon;
};
