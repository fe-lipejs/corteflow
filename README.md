# CorteFlow (Navalha SaaS)

CorteFlow é uma plataforma SaaS multi-tenant de agendamento para Barbearias, Salões de Beleza e Esmalterias.

## Stack Tecnológica
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (Auth + Postgres + Edge Functions)
- Stripe (Billing e Connect)
- React Query, React Hook Form + Zod, React Router DOM, Framer Motion, react-i18next

## Como rodar o projeto localmente

1. Clone o repositório.
2. Instale as dependências com `npm install`.
3. Renomeie (ou copie) o arquivo `.env.example` para `.env` e preencha com as suas chaves do Supabase e do Stripe.
4. Execute `npm run dev` para iniciar o servidor de desenvolvimento.

## 🚀 Deploy e Variáveis de Ambiente (MUITO IMPORTANTE)

Ao fazer o deploy do projeto em serviços como Vercel, Netlify, Render, etc, **lembre-se de configurar as Variáveis de Ambiente no painel da plataforma de hospedagem.**

O arquivo `.env` **NÃO** sobe para o GitHub por razões de segurança (ele está no `.gitignore`), então a sua plataforma de deploy não saberá quais são as chaves, a menos que você as cadastre lá.

Você precisa configurar na plataforma as mesmas chaves que estão no seu `.env.example`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_STRIPE_PUBLIC_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_CONNECT_CLIENT_ID`

Após configurar essas variáveis no seu serviço de hospedagem, o deploy funcionará corretamente comunicando-se com o Supabase e o Stripe!
