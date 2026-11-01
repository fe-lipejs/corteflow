# 💈 Raffros CorteFlow — Dossiê Completo do Sistema para Sócios & Investidores

> **Documento Estratégico & Funcional**  
> **Versão:** 2.0 (Atualizada)  
> **Objetivo:** Apresentação executiva para sócios, investidores e parceiros estratégicos detalhando todas as funcionalidades, modelo de negócio, diferenciais competitivos e arquitetura técnica da plataforma.

---

## 🧭 1. Resumo Executivo & Visão do Negócio

O **Raffros CorteFlow** é uma plataforma **SaaS B2B2C (Software as a Service)** desenvolvida sob medida para **Barbearias, Salões de Beleza, Esmalterias e Studios de Estética**.

O software resolve os **3 maiores problemas** enfrentados por donos de estabelecimentos de beleza:

1. **O "Furo" na Agenda (No-Show):** Clientes que marcam e não aparecem geram prejuízos diários de até 30% do faturamento. O sistema resolve isso com a **tecnologia Anti-Furo** (exigência opcional de sinal/entrada via PIX ou Cartão).
2. **Tempo Desperdiçado no WhatsApp:** Atendentes e barbeiros gastam horas trocando mensagens para encontrar um horário vago. O CorteFlow oferece uma página de agendamento online rápida onde o cliente marca em **menos de 45 segundos**.
3. **Descontrole Financeiro e de Comissões:** Cálculo de comissões no caderno ou planilhas desorganizadas. O sistema calcula automaticamente o faturamento, comissão individual de cada profissional e lucro líquido em tempo real.

---

## 👥 2. As Duas Pontas da Solução

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│     CLIENTE FINAL (QUEM AGENDA) │           │   DONO DO SALÃO (QUEM GERENCIA) │
├─────────────────────────────────┤           ├─────────────────────────────────┤
│ • Sem necessidade de senha      │           │ • Agenda estilo Google Calendar │
│ • Agenda em 4 passos rápidos    │           │ • Controle de sinal anti-furo   │
│ • Link direto ou via WhatsApp   │  ───────► │ • Gestão de equipe e comissões  │
│ • Reagendamento autônomo        │           │ • Fluxo de caixa e faturamento  │
│ • Portal exclusivo do cliente   │           │ • Personalização total de marca │
└─────────────────────────────────┘           └─────────────────────────────────┘
                                       ▲
                                       │
                    ┌──────────────────────────────────┐
                    │ SUPER ADMIN (TORRE DE CONTROLE)  │
                    ├──────────────────────────────────┤
                    │ • Gestão de assinaturas Stripe   │
                    │ • Gerador de Demos p/ prospecção │
                    │ • Telemetria e mapa de atenção   │
                    │ • Suporte e chat ao vivo         │
                    └──────────────────────────────────┘
```

---

## 📱 3. A Experiência do CLIENTE FINAL (Quem agenda)

A experiência do cliente foi desenhada com filosofia **Mobile-First** (95% dos acessos vêm de celulares via Instagram ou WhatsApp). O cliente **NÃO precisa criar conta com senha** e **NÃO precisa baixar nenhum aplicativo**.

### 🌟 3.1. Página Pública do Estabelecimento (`https://www.raffros.com/{slug}`)
- **Identidade Própria (White-Label):** A página exibe a logotipo, capa/banner, cores de destaque, descrição do salão, endereço físico e link para o Instagram oficial.
- **Cardápio Visual de Serviços:** Lista de cortes, químicas, barboterapia, manicure, com fotos reais, descrição dos procedimentos, tempo de duração e preço transparente.
- **Vitrine da Equipe:** Fotos dos profissionais, cargos e especialidades.
- **Horários de Funcionamento:** Indicação clara de dias abertos, fechados e horários de expediente.

### ⚡ 3.2. Fluxo de Agendamento em 4 Etapas (Wizard Intuitivo)
1. **Passo 1 — Escolha do Serviço:** O cliente seleciona o serviço desejado (ex: *Corte Degradê + Barboterapia*).
2. **Passo 2 — Escolha do Profissional:** O cliente pode escolher seu profissional de preferência ou selecionar *"Qualquer profissional disponível"* (o algoritmo encaixa automaticamente no primeiro horário vago).
3. **Passo 3 — Escolha de Data e Horário:** Carrossel dinâmico de dias. O sistema exibe **apenas os horários realmente livres**, calculando a duração do serviço + tempo de intervalo/limpeza (buffer) e respeitando horário de almoço e bloqueios.
4. **Passo 4 — Identificação & Confirmação:** O cliente informa seu **Nome** e **WhatsApp com DDD**. Se o salão exigir sinal, o valor da entrada é processado com segurança.

### 🛡️ 3.3. Modos de Pagamento Flexíveis (Configurado pelo Salão)
- **Modo 1 — Pagar no Local:** O agendamento é confirmado e o valor é pago após o atendimento.
- **Modo 2 — Sinal / Entrada Antecipada:** O cliente paga uma porcentagem (ex: 30% ou 50%) no ato do agendamento para garantir a vaga na cadeira. O saldo restante é pago no local.
- **Modo 3 — Pagamento 100% Antecipado:** O valor integral é quitado no momento do agendamento.
- **Modo 4 — Cliente Escolhe:** O cliente decide se prefere antecipar ou pagar na hora.

### 💬 3.4. Notificação Instantânea via WhatsApp
Assim que o agendamento é concluído:
- É gerado um **código de pedido único** (ex: `#BK-9482`).
- Um botão direciona o cliente diretamente para o **WhatsApp da barbearia** com uma mensagem pré-formatada completa:
  ```text
  📅 Novo Agendamento #BK-9482
  👤 Cliente: Felipe Silva
  💈 Serviço: Corte Degradê & Navalha
  🧑‍💼 Profissional: Carlos Barbeiro
  🗓️ Data/Hora: 14/11 às 15:30
  💳 Pagamento: Entrada de 50% paga — Saldo a pagar no local: R$ 25,00
  
  Acompanhe ou reagende aqui: https://www.raffros.com/portal/BK-9482
  ```

### 🔓 3.5. Portal do Cliente (Self-Service 100% Sem Senha)
- Acessível pelo link direto recebido ou digitando o número de telefone.
- O cliente visualiza seus agendamentos ativos e passados.
- **Reagendamento Autônomo:** Se o cliente precisar mudar o horário, ele próprio escolhe uma nova data disponível sem precisar ligar ou incomodar a equipe.
- **Cancelamento Consciente:** Opção de cancelamento dentro do prazo estipulado pelo estabelecimento.

---

## 💈 4. A Experiência do DONO DO SALÃO (Painel Administrativo `/admin`)

O painel de controle do proprietário é um sistema de gestão robusto, intuitivo e moderno, acessível tanto pelo computador quanto pelo celular.

### 📊 4.1. Visão Geral (Dashboard Inteligente)
- **KPIs em Tempo Real:**
  - *Agendamentos Hoje:* Quantidade de clientes marcados para o dia com comparativo em relação a ontem.
  - *Faturamento Previsto:* Total em reais previsto para o dia atual baseado nos serviços agendados.
  - *Ocupação da Cadeira:* Percentual de ocupação em tempo real (calculado com base nas horas abertas vs. horas agendadas).
  - *Novos Clientes na Semana:* Quantidade de novos clientes que conheceram o salão nos últimos 7 dias.
- **Lista de Próximos Atendimentos:** Visualização clara dos clientes que estão para chegar, com alerta visual de *"Atrasado"* caso o horário tenha passado sem conclusão.
- **Gráfico Preditivo da Semana:** Gráfico de barras com a receita prevista para os próximos 7 dias (domingo a sábado).
- **Top Serviços:** Ranking dos serviços mais procurados e rentáveis do mês.
- **Botão "+ Agendar":** Permite ao barbeiro ou recepcionista lançar manualmente na agenda um cliente que chegou sem agendar pela internet.

### 📅 4.2. Agenda Interativa Estilo Google Calendar (`/admin/agenda`)
- **Visão Semanal e Diária:** Grade horária das 8h às 20h com colunas por dia ou por profissional.
- **Cores por Serviço:** Cada agendamento possui a cor da categoria do serviço facilitando a leitura visual rápida.
- **Gestão de Horários Bloqueados:** O dono pode bloquear feriados, manutenções ou folgas de profissionais com um clique, impedindo agendamentos públicos nesses períodos.
- **Filtro por Profissional:** Visualize a agenda de todos os colaboradores simultaneamente ou foque em um barbeiro específico.

### 👥 4.3. Gestão de Equipe & Controle Rígido de Acesso (`/admin/equipe`)
- Cadastro de profissionais com foto de perfil, cargo, telefone e cor personalizada na agenda.
- **Controle de Acesso por Níveis (RBAC):**
  - *Dono / Gerente:* Acesso total ao financeiro, configurações, clientes e relatórios.
  - *Profissional / Barbeiro:* Acesso restrito! O profissional possui as telas exclusivas **"Minha Área"** e **"Minha Comissão"**, onde visualiza apenas seus próprios agendamentos e seu ganho acumulado, **sem enxergar o faturamento geral do salão nem dados de outros colegas**.
- **Regras de Planos:** Limite configurável de colaboradores conforme o plano assinado (ex: 1 no Starter, até 10 no Studio/Growth).

### ✂️ 4.4. Catálogo de Serviços & Produtos (`/admin/servicos`)
- **Aba Serviços:** Cadastro de nome, preço, tempo de atendimento (em blocos de 5 minutos), tempo de intervalo (buffer para troca de toalhas e assepsia), categoria e foto de alta resolução.
- **Aba Produtos:** Controle de itens de revenda (pomadas, óleos para barba, shampoos, finalizadores). Exibe estoque e preço de venda.

### 📇 4.5. CRM Inteligente de Clientes (`/admin/clientes`)
- **Alimentação 100% Automática:** Cada pessoa que agenda pela página pública é cadastrada automaticamente na base do salão.
- **Segmentação Automática:**
  - 🟢 **Novos:** Clientes que realizaram apenas 1 atendimento.
  - 🟡 **Fiéis:** Clientes com 3 ou mais atendimentos concluídos.
  - ⭐ **VIPs:** Clientes de alto valor acumulado.
- **Ficha Cadastral:** Histórico de todos os cortes já feitos, ticket médio gasto na barbearia, data de aniversário e anotações internas (ex: *"Prefere degradê navalhado número 1 e café sem açúcar"*).
- Botão com 1 clique para abrir conversa direta no WhatsApp do cliente.

### 💰 4.6. Módulo Financeiro & Fluxo de Caixa (`/admin/financeiro`)
- **Entradas Automáticas:** Cada agendamento concluído gera uma receita financeira com discriminação de serviço e profissional.
- **Lançamento de Despesas:** Registro de gastos fixos e variáveis (aluguel, água, energia, reposição de descartáveis).
- **Relatório de Desempenho:**
  - Faturamento Bruto.
  - Despesas Totais.
  - **Lucro Líquido Real.**
- Filtros por período customizado e **exportação completa em Excel e PDF** com um clique para contabilidade.

### 🎨 4.7. Configurações de Identidade & Temas (`/admin/configuracoes`)
- **3 Presets Visuais Prontos:**
  1. *Barbearia Clássica:* Fundo escuro terroso, tons dourados e estética vintage de navalha.
  2. *Noir:* Preto absoluto minimalista, visual premium com acabamento em rosa/accent.
  3. *Modo Claro:* Branco puro com estética clean, arejada e corporativa.
- **Paleta Personalizada:** O dono pode ajustar individualmente as cores hexadecimais de Fundo, Texto, Cartão e Cor de Destaque.
- **Upload de Identidade:** Logotipo quadrado e banner retangular para o topo da página pública.
- **Horários de Expediente:** Definição por dia da semana de horário de abertura, fechamento e intervalo de almoço.
- **Configuração da Política Anti-Furo:** Escolha entre confirmação simples, sinal em porcentagem ou pagamento integral.

---

## 👑 5. A Plataforma SUPER ADMIN (A Torre de Controle `/platform`)

Esta é a área reservada **exclusivamente aos donos e sócios do SaaS** para governança, expansão e monetização do negócio.

### 🏢 5.1. Gestão de Inquilinos (Tenants)
- Listagem completa de todos os salões cadastrados no Brasil e no mundo.
- Ações com 1 clique:
  - Ver painel do salão (impersonação administrativa para prestar suporte).
  - Ver página pública de agendamento.
  - Suspender ou reativar conta (em caso de inadimplência).
  - Bloquear ou excluir salão.

### 📈 5.2. Métricas Estratégicas de SaaS (KPIs Financeiros)
- **MRR (Monthly Recurring Revenue):** Faturamento recorrente mensal de assinaturas.
- **ARR (Annual Run Rate):** Projeção anual de receita.
- **Salões Ativos:** Contagem em tempo real de barbearias em operação.
- **Trials Abertos:** Estabelecimentos em período de teste gratuito de 7 dias.
- **Taxa de Conversão de Trial em Pago & Churn Rate:** Controle de retenção e perda de clientes.

### 💳 5.3. Planos & Preços Internacionais (Stripe Billing)
- CRUD completo de planos da plataforma (Starter vs. Growth/Studio).
- Tabela de preços dinâmicos por país e moeda (BRL, USD, EUR, GBP) sem taxas manuais:
  - *Brasil:* Starter R$ 27 / Growth R$ 77 (ou Studio R$ 89).
  - *Estados Unidos:* Starter US$ 9 / Growth US$ 24.
  - *Europa:* Starter € 9 / Growth € 24.
- **Preços Personalizados (Custom Pricing):** Capacidade de aplicar exceções ou descontos especiais para redes e grandes parceiros diretamente pelo painel.

### 🚀 5.4. Gerador de Portais Demo para Prospecção Comercial
Uma das ferramentas mais inovadoras da plataforma para venda ativa:
- O time comercial insere o nome da barbearia do prospect, WhatsApp do dono e tipo de negócio.
- O sistema gera em **30 segundos** uma página de agendamento real e personalizada com fotos de cortes e profissionais já cadastrados.
- O vendedor envia o link direto no WhatsApp do prospect:
  > *"Olá Marcos, criei uma demonstração de como ficaria a página da sua barbearia hoje: `raffros.com/paginas/barbearia-do-marcos`. Dê uma olhada!"*
- O prospect clica, se encanta e assina o serviço com taxa de conversão muito superior a propostas tradicionais.

### 🔬 5.5. Telemetria & Mapa de Atenção ao Vivo (`/platform/analytics`)
- Inteligência de dados que rastreia os visitantes da landing page comercial em tempo real.
- **Funil de Atenção:** Indica exatamente até qual seção da página os visitantes rolam e em qual ponto abandonam a navegação.
- **Ponto Focal:** Identifica em quais planos e cards os clientes passam mais tempo lendo.
- **Telemetria de Eventos:** Registro ao vivo de cliques, visualizações, navegadores e origens de tráfego (Instagram, Google, WhatsApp, Direto).

### 💬 5.6. Central de Suporte & Atendimento ao Vivo
- Chat bidirecional em tempo real entre o Super Admin e os donos de estabelecimentos conectados.
- Notificações de mensagens não lidas com badge sonoro e visual.

---

## 🥊 6. Diferenciais Competitivos vs. Grandes Concorrentes

| Critério | Raffros CorteFlow | Booksy / Trinks | Sistemas Antigos de Desktop |
| :--- | :---: | :---: | :---: |
| **Instalação para o Cliente** | 🟢 **Zero App** (Roda direto no navegador) | 🔴 Obriga o cliente a baixar app pesado | 🔴 Inexistente para o cliente |
| **Senha para Agendar** | 🟢 **Sem Senha** (Apenas WhatsApp) | 🔴 Cadastro longo com e-mail e senha | 🔴 Sem agendamento online |
| **Exclusividade de Marca** | 🟢 **100% Salão** (O cliente só vê sua barbearia) | 🔴 Mostra concorrentes mais baratos na mesma tela | 🟡 Não aplicável |
| **Proteção Anti-Furo** | 🟢 **Sinal Integrado** (PIX / Cartão) | 🟡 Raro ou com taxas abusivas | 🔴 Inexistente |
| **Facilidade de Uso** | 🟢 Interface moderna, rápida e intuitiva | 🟡 Poluída e cheia de menus complexos | 🔴 Visual antigo estilo anos 90 |
| **Multi-idioma** | 🟢 5 Idiomas nativos (PT, EN, ES, FR, DE) | 🟡 Focado apenas no mercado local | 🔴 Apenas um idioma |

---

## 🛠️ 7. Arquitetura Tecnológica de Ponta

- **Frontend:** React 19 + TypeScript com Vite para carregamento ultrarrápido (sub-segundo).
- **Estilização & Componentes:** Tailwind CSS com Design Tokens dinâmicos (suporte completo a temas Claro, Escuro e Customizados), animações suaves via Framer Motion e ícones Lucide.
- **Backend & Banco de Dados:** **Supabase (PostgreSQL Enterprise)** com:
  - *Row Level Security (RLS) Ativo:* Garantia matemática de que nenhum salão consegue ler ou acessar dados de outro salão.
  - *WebSockets em Tempo Real:* Atualização de agendamentos na tela sem necessidade de recarregar a página (F5).
  - *Storage Seguro:* Hospedagem de imagens de logotipos, capas e fotos de serviços.
- **Infraestrutura de Pagamentos:**
  - **Stripe Billing:** Cobrança automatizada de planos e assinaturas recorrentes com 7 dias de teste gratuito.
  - **Stripe Connect:** Infraestrutura para repasse automático dos pagamentos e sinais dos clientes diretamente para a conta dos salões.
- **Internacionalização (i18n):** Arquitetura de dois níveis com suporte nativo a Português, Inglês, Espanhol, Francês e Alemão.

---

## 💵 8. Fontes de Receita (Como a Plataforma Ganha Dinheiro)

1. **Assinaturas Mensais Recorrentes (SaaS):**
   - Plano Starter: R$ 27 a R$ 49 / mês (para profissionais autônomos).
   - Plano Studio / Growth: R$ 77 a R$ 89 / mês (para barbearias estruturadas com equipe).
2. **Taxa de Aplicação (Take-Rate no Stripe Connect):**
   - Cobrança de uma pequena porcentagem (ex: 1% a 2%) sobre cada pagamento ou sinal antecipado processado através da plataforma.
3. **Upsell de Módulos Premium:**
   - Pacotes de automação de WhatsApp via API oficial.
   - Domínios personalizados para grandes barbearias (`agendamento.suabarbearia.com.br`).

---

## 🏁 9. Conclusão para Apresentação a Sócios

O **Raffros CorteFlow** não é apenas mais um software de agenda; é uma **máquina de aumentar o faturamento de estabelecimentos de beleza**. 

Ao eliminar os horários ociosos por no-show e poupar o tempo de atendimento manual no WhatsApp, o sistema se paga nos primeiros 3 dias do mês para qualquer barbearia ou salão. 

A arquitetura tecnológica já está **100% construída, validada e operacional**, pronta para escalabilidade nacional e internacional.
