import io from 'socket.io-client'
export function connectToWebsocket(app) {
  const socket = io();

  // todo - these listeners should be in a more appropriate place
  socket.on('rate', function(data) {
    app.beerset.forAllBeersWithId(data.beer, beer => {
      beer.live_rating = data.rating;
      beer.live_rating_count = data.count;
      beer.live_rating_clamped = data.rating.toFixed(2);
      // not sure why this was here.
      // if (data.flag) return;
      // data.flag = true;
    })
    app.updateLiveRating(data.beer, data.count, data.rating);
  });

  socket.on('update', function(data) {
    for (let [beerId, {rating, count}] of Object.entries(data)) {
      app.beerset.forAllBeersWithId(beerId, beer => {
        beer.live_rating = rating;
        beer.live_rating_clamped = rating.toFixed(2);
        beer.live_rating_count = count;
      })
      app.updateLiveRating(beerId, count, rating);
    }
  });
  
  return socket;
}
