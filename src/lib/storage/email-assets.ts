// Bucket das imagens do editor visual de e-mail (TAREFA email 2.3, PARTE 3).
//
// Criado via migration SQL (20261030400000_fix_email_descadastros.sql,
// `insert into storage.buckets (...)`), mesmo padrão já usado pelos buckets
// "campanhas-marketing"/"campanha-paginas". Público: a imagem precisa carregar em qualquer
// cliente de e-mail, de destinatários sem sessão nenhuma no projeto.
export const EMAIL_ASSETS_BUCKET = "email-assets";

export const EMAIL_ASSET_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB
export const EMAIL_ASSET_TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
