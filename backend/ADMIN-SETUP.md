# Backend, banco e painel administrativo

O frontend continua no GitHub Pages. A API Fastify roda no Render e o PostgreSQL fica no Supabase. O Render compila a API para JavaScript antes de iniciá-la. Ao iniciar, a API cria as tabelas no Supabase automaticamente: o catálogo começa vazio, e os presentes adicionados pelo painel e os novos pedidos ficam salvos no banco. Não precisa importar o SQLite local nem executar SQL manualmente.

As fotos do casal e as imagens dos presentes continuam no Cloudinary. O PostgreSQL guarda os dados do presente, inclusive a URL da imagem; o arquivo da imagem fica no Cloudinary. A API usa as credenciais Cloudinary para listar a galeria e assinar uploads.

## Publicação inicial

1. Crie um projeto no Supabase e copie a connection string PostgreSQL em **Project Settings → Database → Connect**. Para um serviço hospedado no Render, use a connection string do **Transaction pooler** se a conexão direta não estiver disponível. Mantenha `sslmode=require` na URL. Essa URL é um segredo: use-a somente nas configurações do Render ou no `.env` local, nunca no frontend, GitHub Pages ou no Git.
2. No Render, crie um **Blueprint** a partir deste repositório e selecione o arquivo `render.yaml` da raiz. Preencha os valores solicitados como secretos, especialmente `DATABASE_URL`, `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET`. No primeiro início, a API cria o schema vazio no Supabase automaticamente.
3. Escolha uma senha administrativa longa. Gere um segredo de sessão com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` e configure o resultado em `ADMIN_SESSION_SECRET`. Guarde os dois somente no Render; não os envie por mensagem nem os coloque no frontend. Se o segredo de sessão mudar, as sessões administrativas atuais serão encerradas.
4. Depois do primeiro deploy, abra `https://<nome-do-servico>.onrender.com/api/health`. A resposta deve conter `"status":"UP"`. O endpoint também testa a conexão com o banco.
5. No GitHub, abra **Settings → Secrets and variables → Actions → Variables** e crie `API_BASE_URL` com a URL pública do Render, sem barra no final (por exemplo, `https://sitecasamento-api.onrender.com`). Execute novamente o workflow **Deploy Angular to GitHub Pages**. O workflow já injeta essa variável no build; ela não é um segredo.
6. No Render, confirme `CORS_ORIGINS` como a origem do Pages, sem caminho (por exemplo, `https://lucasjesusone.github.io`). Se usar domínio próprio, inclua a origem exata aqui e configure `FRONTEND_PUBLIC_URL` com o endereço público completo do site.

## Painel e imagens

Configure `ADMIN_PASSWORD` e `ADMIN_SESSION_SECRET` no Render e abra `/admin` no domínio do GitHub Pages. As duas administradoras podem usar a mesma senha nesta primeira versão. Configure no Render `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` e `CLOUDINARY_API_SECRET`. A pasta da galeria é `wedding` e a pasta de imagens dos presentes é `Gifts`.

Depois de publicar, entre em `/admin` e adicione os presentes; eles serão gravados no Supabase. Quando o site estiver no ar, cadastre e teste um presente antes de divulgar a lista. Para zerar o catálogo, remova os presentes pelo painel administrativo.

## Pagamentos Mercado Pago

O backend pode ser publicado sem configurar pagamentos. Quando quiser habilitar o checkout, adicione as variáveis abaixo em **Render → serviço → Environment** e faça um novo deploy:

1. Configure `MERCADOPAGO_ACCESS_TOKEN` com o token da aplicação. Para testes, use as credenciais de teste e mantenha `MERCADOPAGO_SANDBOX=true`.
2. Configure `MERCADOPAGO_WEBHOOK_URL` como `https://<nome-do-servico>.onrender.com/api/payments/mercadopago/webhook` e cadastre essa mesma URL nas notificações Webhook do Mercado Pago.
3. Copie o segredo de assinatura do Webhook para `MERCADOPAGO_WEBHOOK_SECRET`.
4. O site só marca um pedido como pago após validar a assinatura do Webhook e confirmar o pagamento pela API do Mercado Pago. O checkout continua desabilitado até as três variáveis de pagamento estarem configuradas.

Para pagamentos reais, configure credenciais de produção, `MERCADOPAGO_SANDBOX=false` e o Webhook público HTTPS. Antes de aceitar pagamentos reais, escolha planos de hospedagem que mantenham a API e o banco disponíveis continuamente; planos gratuitos podem suspender serviços ou ter limites de uso.
