FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* /app/
RUN npm install

# Stash installed node_modules so the entrypoint can
# populate an empty Docker volume on first start.
RUN cp -a /app/node_modules /app/_node_modules_cache

COPY . /app/
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 5173
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "run", "dev"]
