var sessions = {friday: 1, 'friday saturday': 3, 'saturday friday': 3, saturday: 2};

var indexedBeers = {};
var idArray;

window.indexBeers = function() {
  window.indexedBeers = {};
  window.beers.forEach(function(beer) {
    if (window.indexedBeers[beer.id]) {
      window.indexedBeers[beer.id].sessions.push(beer.session);
    } else {
      window.indexedBeers[beer.id] = _.clone(beer);
      window.indexedBeers[beer.id].sessions = [beer.session];
    }
  });
  
  window.beers = window.beers.map(function(beer) {
    beer.sessionSet = window.indexedBeers[beer.id].sessions.join(' ');
    return beer;
  });
  
  window.beers = _.sortBy(window.beers, function(beer) { return window.sessions[beer.sessionSet] });
  
  idArray = _.pluck(window.beers, 'id');
}

indexBeers();

function orderByProp(prop) {
  return _.chain(idArray)
    .reject(function(beer) { return indexedBeers[beer][prop] == null })
    .sortBy(function(beer) { return -indexedBeers[beer][prop] })
    .value()
}

window.beersByUntappd = orderByProp('ut_rating');

window.rankGroups = {
  'ut_rating': orderByProp('ut_rating'),
  'live_rating': orderByProp('live_rating')
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
