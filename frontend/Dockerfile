FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint-ssl.sh /docker-entrypoint.d/40-ssl-cert.sh
RUN chmod +x /docker-entrypoint.d/40-ssl-cert.sh
# Valide la config nginx au moment du BUILD plutôt que de le découvrir en
# prod : certificat jetable généré juste pour ce test (le vrai certificat
# de /etc/nginx/ssl est monté en volume au démarrage du conteneur, donc
# écrasera ces fichiers de toute façon — voir docker-compose.yml).
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 1 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/selfsigned.key -out /etc/nginx/ssl/selfsigned.crt \
      -subj "/CN=build-test" && \
    nginx -t
EXPOSE 80 443
