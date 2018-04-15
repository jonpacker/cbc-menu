import _ from 'underscore'

const SESSION_GROUPS = {
  friday: 1, 
  'friday saturday': 3, 
  'saturday friday': 3, 
  saturday: 2
};

export default BeerSet {
  constructor(beers) { 
    this.setBeers(beers);
  }

  get obj() { return this.indexedBeers }
  get arr() { return this.indexedBeerSet }

  get rankGroups { 
    return {
      ut_rating: this.orderByProp('ut_rating'),
      live_rating: this.orderByProp('live_rating')
    }
  }

  setBeers(beers) {
    Object.assign(this, this._indexBeers(beers));
  }

  orderByProp(prop) {
    return _.chain(this.idArray)
      .reject(beer => this.indexedBeers[beer][prop] == null)
      .sortBy(beer => -indexedBeers[beer][prop])
      .value()
  }

  /**
   * generates a subset of beers that match the given filter, and the calculates rankings
   * for each of the ranked groups (for example live and untappd). 
   */
  subsetWithRankings(filter) {
    const {rankGroups} = this;
    const groupNames = Object.keys(rankGroups);
    let groupSubsets = {};
    groupNames.forEach(group => {
      groupSubsets[group] = rankGroups[group].filter(beer => filter(indexedBeers[beer]))
    });
    return this.arr.filter(filter).map(beer => {
      groupNames.forEach(group => {
        const index = groupSubsets[group].indexOf(beer.id);
        if (index == -1) return;
        beer[group + '_rank'] = index + 1;
        beer[group + '_rank_br'] = ' (#' + (index + 1) + ')';
      });
      return beer;
    })
  }

  _indexBeers(beers) {
    let indexedBeers = {};

    beers.forEach((beer) => {
      if (indexedBeers[beer.id]) {
        indexedBeers[beer.id].sessions.push(beer.session);
      } else {
        indexedBeers[beer.id] = _.clone(beer);
        indexedBeers[beer.id].sessions = [beer.session];
      }
    });
    
    let indexedBeerSet = beers.map(beer => {
      const beer = _.clone(beer);
      beer.sessionSet = indexedBeers[beer.id].sessions.join(' ');
      return beer;
    });

    indexedBeerSet = _.sortBy(indexedBeerSet, beer => SESSION_GROUPS[beer.sessionSet]);
    let idArray = _.pluck(beers, 'id');

    return { idArray, indexedBeerSet, indexedBeers };
  }
}
