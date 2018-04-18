import _ from 'underscore'

const SESSION_GROUPS = {
  friday: 1, 
  'friday saturday': 3, 
  'saturday friday': 3, 
  saturday: 2
};

export default class BeerSet {
  constructor(beers) { 
    this.indexes = ['ut_bid'];
    this.setBeers(beers);
  }

  get obj() { return this.indexedBeers }
  get arr() { return this.indexedBeerSet }

  get rankGroups() { 
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

  forAllBeersWithId(id, fn) {
    if (!this.obj[id]) return;
    [this.obj[id]].concat(this.obj[id].copies || []).forEach(fn);
  }

  forAllBeersIndexedBy(index, key, fn) {
    if (!this.hasBeerIndexedBy(index, key)) return;
    this.specialIndexes[index][key].forEach(fn)
  }

  hasBeerIndexedBy(index, key) {
    return !this.specialIndexes[index] || this.specialIndexes[index][key] == null;
  }

  getBeersIndexedBy(index, key) {
    return this.specialIndexes[index][key];
  }

  _indexBeers(beers) {
    let indexedBeers = {};
    let beersIndexedByUntappdId = {};
    let specialIndexes = this.indexes.reduce((o, i) => (o[i] = [], o), {});

    let indexedBeerSet = beers.map(beer => {
      beer = _.clone(beer);
      if (indexedBeers[beer.id]) {
        indexedBeers[beer.id].sessions.push(beer.session);
        if (!indexedBeers[beer.id].copies) indexedBeers[beer.id].copies = [beer];
        else indexedBeers[beer.id].copies.push(beer);
      } else {
        indexedBeers[beer.id] = beer;
        indexedBeers[beer.id].sessions = [beer.session];
      }
      this.indexes.forEach(index => {
        if (!beer[index] == null) return;
        if (!specialIndexes[index][beer[index]]) specialIndexes[index][beer[index]] = [beer];
        else specialIndexes[index][beer[index]].push(beer);
      });
      return beer;
    });
    
    beers.forEach(beer => {
      beer.sessionSet = indexedBeers[beer.id].sessions.join(' ');
      return beer;
    });

    indexedBeerSet = _.sortBy(indexedBeerSet, beer => SESSION_GROUPS[beer.sessionSet]);
    let idArray = _.pluck(beers, 'id');

    return { idArray, indexedBeerSet, indexedBeers, specialIndexes };
  }
}
