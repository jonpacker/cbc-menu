export function connectToWebsocket(app) {
  const socket = io();

  // todo - these listeners should be in a more appropriate place
  socket.on('rate', function(data) {
    app.beers.forEach(function(beer) {
      if (beer.id != data.beer) return;
      beer.live_rating = data.rating;
      beer.live_rating_count = data.count;
      beer.live_rating_clamped = data.rating.toFixed(2);
      if (data.flag) return;
      data.flag = true;
      app.updateLiveRating(beer.id, data.count, data.rating);
    });
  });

  socket.on('update', function(data) {
    app.beers.forEach(function(beer) {
      if (!data[beer.id]) return;
      beer.live_rating = data[beer.id].rating;
      beer.live_rating_clamped = data[beer.id].rating.toFixed(2);
      beer.live_rating_count = data[beer.id].count;
      if (data[beer.id].flag) return;
      data[beer.id].flag = true;
      app.updateLiveRating(beer.id, data[beer.id].count, data[beer.id].rating);
    });
  });
  
  return socket;
}
