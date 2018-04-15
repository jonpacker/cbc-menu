const PFX = '_';
const KEYS = {
  savedBeers: {
    default: [],
    key: 'SAVED_BEERS'
  },
  tastedBeers: {
    default: [],
    key: 'TASTED_BEERS'
  },
  beerData: {
    default: {},
    key: 'BEER_DATA'
  },
  mini: {
    default: true,
    key: 'OPTS_UI_MINI'
  },
  untappdToken: {
    default: undefined,
    key: 'UNTAPPD_TOKEN'
  },
  untappdUser: {
    default: undefined,
    key: 'UNTAPPD_USER'
  },
  disableLiveRating: {
    default: false,
    key: 'OPTS_DISABLE_LIVE_RATING'
  },
  msg: {
    default: null,
    key: 'FLASH_MESSAGE'
  }
}
Object.keys(KEYS).forEach(key => KEYS[key].key = `${PFX}${KEYS[key].key}`);
export default class State {
  constructor() {
    Object.keys(KEYS).forEach(key => {
      this.refresh(key)
      Object.defineProperty(this, key, {
        enumerable: true,
        get: () => this[`_${key}`],
        set: (val) => {
          this[`_${key}`] = val;
          if (val == null) {
            this._remove(key);
          } else {
            this._persist(key, val);
          }
        }
      });
    })
  }

  _persist(key, data) {
    localStorage.setItem(KEYS[key].key, JSON.stringify(data));
  }

  _remove(key) {
    localStorage.removeItem(KEYS[key].key);
  }

  refresh(key) {
    try {
      const rawItem = localStorage.getItem(KEYS[key].key);
      if (rawItem == null) {
        this[`_${key}`] = KEYS[key].default;
      } else {
        this[`_${key}`] = JSON.parse(rawItem);
      }
    } catch (e) {
      this[`_${key}`] = KEYS[key].default;
    }
    console.log(key, this[`_${key}`])
  }

  
}

