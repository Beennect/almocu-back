# 🚀 Almocu Monorepo - Microserviços & API

Bem-vindo ao ecossistema **Almocu**. Este é um monorepo NestJS escalável, organizado em microserviços de negócio: Auth (Gateway), Menu, Stock, e Order.

---

## 🏗️ Arquitetura e Organização

O projeto utiliza o **serviço de Auth como um API Gateway**. Isso significa que você pode acessar todos os microserviços através da porta **3000**.

```text
.
├── apps/                   # 📦 MICROSERVIÇOS
│   ├── auth/               # Gateway & Autenticação (Porta 3000)
│   ├── menu/               # Gestão de Cardápio (Porta 3200)
│   ├── stock/              # Gestão de Estoque (Porta 3100)
│   └── order/              # Gestão de Pedidos (Porta 3300)
│
├── libs/                   # 📚 BIBLIOTECAS COMPARTILHADAS
│   └── common/             # Estratégias, Guards e Schemas compartilhados
│
└── docker-compose.yml      # 🐳 Orquestração completa (DBs + Apps)
```

---

## 🚦 Acesso via Gateway (Porta 3000)

Para facilitar o desenvolvimento do Front-end, o serviço de **Auth** atua como um Proxy reverso. Você não precisa trocar de porta para falar com diferentes serviços:

| Endpoint | Serviço Destino | Descrição |
| :--- | :--- | :--- |
| `POST :3000/auth/login` | **Auth** | Autenticação e geração de token |
| `ANY :3000/api/stock/*` | **Stock** | Redireciona para o microserviço de estoque |
| `ANY :3000/api/menu/*` | **Menu** | Redireciona para o microserviço de cardápio |
| `ANY :3000/api/order/*` | **Order** | Redireciona para o microserviço de pedidos |

---

## 🏢 Multi-Tenancy e Contexto Dinâmico

O sistema é **multi-tenant**, permitindo que um mesmo usuário tenha diferentes cargos (cargo/role) em diferentes restaurantes.

### Como funciona a troca de contexto:
1.  **Token JWT**: Contém o `restaurantId` e `role` padrão do usuário (geralmente do restaurante onde ele se cadastrou ou logou por último).
2.  **Troca Dinâmica**: Você pode acessar dados de **qualquer restaurante** ao qual tenha acesso sem precisar deslogar. Para isso, envie o ID do restaurante alvo em um destes locais (em ordem de prioridade):
    *   **Header**: `x-restaurant-id: <ID_DO_RESTAURANTE>`
    *   **Body**: `{ "restaurantId": "<ID_DO_RESTAURANTE>", ... }`
    *   **Query**: `?restaurantId=<ID_DO_RESTAURANTE>`

O Gateway valida se você tem acesso a esse restaurante e injeta automaticamente os cabeçalhos de contexto (`x-tenant-id`, `x-user-role`) para os microserviços.

### Cargos (Roles):
- `OWNER`: Dono do restaurante (acesso total).
- `MANAGER`: Gerente.
- `WAITER`: Garçom.
- `KITCHEN`: Cozinha.
- `CASHIER`: Caixa.

*Nota: **Admins Globais** (globalRoles: ['admin']) ignoram as travas de restaurante e podem acessar qualquer contexto como OWNER.*

---

## 💻 Desenvolvimento Local

### 1. Configurar Variáveis de Ambiente
Ajuste o `.env` na raiz:
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/database
REDIS_URI=redis://localhost:63790
JWT_SECRET=sua-chave-secreta
```

### 2. Rodar os Serviços
```bash
npm install

# Iniciar o Gateway (Obrigatório para o Proxy)
npm run start:dev:auth

# Iniciar outros serviços conforme necessário
npm run start:dev:stock
npm run start:dev:menu
npm run start:dev:order
```

### 3. Documentação Swagger
Cada serviço possui sua própria documentação:
- **Gateway/Auth**: `http://localhost:3000/api`
- **Stock**: `http://localhost:3100/api`
- **Menu**: `http://localhost:3200/api`
- **Order**: `http://localhost:3300/api`

---
⚡ *Desenvolvido com NestJS, MongoDB e Redis.*
