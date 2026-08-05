# ── VeinReach frontend ──────────────────────────────────
# Vite env vars are baked at build time, so pass them as build args.
FROM node:22-alpine AS build
WORKDIR /app
ARG VITE_API_URL=/api/v1
ARG VITE_SOCKET_URL=
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL

COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
RUN npm run build

# ── Serve static build with nginx ───────────────────────
FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
