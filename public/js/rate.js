var sessions = {yellow: 1, blue: 2, red: 3, green: 4};
window.beers = _.sortBy(window.beers, function(beer) { return sessions[beer.session] });

var indexedBeers = {};
window.beers.forEach(function(beer) {
  indexedBeers[beer.id] = beer;
});

var idArray = _.pluck(window.beers, 'id');

function orderByProp(prop) {
  return _.chain(idArray)
    .reject(function(beer) { return !indexedBeers[beer][prop] })
    .sortBy(function(beer) { return -indexedBeers[beer][prop] })
    .value()
}

window.beersByHype = orderByProp('hype_score');
window.beersByScore = orderByProp('avg_score');
window.beersByUntappd = orderByProp('untappd');
window.beersByRatebeer = orderByProp('ratebeer');
window.beersByBeeradvocate = orderByProp('beeradvocate');

var rankGroups = {
  'hype': beersByHype,
  'score': beersByScore,
  'untappd': beersByUntappd,
  'ratebeer': beersByRatebeer,
  'beeradvocate': beersByBeeradvocate
};

window.beerSubsetWithRankings = function(filter) {
  var groupSubsets = {};
  Object.keys(rankGroups).forEach(function(group) {
    groupSubsets[group] = _.select(rankGroups[group], function(beer) { return filter(indexedBeers[beer]) })
  });
  return _.chain(window.beers)
    .select(filter)
    .map(function(beer) {
      Object.keys(groupSubsets).forEach(function(group) {
        var index = groupSubsets[group].indexOf(beer.id);
        if (index == -1) return;
        beer[group + '_rank'] = index + 1;
        beer[group + '_rank_br'] = ' (#' + (index + 1) + ')';
      });
      return beer;
    })
    .value();
}

