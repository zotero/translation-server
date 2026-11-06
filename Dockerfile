FROM node:lts-slim

# Install git and ca-certificates required for cloning submodules over HTTPS
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*


# Install npm dependencies
WORKDIR /app
COPY ./package.json ./package-lock.json /app/
RUN npm ci --only=production

# Copy the code (after dependencies installation)
COPY . /app

# Clone required zotero submodules
RUN git clone --depth=1 https://github.com/zotero/translate.git /app/modules/translate \
 && git clone --depth=1 https://github.com/zotero/utilities.git /app/modules/utilities \
 && git clone --depth=1 https://github.com/zotero/zotero-schema.git /app/modules/zotero-schema \
 && git clone --depth=1 https://github.com/zotero/translators.git /app/modules/translators

# Run the application
EXPOSE 1969
ENTRYPOINT [ "./docker-entrypoint.sh" ]

