FROM node:10.7.0

# install npm dependencies
WORKDIR /app
COPY ./package.json /app/package.json
RUN npm install

# copy the code
# (after dependencies installation)
COPY . /app

# run the application
EXPOSE 1969
ENTRYPOINT [ "./docker-entrypoint.sh" ]
