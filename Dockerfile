FROM node:lts

# install npm dependencies
WORKDIR /app
COPY ./package.json /app/package.json
RUN npm install

# copy the code
# (after dependencies installation)
COPY . /app

# Cloning zotero translators repository
RUN git clone --depth=1 https://github.com/zotero/translators.git /app/modules/translators/

# run the application
EXPOSE 1969
ENTRYPOINT [ "./docker-entrypoint.sh" ]
