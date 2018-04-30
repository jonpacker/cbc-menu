const LeaderBeer = require('leaderbeer-core');
const {CronJob} = require('cron');
const subscriber = require('then-redis').createClient();

module.exports = async (db, config, credentials, io) => {
  // update every minute
  const update = new CronJob('0 * * * * *', () => {
    console.log('updating ratings from untappd');
    LeaderBeer.updateBeerScores(db, config.leaderbeer.venueId, credentials, config.leaderbeer.forcedFirstCheckin)
      .then(newCheckinCount => {
        console.log(`success updating ratings... success! got ${newCheckinCount} new checkins.`)
        if (newCheckinCount > 0) db.publish('updated-ratings', '');
      })
      .catch(err => console.error('failed updating ratings: ', err))
  }, null, true, 'Europe/Oslo');

  let initRatings = [];
  try { initRatings = await LeaderBeer.stats.getTopRated(db, config.leaderbeer.venueId, config.leaderbeer.count) } catch (e) {}
  io.on('connection', async socket => {
    socket.emit('leaderbeer-init', initRatings);
  });
  subscriber.on('message', async channel => {
    if (channel != 'updated-ratings') return;
    console.log('got message about updated ratings, sending out with websockets...');
    const updatedRatings = initRatings = await LeaderBeer.stats.getTopRated(db, config.leaderbeer.venueId, config.leaderbeer.count);
    io.emit('leaderbeer-update', JSON.stringify(updatedRatings));
  });
  subscriber.subscribe('updated-ratings');
}
