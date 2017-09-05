function connectToWebsocket() {
  window.socket = io();

  socket.on('rate', function(data) {
    beers.forEach(function(beer) {
      if (beer.id != data.beer) return;
      beer.live_rating = data.rating;
      beer.live_rating_count = data.count;
      beer.live_rating_clamped = data.rating.toFixed(2);
      if (data.flag) return;
      data.flag = true;
      updateLiveRating(beer.id, data.count, data.rating);
    });
  });

  socket.on('update', function(data) {
    beers.forEach(function(beer) {
      if (!data[beer.id]) return;
      beer.live_rating = data[beer.id].rating;
      beer.live_rating_clamped = data[beer.id].rating.toFixed(2);
      beer.live_rating_count = data[beer.id].count;
      if (data[beer.id].flag) return;
      data[beer.id].flag = true;
      updateLiveRating(beer.id, data[beer.id].count, data[beer.id].rating);
    });
  });
}
if (!localStorage.getItem('disable_live_rating')) connectToWebsocket();
