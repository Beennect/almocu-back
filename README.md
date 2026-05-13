# 🚀 Almocu Monorepo - Microserviços & API

Bem-vindo ao ecossistema **Almocu**. Este é um monorepo NestJS escalável, organizado em microserviços de negócio: Auth, Menu, Stock, e Order.

---

## 🏗️ Arquitetura e Organização

O projeto segue a estrutura oficial de Monorepo do NestJS (`apps/` e `libs/`):

```text
.
├── apps/                   # 📦 MICROSERVIÇOS
│   ├── auth/               # Serviço de Autenticação (Porta 3000)
│   ├── menu/               # Gestão de Cardápio (Porta 3200)
│   ├── stock/              # Gestão de Estoque (Porta 3100)
│   └── order/              # Gestão de Pedidos (Porta 3300)
│
├── libs/                   # 📚 BIBLIOTECAS COMPARTILHADAS
│   └── common/             # Middlewares, Guards e Configurações globais
│
└── docker-compose.yml      # 🐳 Orquestração de Infraestrutura
```

---

## 🚦 Serviços e Portas

| Serviço | Porta Local | Descrição |
| :--- | :--- | :--- |
| **Auth** | `3000` | Autenticação, Cadastro de Restaurantes e Usuários |
| **Stock** | `3100` | Gestão de Produtos e Estoque |
| **Menu** | `3200` | Gestão de Cardápio |
| **Order** | `3300` | Gestão de Pedidos |

> **Nota de Segurança:** As rotas protegidas exigem um token JWT válido enviado no cabeçalho `Authorization: Bearer <token>`. O projeto também suporta isolamento multi-tenant via cabeçalho `x-restaurant-id`.

---

## 💻 Desenvolvimento Local

O jeito mais fácil de rodar o projeto localmente é levantar a infraestrutura com o Docker e rodar o código NodeJS na sua máquina via terminal.

### 1. Configurar Variáveis de Ambiente
Crie ou ajuste o arquivo `.env` na raiz do projeto com as seguintes variáveis apontando para os serviços que serão levantados no Docker (localhost):

```env
# Configuração de Ambiente
NODE_ENV=production

# Segredos e Segurança
# Troque por uma chave longa e segura em produção
JWT_SECRET=sua_chave_secreta_aqui_muito_longa_e_segura_123

# Google OAuth (Obrigatório para login via Google)
# Obtenha em: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=seu_google_client_id_aqui
GOOGLE_CLIENT_SECRET=seu_google_client_secret_aqui
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Banco de Dados e Cache (Configurações internas do Docker Compose)
# Geralmente você não precisa alterar estas se estiver usando o docker-compose.yml padrão
MONGODB_URI=mongodb://mongodb:27017/almocu
REDIS_URI=redis://redis:6379

# URLs dos Microserviços (Interno do Docker)
MENU_SERVICE_URL=http://menu-app:3000
STOCK_SERVICE_URL=http://stock-app:3000
ORDER_SERVICE_URL=http://order-app:3000

# Portas Expostas (Mapping no Host)
AUTH_PORT=3000
MENU_PORT=3200
STOCK_PORT=3100
ORDER_PORT=3300
MONGO_PORT=27018
REDIS_PORT=63790
```

### 2. Subir a Infraestrutura (DB e Cache)
Use o Docker para subir o MongoDB e o Redis localmente:
```bash
docker-compose up -d mongodb redis
```

### 3. Instalar Dependências e Rodar os Apps
Instale as dependências (já usamos **SWC compiler** para builds 20x mais rápidos):
```bash
npm install
```

Inicie cada microserviço em uma janela de terminal separada com hot-reload ativo:
```bash
npm run start:dev:auth
npm run start:dev:menu
npm run start:dev:stock
npm run start:dev:order
```

---

## 🐳 Subir Tudo via Docker (Homologação)

Se você quiser rodar o ecossistema completo usando os containers Docker da aplicação (sem usar `npm run start` na sua máquina):

```bash
docker-compose up --build -d
```
*Para limpar volumes e recriar tudo limpo: `docker-compose down -v --remove-orphans`*

---
⚡ *Desenvolvido com foco em alta performance e escalabilidade usando NestJS e SWC.*
