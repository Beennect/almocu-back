# 🍔 Nosherp - ERP para Lanchonetes 🍔
- Nome: **Nosherp**
- Integrantes:
	- Bruno Righi
	- Gabriel Magina Coutinho
	- Kaique Onencio
	- Weverton Ryan
- Empresas parceiras: 
	- **Salgadaria do Ponto**

# 💡 O que é o Nosherp?
É um software que tem como objetivo auxiliar no gerenciamento de lanchonetes, deixando a logistica do negócio mais inteligente. É dividido em vários módulos, onde cada módulo atenderá a uma necessidade do negócio, em que podem trabalhar individualmente ou integrados.

# 📈 Valor para agregar?
## 🤖 Automatização de Tarefas
- **Permite o empresário focar mais na estratégia do negócio** por meio da automação de processos massantes e repetitivos
- Permite a implementação de estratégias com maior eficiência e velocidade
## 🚀 Otimização de Operações
- **Diminui gastos** pois o software realizará o gerenciamento dos recursos de maneira mais eficiente
- Fornece Insights para **aumentar a velocidade das operações da empresa** por meio da analise de padrões em operações
- **Diminui a probabilidade da empresa quebrar** dando enfase em pontos cegos que não estavam sendo vistos
## 🧠 Inteligência de Negócios
- **Aumenta a conversão de vendas** ao melhorar o relacionamento da empresa com o cliente 
    - **Permite ouvir com mais clareza os clientes** com ferramentas de coleta de feedback e satisfação
    - **Fideliza os clientes** trazendo eles para o próprio app da lanchonete por benefícios que for oferecer (preço mais baixo)
    - **Aumenta a Retenção** com envio de promoções automatizados para clientes que não estão comprando tanto, e envia com base em dados coletados para aumentar as probabilidades de resultado
- **Oferece vantagem estratégica em relação aos concorrentes** por meio da analise de dados internos que foram coletados pelo próprio software e dados externos que estão disponiveis na internet. 
	Informações sobre:
	- Clientes
    - Concorrentes
    - Mercado
    - Problemas internos
    - Tendências e Previsões
    - Possíveis prevenções
    - etc…
## 🏙️ Canal de Distribuição
- Aumento da visibilidade por meio do site próprio e o Canal de Comunicação

# 🛠 Tecnologias e Arquitetura

Este módulo é o **Serviço de Produtos**, responsável pela gestão do catálogo, integração com cache e documentação técnica.

### Stack Tecnológica
- **Runtime**: Node.js (v18+)
- **Linguagem**: TypeScript
- **Framework**: Express
- **Banco de Dados**: MongoDB (via Mongoose)
- **Cache**: Redis (Cache dinâmico com invalidação)
- **Documentação**: Swagger (OpenAPI 3.0)
- **Testes**: Jest
- **Containerização**: Docker & Docker Compose

---

# 🚀 Como Rodar o Projeto

### Pré-requisitos
- Docker e Docker Compose instalados.

### Rodando com Docker (Recomendado)
Para subir a aplicação, o banco de dados e o redis automaticamente:

```bash
docker-compose up --build
```

A aplicação estará disponível em `http://localhost:3000`.

### Rodando Localmente
1. Instale as dependências: `npm install`
2. Crie um arquivo `.env` baseado no `.env.example`.
3. Certifique-se de ter MongoDB e Redis rodando localmente.
4. Rode em modo desenvolvimento: `npm run dev`

---

# 📖 Documentação da API

A documentação interativa (Swagger) pode ser acessada em:
👉 [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

Lá você encontrará todos os endpoints, parâmetros e esquemas de dados.

---

# 🧪 Testes

Para rodar a suíte de testes unitários:

```bash
npm test
```

---

# 🛡 Verificação e MVP

[Walkthrough Completo das Mudanças](file:///home/desertgm/.gemini/antigravity/brain/91ab0f40-969c-46ca-8202-7ee066bfe612/walkthrough.md)

# Planos

# Desafios

# Nos Apoie!