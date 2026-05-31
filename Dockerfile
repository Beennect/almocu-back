# ============================================================
# Stage 1: DEPS — Instala node_modules de produção uma vez
# Esta camada é cacheada pelo Docker BuildKit.
# Só roda novamente se package.json ou bun.lockb mudarem.
# ============================================================
FROM oven/bun:1 AS deps

WORKDIR /app
COPY package.json ./
RUN bun install --production

# ============================================================
# Stage 2: BUILD — Instala devDeps e compila o app alvo
# ============================================================
FROM oven/bun:1 AS build

WORKDIR /app
COPY package.json ./
COPY tsconfig.json tsconfig.build.json ./
RUN bun install

# Copia todo o monorepo (apps/, libs/, configs)
COPY . .

# ARG decide qual app compilar (auth | menu | stock | order)
ARG APP_NAME=auth
RUN bun run build ${APP_NAME}

# ============================================================
# Stage 3: PRODUCTION — Imagem final mínima
# node_modules de prod vem do stage deps (sem devDeps)
# dist vem do stage build
# ============================================================
FROM oven/bun:1 AS production

WORKDIR /app
ARG APP_NAME=auth
ENV APP_NAME=${APP_NAME}

# Metadado para identificar qual serviço está na imagem
LABEL service="${APP_NAME}"

# Só node_modules de produção (sem devDeps, imagem menor)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Só o dist do app específico (bundle do webpack)
COPY --from=build /app/dist/apps/${APP_NAME} ./dist

EXPOSE 3000

# Executa com o Bun em vez de Node para consumir muito menos memória
CMD ["bun", "dist/main.js"]