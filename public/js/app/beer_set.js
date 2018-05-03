import _ from 'underscore'
import FullTextSearch from 'full-text-search-light'
import EventEmitter from 'events'

const SESSION_GROUPS = {
  friday: 1,
  'friday saturday': 3,
  'saturday friday': 3,
  saturday: 2
};

export default class BeerSet extends EventEmitter {
  constructor(beers, index) {
    super();
    this.indexes = ['ut_bid', 'brewery'];
    this.setBeers(beers);
    this.fullTextSearchReady = false;
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
    this.loadIndex();
  }

  orderByProp(prop) {
    return _.chain(this.idArray)
      .reject(beer => this.indexedBeers[beer][prop] == null)
      .sortBy(beer => -this.indexedBeers[beer][prop])
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
      groupSubsets[group] = rankGroups[group].filter(beer => filter(this.indexedBeers[beer]))
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

  getIndexKeys(index) {
    return Object.keys(this.specialIndexes[index]);
  }

  loadIndex() {
    if (this._searchWorker) this._searchWorker.terminate();
    this.emit('fullTextIndexNotReady');
    this.fullTextSearchReady = false;
    this._searchCallbacks = {};
    this._readySearchWorker = new Promise(res => {
      this._searchWorker = new Worker('/js/app/search_worker.js');
      this._searchWorker.onmessage = ({data}) => {
        if (data.id && this._searchCallbacks[data.id]) {
          this._searchCallbacks[data.id](data.result);
          delete this._searchCallbacks[data.id];
          return;
        }
        console.log('BeerSet got', data);
        if (data == 'ready') {
          return this._searchWorker.postMessage({type: 'init', args: Object.values(this.obj)})
        }
        if (data == 'finished_indexing') {
          res(this._searchWorker);
          this.fullTextSearchReady = true;
          this.emit('fullTextIndexReady');
        }
      };
    });
  }

  async search(query) {
    const worker = await this._readySearchWorker;
    const id = Date.now();
    return await new Promise(res => {
      this._searchCallbacks[id] = res;
      worker.postMessage({type:'search', args:{id, query}});
    });
  }

  _indexBeers(beers) {
    let indexedBeers = {};
    let beersIndexedByUntappdId = {};
    let specialIndexes = this.indexes.reduce((o, i) => (o[i] = [], o), {});
    let indexingQueue = [];

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

    indexedBeerSet.forEach(beer => {
      beer.sessions = indexedBeers[beer.id].sessions;
      beer.sessionSet = beer.sessions.join(' ');
      return beer;
    });

    indexedBeerSet = _.sortBy(indexedBeerSet, beer => SESSION_GROUPS[beer.sessionSet]);
    let idArray = _.pluck(beers, 'id');

    return { idArray, indexedBeerSet, indexedBeers, specialIndexes };
  }
}
