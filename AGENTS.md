# Almocu Back-end — AGENTS.md

> Contexto completo para assistentes de IA (Cline, Copilot, etc.) que forem trabalhar neste repositorio.
> Ultima atualizacao: 2026-05-24

## Indice

1. [Visao Geral](#visao-geral)
2. [Stack Tecnologica](#stack-tecnologica)
3. [Estrutura do Monorepo](#estrutura-do-monorepo)
4. [Arquitetura de Servicos](#arquitetura-de-servicos)
5. [Fluxo de Autenticacao](#fluxo-de-autenticacao)
6. [Camada de Transporte (API Gateway)](#camada-de-transporte-api-gateway)
7. [Modelos de Dados](#modelos-de-dados)
8. [Padroes e Convencoes](#padroes-e-convencoes)
9. [Pipeline CI/CD](#pipeline-cicd)
10. [Variaveis de Ambiente](#variaveis-de-ambiente)
11. [Comandos Uteis](#comandos-uteis)
12. [Swagger / Documentacao](#swagger--documentacao)
13. [Regras para Agentes de IA](#regras-para-agentes-de-ia)

---

## Visao Geral

**Almocu** e um ERP voltado a restaurantes. Este repositorio contem o **backend** em formato **NestJS monorepo** (Bun runtime).

### Dominios do Sistema

| Dominio | App | Responsabilidade |
|---------|-----|------------------|
| **Auth** | `auth-app` | Cadastro/login, Google OAuth, multi-tenancy (restaurantes), convites TOTP |
| **Menu** | `menu-app` | Cardapio (CRUD de produtos com ingredientes vinculados ao estoque) |
| **Stock** | `stock-app` | Controle de estoque (itens, quantidades, ajustes) |
| **Order** | `order-app` | Pedidos (criacao, status, maquina de estados) + pagamentos Stripe |

### Principais Fluxos

1. **Usuario** se registra/login -> recebe JWT
2. **Owner** cria restaurante -> recebe codigo TOTP -> convida staff
3. **Staff** entra via TOTP -> vinculado ao restaurante
4. **Gerente** cadastra itens no estoque e cria produtos (receitas) no cardapio
5. **Garcim** cria pedidos -> sistema deduz ingredientes do estoque via API
6. **Cozinha/Entrega** atualiza status do pedido (maquina de estados por role)
7. **Pagamento** via Stripe Checkout (sessao avulsa)

---

## Stack Tecnologica

| Camada | Tecnologia |
|--------|-----------|
| Runtime | **Bun** 1.x |
| Framework | **NestJS** 11 (monorepo com @nestjs/cli) |
| Linguagem | **TypeScript** 5.7 |
| Banco | **MongoDB** 7.0 via Mongoose 8 |
| Cache/Session | **Redis** via ioredis |
| Auth | passport (jwt, local, google-oauth20) |
| Pagamentos | Stripe SDK 14 |
| HTTP client | @nestjs/axios (Axios + RxJS) |
| Validacao | class-validator + class-transformer |
| Docs | Swagger / OpenAPI via @nestjs/swagger |
| Empacotamento | Webpack + SWC (builder do NestJS) |
| Container | Docker multi-stage com oven/bun:1 |
| CI | GitHub Actions + GitLab CI |

---

## Estrutura do Monorepo

```
almocu-back/
  apps/
    auth/              # API Gateway + Auth Service (porta 3000)
      src/
        auth/            # Login, register, Google OAuth, JWT
        restaurants/     # CRUD restaurantes, filiais, convite TOTP
        users/           # CRUD usuarios
        redis/           # RedisService (ioredis)
        common/
          middlewares/  # proxy.middleware.ts (roteamento para microservicos)
          decorators/  # roles.decorator
          guards/      # roles.guard
        app.module.ts    # Modulo raiz do auth-app
        main.ts          # Bootstrap (porta 3000)
    menu/              # Cardapio (porta 3000 em producao, 3200 local)
      src/
        product/         # CRUD produtos com ingredientes
          dto/           # CreateProductDto, UpdateProductDto, ProductPageDto
          product.controller.ts
          product.service.ts
          product.module.ts
        app.module.ts
        main.ts
    stock/             # Estoque (porta 3000 em producao, 3100 local)
      src/
        stock/           # CRUD itens + ajuste de quantidade
          dto/           # CreateStockDto, UpdateStockDto, AdjustStockDto, StockPageDto
          stock.controller.ts
          stock.service.ts
          stock.schema.ts
          stock.module.ts
        app.module.ts
        main.ts
    order/             # Pedidos + Pagamentos (porta 3000 em producao, 3300 local)
      src/
        order/           # CRUD pedidos + maquina de estados
          dto/           # CreateOrderDto, UpdateOrderStatusDto, OrderPageDto
          order.controller.ts
          order.service.ts
          order.schema.ts
          order.module.ts
        stripe/          # Stripe Checkout
          dto/           # CheckoutItemDto, CreateCheckoutDto
          stripe.controller.ts
          stripe.service.ts
          stripe.module.ts
        app.module.ts
        main.ts
  libs/
    common/            # Codigo compartilhado entre os servicos
      src/
        strategies/      # jwt.strategy.ts (usado por menu, stock, order)
        guards/          # jwt-auth.guard.ts, roles.guard.ts
        decorators/      # roles.decorator.ts, restaurant-id.decorator.ts, pageable.decorator.ts
        schemas/         # product.schema.ts (schema Mongoose do Product)
        interfaces/      # Page.ts, pageable.interface.ts
        modules/         # jwt-auth.module.ts
        index.ts         # Exporta tudo que outros servicos consomem
```

### Arquivos de Configuracao Raiz

| Arquivo | Finalidade |
|---------|-----------|
| nest-cli.json | Config do monorepo NestJS (4 apps + 1 lib) |
| tsconfig.json | Configuracao base do TypeScript com paths @app/common |
| tsconfig.build.json | Configuracao de build |
| bunfig.toml | Config do Bun (glob de testes, timeout) |
| eslint.config.mjs | ESLint flat config |
| .prettierrc | Config do Prettier (singleQuote, trailingComma) |
| Dockerfile | Multi-stage com Bun |
| docker-compose.yml | Todos os servicos + MongoDB + Redis |
| .env | Variaveis de ambiente (nao versionado, apenas .env.example) |
| .gitlab-ci.yml | Pipeline GitLab CI |
| .github/workflows/ondeploy.yaml | Pipeline GitHub Actions |

---

## Arquitetura de Servicos

### Modelo: Gateway Integrado

O servico **auth-app** atua como **API Gateway** para os demais microservicos. O fluxo de uma requisicao e:

1. Toda requisicao chega primeiro no `auth-app` (porta 3000)
2. O `ProxyMiddleware` valida o JWT e resolve o contexto de tenancy
3. Injeta headers `x-tenant-id`, `x-user-id`, `x-user-role` com dados validados
4. Redireciona para o microservico correto via `http-proxy-middleware`

### Rotas do Gateway

| Rota Externa | Rota Interna | Servico |
|-------------|-------------|---------|
| `/api/stock/*` | `/stock/*` | stock-app:3000 |
| `/api/menu/*` | `/products/*` | menu-app:3000 |
| `/api/order/stripe/*` | `/stripe/*` | order-app:3000 |
| `/api/order/*` | `/orders/*` | order-app:3000 |

### Comunicacao entre Servicos

- Os microservicos (menu, stock, order) se comunicam entre si via HTTP usando `@nestjs/axios`
- A autenticacao entre servicos usa o JWT do usuario autenticado (propagado via header `Authorization`)
- O header `x-internal-key` e usado para chamadas service-to-service quando necessario
- Cada servico tem seu proprio banco MongoDB, mas todos compartilham a mesma lib `@app/common`

---

## Fluxo de Autenticacao

### 1. Registro / Login Local

```
POST /auth/register
  -> UsersService.create() -> bcrypt(password, 10)
  -> Retorna usuario sem password

POST /auth/login
  -> LocalStrategy.validate() -> AuthService.login()
  -> Gera JWT (sub, username, globalRoles)
  -> Busca vinculos UserRestaurant -> retorna restaurantes do usuario
```

### 2. Multi-tenancy via Headers

- Header `x-restaurant-id` permite ao usuario **trocar de contexto** de restaurante
- O JWT strategy do auth verifica se o usuario tem acesso ao restaurante solicitado
- O resultado e injetado como `x-tenant-id`, `x-user-role`, `x-user-id`
- Os microservicos **confiam** nesses headers (validacao ja feita pelo gateway)
- O decorator `@RestaurantId()` extrai `req.user.restaurantId`

### 3. Convite TOTP (Invite Code)

```
Owner/MANAGER -> GET /restaurants/:id/invite-code -> codigo de 6 digitos (30s)
Usuario       -> POST /restaurants/join { inviteCode } -> vincula usuario ao restaurante
```

**Detalhes Tecnicos:**
- RFC 6238 (HOTP/TOTP) com HMAC-SHA1, 6 digitos, janela de 30s
- Tolerancia de 1 janela anterior (60s de validade)
- Anti-colisao via Redis: mesmo codigo na mesma janela so vale para 1 restaurante

### 4. Google OAuth

```
GET /auth/google?redirect_uri=exp://... -> redireciona para Google
GET /auth/google/callback -> valida, cria/vincula usuario, redireciona com token
```

### 5. Maquina de Estados do Pedido

```
pendente -> em_preparo -> pronto -> saiu_para_entrega -> entregue
                                              ↘ cancelado (qualquer estado)
```

**Transicoes por Role:**

| Role | Pode alterar para |
|------|------------------|
| KITCHEN | `em_preparo` (de pendente), `pronto` (de em_preparo) |
| DELIVERY | `saiu_para_entrega` (de pronto), `entregue` (de saiu_para_entrega) |
| OWNER / MANAGER | Todos os estados, incluindo `cancelado` |

---

## Modelos de Dados

### User (MongoDB — collection `users`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `username` | string | unique, lowercase |
| `password` | string | `select: false` (opcional para OAuth) |
| `email` | string | unique |
| `name` | string | Nome completo |
| `googleId` | string | sparse index (opcional) |
| `globalRoles` | string[] | Padrao: `['user']` |
| `isActive` | boolean | Conta ativa ou desativada |

### Restaurant (MongoDB — collection `restaurants`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `name` | string | Nome do restaurante |
| `cnpj` | string | CNPJ |
| `totpSecret` | string | `select: false` (chave secreta TOTP) |
| `plan` | enum | BASIC, PROFESSIONAL, NETWORK, PREMIUM |
| `maxBranches` | number | Limite de filiais |
| `parentId` | ObjectId | Ref para matriz (null se for master) |
| `status` | enum | active, pending, suspended |

### UserRestaurant (MongoDB — collection `userrestaurants`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `userId` | ObjectId | Ref: User |
| `restaurantId` | ObjectId | Ref: Restaurant |
| `role` | enum | OWNER, MANAGER, WAITER, KITCHEN, CASHIER, DELIVERY, COMMON |
| `status` | enum | active, pending, inactive |

### Product (MongoDB — collection `products`)

**Localizacao:** `libs/common/src/schemas/product.schema.ts`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `name` | string | Nome do produto |
| `brand` | string | Marca |
| `price` | number | Preco |
| `description` | string | Descricao |
| `ingredients` | array | `[{ stockProductId: ObjectId, quantity: number }]` |
| `restaurantId` | string | Id do restaurante |
| `userId` | string | Id do criador |

**Indice unico:** `{ name: 1, brand: 1, restaurantId: 1 }`

### Stock (MongoDB — collection `products`)

**Localizacao:** `apps/stock/src/stock/stock.schema.ts`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `name` | string | Nome do item |
| `brand` | string | Marca |
| `quantity` | number | Quantidade atual |
| `unit` | string | Unidade de medida (kg, un, l, etc.) |
| `minQuantity` | number | Quantidade minima para alerta |
| `lowStock` | boolean (virtual) | `quantity <= minQuantity` |
| `restaurantId` | string | Id do restaurante |
| `userId` | string | Id do criador |

**Indice unico:** `{ name: 1, brand: 1, restaurantId: 1 }`

### Order (MongoDB — collection `orders`)

**Localizacao:** `apps/order/src/order/order.schema.ts`

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `restaurantId` | ObjectId | Ref: Restaurant |
| `userId` | ObjectId | Ref: User (criador do pedido) |
| `items` | array | `[{ productId, name, quantity, price }]` |
| `totalValue` | number | Valor total calculado |
| `status` | enum | pendente, em_preparo, pronto, saiu_para_entrega, entregue, cancelado |
| `origin` | string | Origem do pedido (max 50) |
| `observations` | string | Observacoes (max 500) |
| `createdAt` | Date | Timestamp (auto) |
| `updatedAt` | Date | Timestamp (auto) |

---

## Padroes e Convencoes

### Decorators Customizados

Os decorators ficam em `libs/common/src/decorators/` e sao exportados via `@app/common`:

| Decorator | Localizacao | Funcao |
|-----------|-------------|--------|
| `@Roles(...roles: string[])` | `decorators/roles.decorator.ts` | Define quais roles tem acesso ao endpoint |
| `@RestaurantId()` | `decorators/restaurant-id.decorator.ts` | Extrai o `restaurantId` do `req.user` |
| `@PageableParams()` | `decorators/pageable.decorator.ts` | Extrai paginacao de query params (page, limit, skip) |

### Guards

| Guard | Localizacao | Funcao |
|-------|-------------|--------|
| `JwtAuthGuard` | `libs/common/src/guards/jwt-auth.guard.ts` | Verifica se o JWT bearer token e valido |
| `RolesGuard` | `libs/common/src/guards/roles.guard.ts` | Verifica se o usuario tem a role necessaria |

**Uso padrao em controllers:**

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER', 'MANAGER')
@Controller('produtos')
export class ProdutoController { ... }
```

### JWT Strategy

- **Auth-app** (`apps/auth/src/auth/jwt.strategy.ts`): Verifica blacklist no Redis, valida acesso a restaurante via `x-restaurant-id`
- **Common** (`libs/common/src/strategies/jwt.strategy.ts`): Usado por menu, stock, order. Verifica apenas assinatura do token e propaga headers injetados pelo proxy

### Formatacao

- Prettier com `singleQuote: true`, `trailingComma: 'all'`
- ESLint com `typescript-eslint` e `eslint-plugin-prettier`

### Paginacao

Todas as listagens seguem o padrao:

```typescript
@Get()
findAll(@RestaurantId() id: string, @PageableParams() pageable: Pageable) {
  return this.service.findAll(id, pageable);
}
```

Query params: `?page=1&limit=10` (max limit: 100)

---

## Pipeline CI/CD

### GitHub Actions (`.github/workflows/ondeploy.yaml`)

Dispara em push ou PR para `main` ou `develop`:

1. Sobe MongoDB + Redis como servicos auxiliares
2. `bun install --frozen-lockfile`
3. `bun run build:all`
4. `bun run test` (testes unitarios)
5. `bun run test:e2e` (testes end-to-end)
6. `docker compose build` (valida Dockerfile)

### GitLab CI (`.gitlab-ci.yml`)

Dois estagios:

1. **test**: Instala dependencias, sobe MongoDB/Redis, executa testes
2. **build-images**: `docker compose build` apenas nas branches main/develop

---

## Variaveis de Ambiente

| Variavel | Obrigatoria | Servico | Descricao |
|----------|-------------|---------|-----------|
| `JWT_SECRET` | Sim | Todos | Chave de assinatura JWT |
| `MONGODB_URI` | Nao (tem fallback) | Todos | URI do MongoDB |
| `REDIS_URI` | Nao (tem fallback) | auth, menu | URI do Redis |
| `INTERNAL_API_KEY` | Nao (tem fallback) | menu, stock, order | Chave service-to-service |
| `GOOGLE_CLIENT_ID` | Sim (auth) | auth | ID do cliente Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Sim (auth) | auth | Secret do Google OAuth |
| `GOOGLE_CALLBACK_URL` | Nao (tem fallback) | auth | Callback URL Google |
| `STRIPE_SECRET_KEY` | Nao (tem mock) | order | Chave secreta Stripe |
| `PORT` | Nao (tem fallback) | Todos | Porta do servidor |
| `NODE_ENV` | Nao | Todos | production / development |

---

## Comandos Uteis

```bash
# Desenvolvimento com hot-reload
bun run start:dev:auth     # Auth (porta 3000)
bun run start:dev:menu     # Menu (porta 3200)
bun run start:dev:stock    # Stock (porta 3100)
bun run start:dev:order    # Order (porta 3300)

# Build
bun run build:all          # Compila todos os apps

# Testes
bun run test               # Todos os unitarios
bun run test:auth          # Apenas auth
bun run test:menu          # Apenas menu
bun run test:stock         # Apenas stock
bun run test:order         # Apenas order
bun run test:e2e           # Todos os e2e

# Lint
bun run lint               # ESLint + Prettier

# Docker
docker compose up -d       # Sobe todos os servicos
docker compose build       # Builda as imagens

# Producao
bun run start:prod:auth    # node dist/apps/auth/main
bun run start:prod:menu    # node dist/apps/menu/main
bun run start:prod:stock   # node dist/apps/stock/main
bun run start:prod:order   # node dist/apps/order/main
```

---

## Swagger / Documentacao

Cada servico expoe Swagger em `/api` na sua propria porta. O auth-app consolida tudo em:

| URL | Conteudo |
|-----|----------|
| `http://localhost:3000/api` | Swagger UI unificado (todos os servicos) |
| `http://localhost:3000/api/unified-json` | Spec OpenAPI fundida |
| `http://localhost:3000/api-json` | Apenas Auth |
| `http://localhost:3100/api` | Swagger do Stock (direto) |
| `http://localhost:3200/api` | Swagger do Menu (direto) |
| `http://localhost:3300/api` | Swagger do Order (direto) |

---

## Regras para Agentes de IA

Ao trabalhar neste repositorio:

1. **Sempre importe de `@app/common`** para codigo compartilhado, nunca por caminho relativo.
2. **Respeite a separacao de servicos** — cada app tem seu proprio banco MongoDB e deve ser tratado independentemente.
3. **Use os decorators padrao**: `@RestaurantId()`, `@PageableParams()`, `@Roles()`.
4. **Sempre use `@UseGuards(JwtAuthGuard, RolesGuard)`** em controllers protegidos por autenticacao.
5. **Role-based status machine**: ao alterar `Order.status`, respeite as transicoes permitidas por role.
6. **Prefira `ioredis` ao `redis`** (padronizacao do projeto).
7. **Nunca hardcode secrets** — sempre use `ConfigService.get()` ou `ConfigService.getOrThrow()`.
8. **Use `firstValueFrom` do RxJS** ao trabalhar com `@nestjs/axios` para converter Observable em Promise.
9. **Testes obrigatorios** para logica criptografica (TOTP) e de maquina de estados (Order).
10. **Respeite a estrutura de DTOs** — controllers recebem DTOs com decorators de validacao do `class-validator`.