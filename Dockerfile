FROM node:8
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm i 
EXPOSE 8090
CMD /usr/src/app/start.sh
