# 🚀 Nosherp Monorepo - Microserviços & Gateway

Bem-vindo ao ecossistema **Nosherp**. Este é um monorepo escalável, organizado em microserviços, com um API Gateway centralizado para autenticação e roteamento inteligente.

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

## 🚦 Portas e Acesso Rápido

O **Gateway** centraliza todas as chamadas. Você não precisa acessar os microserviços diretamente, o Gateway faz o roteamento via prefixos `/api`.

| Serviço | Porta Local | Prefixo no Gateway | Descrição |
| :--- | :--- | :--- | :--- |
| **Gateway (Auth)** | `3000` | `/auth` | Login, Registro e Proxying |
| **Stock Service** | `3100` | `/api/stock` | Inventário e Produtos |
| **Menu Service** | `3200` | `/api/menu` | Cardápio e Restaurantes |
| **Order Service** | `3300` | `/api/order` | Gestão de Pedidos |
| **Netdata** | `19999` | N/A | Dashboard de Monitoramento |

---

## 🔐 Configuração (.env)

O projeto utiliza variáveis de ambiente para conexões de banco e segredos. Certifique-se de ter um arquivo `.env` na raiz:

### Gateway (`.env` na raiz)
```env
# Banco de Dados Auth (PostgreSQL)
POSTGRES_USER=postgres
POSTGRES_PASSWORD=sua_senha
POSTGRES_DB=auth_db
DATABASE_URL="postgresql://postgres:sua_senha@auth-db:5432/auth_db"

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

## 📊 Monitoramento Premium

Instalamos o **Netdata** para você acompanhar o batimento cardíaco do sistema.
*   **Link Local:** [http://localhost:19999](http://localhost:19999)
*   **O que ver:** Procure a seção **"Containers"** na barra lateral para ver gráficos de CPU/RAM de cada microserviço em tempo real.

---

## 📝 Notas de Desenvolvimento
- **Hot-Reload:** Os microserviços possuem volumes mapeados. Qualquer alteração em `modules/*/src` refletirá instantaneamente nos containers.
- **Gateway Build:** O Gateway (`auth-app`) não possui volume mapeado por segurança de permissões no Linux. Se alterar algo na raiz (`src/`), rode `docker-compose up --build auth-app`.

---
⚡ *Desenvolvido com foco em alta performance e escalabilidade.*
