# 🚀 Almocu Monorepo - Microserviços & Gateway

Bem-vindo ao ecossistema **Almocu**. Este é um monorepo escalável, organizado em microserviços, com um API Gateway centralizado para autenticação e roteamento inteligente.

---

## 🏗️ Arquitetura e Organização

O projeto segue uma estrutura de **Monorepo** moderna, separando a inteligência do Gateway dos serviços de negócio.

```text
.
├── src/                    # 🛡️ API GATEWAY (Auth & Proxy)
│   ├── common/             # Middlewares (Proxy, Auth) e Filtros
│   ├── modules/            # Lógica de Autenticação e Usuários
│   └── main.ts             # Entrada principal (Porta 3000)
│
├── modules/                # 📦 MICROSERVIÇOS
│   ├── menu/               # Gestão de Cardápio (Porta 3200)
│   ├── stock/              # Gestão de Estoque (Porta 3100)
│   └── order/              # Gestão de Pedidos (Porta 3300)
│
└── docker-compose.yml      # 🐳 Orquestração de Infraestrutura
```

---

## 🚦 Roteamento API Gateway (Porta 3000)

O **Gateway (Porta 3000)** é a porta de entrada única da aplicação. Você **não precisa** e **não deve** acessar os microserviços diretamente pelas portas internas (3100, 3200, 3300) em produção. O Gateway faz a autenticação, o rate limiting e o roteamento transparente (`Proxying`).

| Serviço Original | Acesso Pelo Gateway (Recomendado) | Descrição |
| :--- | :--- | :--- |
| **Auth** (App Root) | `http://localhost:3000/auth/*` | Login (`/login`), Registro (`/register`) e Saída (`/logout`) |
| **Stock Service** | `http://localhost:3000/api/stock/*` | Ex: `GET /api/stock/product/user/all` |
| **Menu Service** | `http://localhost:3000/api/menu/*` | Ex: `POST /api/menu/product` |
| **Order Service** | `http://localhost:3000/api/order/*` | Ex: `GET /api/order/orders/user/all` |

> **Nota de Segurança:** Todas as rotas `/api/*` e `/auth/logout` exigem um token JWT válido enviado no cabeçalho `Authorization: Bearer <token>`.

---

## 🛡️ Segurança e Multi-Tenancy

* **Isolamento de Dados (Multi-Tenant):** Todos os dados são separados usando o `restaurantId`. O sistema suporta **Tenancy Dinâmica** via cabeçalho `x-restaurant-id`.
* **Tenancy Dinâmica:** Você pode alternar o contexto do restaurante em qualquer requisição enviando o header `x-restaurant-id: <id_do_restaurante>`. O Gateway validará automaticamente se o usuário possui acesso ao restaurante solicitado antes de proxiar a requisição.
* **Blacklist de Tokens:** Ao fazer logout, o token é invalidado imediatamente via **Redis**.
* **Rate Limiting:** Proteção contra força bruta e excesso de requisições via NestJS Throttler.

---

## 🔐 Configuração (.env)

O projeto utiliza variáveis de ambiente para conexões de banco e segredos. Certifique-se de ter um arquivo `.env` na raiz:

### Gateway (`.env` na raiz)
```env
# Banco de Dados Auth (MongoDB)
MONGODB_URI=mongodb://mongodb:27017/auth_app

# Cache e Sessão (Redis)
REDIS_URI=redis://redis:6379

# Autenticação
JWT_SECRET=super-secret-key-123
```

### Microserviços
Os microserviços já estão configurados no `docker-compose.yml` para usar o MongoDB interno, mas se precisar alterar:
*   `MONGODB_URI`: `mongodb://mongodb:27017/nome_do_servico`

---

## 🛠️ Comandos Úteis

### Subir o Ambiente Completo
```bash
sudo docker-compose up --build -d
```

### Ver Logs de um Serviço Específico
```bash
sudo docker-compose logs -f auth-app
sudo docker-compose logs -f stock-app
```

### Limpar Tudo (Volumes e Containers órfãos)
```bash
sudo docker-compose down -v --remove-orphans
```

---

---

⚡ *Desenvolvido com foco em alta performance e escalabilidade.*

## 📝 Notas de Desenvolvimento
- **Hot-Reload:** Os microserviços possuem volumes mapeados. Qualquer alteração em `modules/*/src` refletirá instantaneamente nos containers.
- **Gateway Build:** O Gateway (`auth-app`) não possui volume mapeado por segurança de permissões no Linux. Se alterar algo na raiz (`src/`), rode `docker-compose up --build auth-app`.

---
⚡ *Desenvolvido com foco em alta performance e escalabilidade.*
