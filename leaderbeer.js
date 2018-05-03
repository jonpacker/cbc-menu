const LeaderBeer = require('leaderbeer-core');
const {CronJob} = require('cron');
const config = require('./config.json');
const privateConfig = require('./config-private.json');
const subscriber = require('then-redis').createClient(config.redis);

module.exports = async (db, config, credentials, io) => {
  // update every minute
  const update = new CronJob('0 * * * * *', async () => {
    console.log('updating ratings from untappd');
    try {
      const count = await LeaderBeer.updateBeerScores(
        db,
        config.leaderbeer.venueId,
        credentials,
        config.leaderbeer.forcedFirstCheckin
      );
      const session = await LeaderBeer.getCurrentSession(db, config.leaderbeer.venueId);
      console.log(`success updating ratings... success! got ${count} new checkins.`);
      if (count > 0) db.publish('updated-ratings', session || '');
    } catch (e) {
      console.error('failed updating ratings: ', e);
    }
  }, null, true, 'Europe/Oslo');

  const getAllTopLists = async () => {
    const all = await LeaderBeer.stats.getTopRated(db, config.leaderbeer.venueId, config.leaderbeer.count);
    const sessions = await LeaderBeer.getSessions(db, config.leaderbeer.venueId);
    const lists = {all, sessions:{}};
    for (let session of sessions) {
      lists.sessions[session] = await LeaderBeer.stats.getTopRated(db,
        config.leaderbeer.venueId, config.leaderbeer.count, session);
    }
    return lists;
  }

  let initRatings = {all: [], sessions: {}};
  try { initRatings = await getAllTopLists() } catch (e) {}
  io.on('connection', async socket => {
    socket.emit('leaderbeer-init', initRatings);
    socket.on('leaderbeer-start-session', async ({pass, name}) => {
      console.log('got leaderbeer-start-session');
      if (pass != privateConfig.password) return socket.emit('leaderbeer-return',{err: true});
      await LeaderBeer.setSession(db, config.leaderbeer.venueId, name);
      console.log('session', name, 'created, sending notification');
      io.emit('leaderbeer-new-session', name);
      socket.emit('leaderbeer-return', {err:false});
    })
    socket.on('leaderbeer-clear-session', async ({pass}) => {
      if (pass != privateConfig.password) return socket.emit('leaderbeer-return', {err: true});
      await LeaderBeer.clearSession(db, config.leaderbeer.venueId);
      socket.emit('leaderbeer-return', {err:false});
    })

  });
  subscriber.on('message', async (channel, sess) => {
    if (channel != 'updated-ratings') return;
    console.log('got message about updated ratings, sending out with websockets...');
    const updatedAllRatings = await LeaderBeer.stats.getTopRated(db,
      config.leaderbeer.venueId, config.leaderbeer.count);
    initRatings.all = updatedAllRatings;
    if (sess) {
      const sessRatings = await LeaderBeer.stats.getTopRated(db,
        config.leaderbeer.venueId, config.leaderbeer.count, sess);
      initRatings.sessions[sess] = sessRatings;
      io.emit('leaderbeer-update-session', {session: sess, beers: sessRatings})
    }
    io.emit('leaderbeer-update', updatedAllRatings);
  });
  subscriber.subscribe('updated-ratings');
}
