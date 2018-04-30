FROM node:8
RUN \
  cd /tmp && \
  wget http://download.redis.io/redis-stable.tar.gz && \
  tar xvzf redis-stable.tar.gz && \
  cd redis-stable && \
  make && \
  make install && \
  cp -f src/redis-sentinel /usr/local/bin && \
  mkdir -p /etc/redis && \
  cp -f *.conf /etc/redis && \
  rm -rf /tmp/redis-stable* && \
  sed -i 's/^\(dir .*\)$/# \1\ndir \/data/' /etc/redis/redis.conf && \
  sed -i 's/^\(logfile .*\)$/# \1/' /etc/redis/redis.conf
VOLUME ["/data"]

RUN sed -i 's/^\(daemonize no\)$/daemonize yes/' /etc/redis/redis.conf

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN npm i
EXPOSE 10005 10004
CMD /usr/src/app/start.sh
