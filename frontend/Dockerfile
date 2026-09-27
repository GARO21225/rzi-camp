FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
# Vide par défaut : src/api/index.js détecte alors l'URL de l'API tout
# seul via window.location.origin (même hôte que la page, nginx proxie déjà
# /api/ vers le backend) - laisser ce build arg vide permet à la même image
# de fonctionner qu'on y accède par l'IP brute OU par un nom de domaine,
# sans reconstruire l'image ni coder une adresse en dur ici. Ne définir
# VITE_API_URL explicitement (docker-compose.yml ou --build-arg) que si
# l'API est un jour servie depuis un hôte VRAIMENT différent du frontend.
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
RUN apk add --no-cache openssl
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint-ssl.sh /docker-entrypoint.d/40-ssl-cert.sh
RUN chmod +x /docker-entrypoint.d/40-ssl-cert.sh
EXPOSE 80 443
