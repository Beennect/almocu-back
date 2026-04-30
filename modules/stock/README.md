# Stock API - Sistema de Estoque 🚀

API REST robusta para gerenciamento de estoque de produtos , desenvolvida com **Node.js**, **TypeScript**, **Express** e **MongoDB**.

## 🚀 Como Executar

### 🐳 Via Docker (Recomendado)

A maneira mais rápida de subir o ambiente completo (API + Banco de Dados).

```bash
# Construir as imagens e iniciar os containers
sudo docker-compose up --build

# Para rodar em segundo plano (background)
sudo docker-compose up -d --build
```

### 💻 Execução Local

Caso prefira rodar fora do Docker, certifique-se de ter o MongoDB instalado e rodando.

```bash
# 1. Instalar dependências
npm install

# 2. Configurar o ambiente (crie um arquivo .env se necessário)
# MONGO_URI=mongodb://localhost:27017/stock

# 3. Iniciar em modo de desenvolvimento (com Swagger)
npm run dev

# 4. Iniciar em modo produção
npm start
```

---

## 🔗 Links Úteis

Após iniciar a aplicação, você pode utilizar os links abaixo:

- **Status da API:** [http://localhost:3100/](http://localhost:3100/)
- **Documentação (Swagger):** [http://localhost:3100/api-docs](http://localhost:3100/api-docs)

---

## 📖 Documentação da API (Swagger)

A API utiliza **Swagger UI** para documentação interativa.

> [!TIP]
> No ambiente Docker, o Swagger já vem habilitado por padrão através da variável `NODE_ENV=development`.

Na interface do Swagger você pode:

- Visualizar todos os endpoints disponíveis.
- Consultar os parâmetros necessários.
- Testar as requisições diretamente pelo navegador.

---

## 📋 Endpoints Principais

### Produtos (`/stock`)

| Método     | Endpoint                  | Descrição                                  |
| :--------- | :------------------------ | :----------------------------------------- |
| **GET**    | `/product/:id`            | Busca um produto específico por ID         |
| **GET**    | `/products/:restaurantId` | Lista todos os produtos de um restaurante  |
| **POST**   | `/product`                | Cria um novo produto                       |
| **POST**   | `/products`               | Cria múltiplos produtos de uma vez         |
| **PATCH**  | `/product/:id`            | Atualiza os dados de um produto            |
| **PATCH**  | `/product/:id/quantity`   | Ajusta a quantidade em estoque (delta)     |
| **DELETE** | `/product/:id`            | Remove um produto                          |
| **DELETE** | `/products`               | Remove múltiplos produtos via lista de IDs |

---

## 🧪 Testes Automatizados

O projeto utiliza **Jest** para garantir a qualidade do código.

```bash
# Executar todos os testes
npm test

# Executar testes específicos de produto
npx jest src/product/service.test.ts
```

---

## 🏗️ Arquitetura e Tecnologias

O projeto segue uma arquitetura em camadas para melhor manutenibilidade:

- **Routes**: Definição das rotas e endpoints Express.
- **Controller**: Tratamento de requisições e respostas HTTP.
- **Service**: Lógica de negócio e integração com o banco.
- **Model**: Definição de schemas Mongoose (MongoDB).

**Stack:** Node.js, TypeScript, Express, Mongoose, Swagger, Jest, Docker.
