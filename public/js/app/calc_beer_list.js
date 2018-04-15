import _ from 'underscore'
export default function calcBeerList(beerset, opts) {
  // these refreshes should now happen automatically after BeerSet was introduced
  // TODO: check that.
  //if (opts.order == 'live_rating') rankGroups.live_rating = orderByProp('live_rating');
  //if (opts.order == 'ut_rating') rankGroups.ut_rating = orderByProp('ut_rating');
  
  let beers = beerset.subsetWithRankings(beer => { 
    let match = true;
    if (opts.metastyle) match = match && beer.metastyle == opts.metastyle;
    if (opts.colour) match = match && ((beer.sessions && beer.sessions.indexOf(opts.colour) != -1) || beer.session == opts.colour);
    // FIXME
    if (opts.today == 'true') match = match && (beer.sessionSet && beer.sessionSet == opts.colour);
    if (opts.tasted) match = match && (opts.tasted == 'not-tasted' ? !beer.tasted : beer.tasted === opts.tasted);
    if (opts.saved) match = match && (opts.saved == 'not-saved' ? !beer.saved : beer.saved === opts.saved);
    return match;
  });
  
  
  if (!opts.colour) { 
    beers = _.uniq(beers, beer => beer.id);
  }
  
  if (opts.order && opts.order != 'location') {
    beers = _.sortBy(beers, beer => beer[`${opts.order}_rank`]);
  }
  
  let beersIndexedByBrewery = beers.reduce((breweries, beer, i) => {
    let brewery = beer.brewery;

    if (opts.order && opts.order != 'location') {
      if (beer[`${opts.order}_rank`]) brewery = `${i + 1}. ${brewery}`;
      else brewery = 'UNRANKED - ' + brewery;
    }

    if (!breweries[brewery]) breweries[brewery] = [];
    
    beer.trunc_desc = beer.desc ? beer.desc.length > 250 ? beer.desc.slice(0, 200) + '...' : beer.desc : '';

    breweries[brewery].push(beer);
    return breweries;
  }, {});

  let breweries = Object.keys(beersIndexedByBrewery).map(brewery => ({
    name: brewery,
    location: beersIndexedByBrewery[brewery][0].location,
    beers: _.sortBy(beersIndexedByBrewery[brewery], b => `${b.session}${b.tag}`)
  }));
  
  if (opts.order == 'location') breweries = _.sortBy(breweries, 'location');
  else if (opts.order) breweries = _.sortBy(breweries, b => b.beers[0][`${opts.order}_rank`])
  else breweries = _.sortBy(breweries, 'name');
  
  return {
    beer_count: beer_count,
    breweries
  }
}

