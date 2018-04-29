import checkIfDeviceIsMobile from './helpers/isMobile'
import _ from 'underscore'
import config from './keys'
import {connectToWebsocket} from './live_ratings'
import readTemplates from './read_templates'
import State from './local_persistence'
import Renderer from './renderer'
import BeerSet from './beer_set' 
import Untappd from './untappd'
import EventEmitter from 'events'

_.templateSettings = {
  interpolate: /\{\{=(.+?)\}\}/g,
  evaluate: /\{\{(.+?)\}\}/g,
};

export default class App extends EventEmitter {
  constructor({beers, breweries, metastyles, superstyles}) {
    super()
    this.config = config;

   // this.beers = beers;
    this.breweries = breweries;
    this.metastyles = metastyles;
    this.superstyles = superstyles;

    this.db = new State();
    this.templates = readTemplates();
    this.isMobile = checkIfDeviceIsMobile();
    this.view = $('#window');
    this.renderer = new Renderer(this, this.templates, this.view);
    this.setTemplateGlobals();
    this.renderer.on('didRender', () => this.afterRender());

    this.beerset = new BeerSet(beers);
    this.untappd = new Untappd(this);

    this.updateExportLink();
    this.updateBeersMarked();

    this.addGlobalListeners();

    if (!this.db.disableLiveRating) this.connectToLiveRatings();
    this.liveRatingUploadTimeouts = [];

    if (location.hash) this.route(location.hash);
    else this.route('#index');

    $(window).on('hashchange', () => {
      this.route(location.hash || '#index');
    });

    this.loadIndex();
  }

  route(path) {
    const segments = path.match(/#(\w+)(\[(.*)\])?(=([\d\w]+))?/i);
    if (!segments) return;
    const viewName = segments[1];
    let opts = {};
    if (segments[3]) {
      try {
        opts = JSON.parse(decodeURIComponent(segments[3]));
      } catch (e) {
        return;
      }
    }
    else if (segments[5]) {
      opts.arg = segments[5];
    }

    this.render(viewName, opts);
  }

  render(viewName, opts) {
    if (!this.renderer.canRender(viewName)) return;
    opts.page = viewName;
    this.savePersistentOptions(opts);
    this.renderer.render(viewName, opts);
  }

  updateData(data) {
    this.breweries = data.breweries;
    this.metastyles = data.metastyles;
    this.superstyles = data.superstyles;
    this.beerset.setBeers(data.beers);
    this.updateBeersMarked();
    this.route(location.hash || '#index');
  }
  

  async loadIndex(url) {
    BeerIndex.then(() => console.log('beer index loaded'));
    this.beerset.loadIndex(await BeerIndex);
  }

  savePersistentOptions(opts) {
    if (opts.mini != null) this.db.mini = opts.mini;
  }

  setTemplateGlobals(renderer) {
    this.renderer.globals.metastyles = this.metastyles;
    this.renderer.globals.is_mobile = this.isMobile;
    
    const calc = (prop, getProp) => {
      Object.defineProperty(this.renderer.globals, prop, {
        enumerable: true,
        get: getProp
      })
    }

    calc('mini', () => this.db.mini);
    calc('untappd_token', () => this.db.untappdToken);
    calc('untappd_user', () => this.db.untappdUser);
    calc('live_ratings', () => !this.db.disableLiveRating);
  }

  connectToLiveRatings() {
    this.socket = connectToWebsocket(this);
    this.socket.on('rate', data => {
      this.beerset.forAllBeersWithId(data.beer, beer => {
        beer.live_rating = data.rating;
        beer.live_rating_count = data.count;
        beer.live_rating_clamped = data.rating.toFixed(2);
      })
      this.emit(`update-live-rating-${data.beer}`, data.rating, data.count);
    });

    this.socket.on('update', data => {
      for (let [beerId, {rating, count}] of Object.entries(data)) {
        this.beerset.forAllBeersWithId(beerId, beer => {
          beer.live_rating = rating;
          beer.live_rating_clamped = rating.toFixed(2);
          beer.live_rating_count = count;
        })
        this.emit(`update-live-rating-${beerId}`, rating, count);
      }
    });
  }

  toggleLiveRatings() {
    if (this.db.disableLiveRating) {
      this.db.disableLiveRating = null;
      this.connectToLiveRatings();
    } else {
      this.db.disableLiveRating = true;
      this.socket.close();
      this.socket = undefined;
    }
  }

  afterRender() {
    this.addSliderListeners(this.view);
  }

  addSliderListeners(view) {
    //todo react
    return;
    view.find('.rating-slider-control').each(function() {
      var container = $(this);
      var label;
      var handle = $(this.children[1]);
      var hasPrepped = false;
      //TODO bundle dependency
      var listener = DragListener(handle, 0, function() { return container.width() }, {
        stopPropagation: true
      });
      var prep = function() {
        label = container.next('.rating-text');
        hasPrepped = true;
      };
      var moveTo = function(pct) {
        handle.css({left: (Math.round(pct * 20) * 5) + '%'});
        label.text(Math.round(pct * 20) / 4);
      };
      var moveToAndSave = function(pct) {
        moveTo(pct)
        $('body').trigger('rating-slider:rate', [container, Math.round(pct * 20) / 4]);
      }
      listener.on('dragStart', prep);
      listener.on('drag', moveTo);
      listener.on('dragFinish', moveToAndSave);
      container.on('click', function(event) {
        if (!hasPrepped) prep();
        moveToAndSave(event.offsetX / container.width());
      });
      handle.on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
      });
    });
  }

  async saveUntappdToken({arg}) {
    const {response} = await fetchUntappd('/user/info', {token: arg});
    this.db.untappdUser = response.user.user_name;
    this.db.untappdToken = arg;
  }

  async downloadUserUntappdCheckins() {
    let {untappdUser} = this.db;
    if (!untappdUser) throw new Error('You are not logged in to untappd! 😨');
    const count = await this.untappd.readUntappdCheckins()
    this.updateExportLink();
    this.updateBeersMarked();
    return count;
  }

  async takeSnapshot() {
    let {untappdUser} = this.db;
    if (!untappdUser) throw new Error('You are not logged in to untappd! 😨');
    const res = await fetch('/snapshot/' + untappdUser, {
      method: 'POST',
      body: btoa(JSON.stringify({
        savedBeers: this.db.savedBeers,
        tastedBeers: this.db.tastedBeers,
        beerData: this.db.beerData
      }))
    })
    if (res.status != 200) throw new Error(res.statusText);
  }

  async loadSnapshot() {
    let {untappdUser} = this.db;
    if (!untappdUser) throw new Error('You are not logged in to untappd! 😨');
    const res = await fetch(`/snapshot/${untappdUser}`);
    
    if (res.status != 200) {
      throw new Error(res.statusText);
    } else {
      const text = await res.text();
      window.location = `/#loadb[{"d":"${text}"}]`;
    }
  }

  async importSnapshotFromString(snap) {
    const data = JSON.parse(atob(snap));
    this.db.savedBeers = data.savedBeers;
    this.db.tastedBeers = data.tastedBeers;
    this.db.beerData = data.beerData;
    this.updateBeersMarked();
    this.updateExportLink();
    let noteCount = _.reduce(this.db.beerData, (c, d) => c + (d.notes ? 1 : 0), 0);
    let ratingCount = _.reduce(this.db.beerData, (c, d) => c + (d.rating ? 1 : 0), 0);
    this.db.msg = `
      ${noteCount} notes, 
      ${ratingCount} ratings, 
      ${this.db.savedBeers.length} saved, 
      ${this.db.tastedBeers.length} tasted beers loaded
    `;
  }
   
  updateExportLink() {
    try {
      $('#export').val('http://' 
        + window.location.hostname 
        + window.location.pathname 
        + '#loadb[{"d":"' 
        + btoa(JSON.stringify({
            savedBeers:this.db.savedBeers,
            tastedBeers:this.db.tastedBeers,
            beerData:this.db.beerData
          })) 
        + '"}]');
    } catch(e) {}
  }

  updateBeersMarked() {
    this.beerset.arr.forEach(beer => {
      if (this.db.savedBeers.indexOf(beer.id) != -1) beer.saved = true;
      if (this.db.tastedBeers.indexOf(beer.id) != -1) beer.tasted = true;
      if (this.db.beerData[beer.id]) {
        beer.notes = this.db.beerData[beer.id].notes;
        beer.rating = this.db.beerData[beer.id].rating;
        beer.ut_checked_in = this.db.beerData[beer.id].ut_checked_in;
        beer.ut_h_ch = this.db.beerData[beer.id].ut_h_ch;
        beer.ut_h_id = this.db.beerData[beer.id].ut_h_id;
        beer.ut_h_ra = this.db.beerData[beer.id].ut_h_ra;
      }
      if (!beer.rating) beer.rating = 0;
    });
  }

  addGlobalListeners() {
    // expand/contract beer info in mini mode
    return;
    $('#window').on('click', '.mini-true .beer', e => {
      // don't accept clicks from clickable elements.
      if ($(e.target).is('.star, .tick, textarea, input, a, .rating-slider-control, .rating-slider-control > *')) return;
      const beerElement = $(e.target).parents('.beer');
      beerElement.toggleClass('expand');
    });

    $('body').on('click', '.beer .star', e => {
      e.stopPropagation();
      const beer = $(e.target).parents('.beer');
      const beerId = beer.data().id;
      const willSave = this.db.savedBeers.indexOf(beer.data().id) == -1;
      this.toggleBeerSaved(beerId, willSave);
    });

    $('body').on('click', '.beer .tick', e => {
      e.stopPropagation();
      var beer = $(e.target).parents('.beer');
      var beerId = beer.data().id;
      var willSave = this.db.tastedBeers.indexOf(beer.data().id) == -1;
      this.toggleBeerTasted(beerId, willSave);
    });

    $('body').on('click', '.beer .send-to-untappd', e => {
      e.stopPropagation();
      const target = $(e.target);
      const beer = target.parents('.beer');
      const beerId = beer.data().id;
      const untappdId = target.closest('.send-to-untappd').data().bid;
      const rating = parseFloat(beer.find('.rating-slider').val());
      const comments = beer.find('.notes').val();
      const loader = beer.find('.sending-untappd-checkin').show()
      
      // todo... export to untappd module
      var handleError = function() {
        loader.hide();
        const errorText = beer.find('.untappd-error-text');
        errorText.text('Error! 😰 Try again?! 🔂');
        setTimeout(function() {
          errorText.text('');
        }, 5000);
      }
      
      fetchUntappd('/checkin/add', {
        method: 'POST',
        body: {
          timezone: 'CET',
          gmt_offset: 2,
          bid: untappdId,
          shout: comments,
          foursquare_id: config.FOURSQUARE_LOCATION_ID,
          geolat: 58.969173,
          geolng: 5.758406,
          rating: rating > 0 ? rating : undefined
        }
      }).then(res => {
        loader.hide();
        if (res.meta.code >= 300) {
          return handleError();
        }
        beer.addClass('ut-checked-in');
        this.updateBeerData(beerId, {ut_checked_in:true})
      }).catch(handleError);
    })

    let timeouts = {};
    $('body').on('rating-slider:rate', (e, slider, num) => {
      const textarea = slider.siblings('textarea');
      const beer = slider.parents('.beer');
      const beerId = beer.data().id;
      const hasTastedBefore = this.db.tastedBeers.indexOf(beerId) != -1;
      this.toggleBeerTasted(beerId, true);
      this.updateBeerData(beerId, { rating: num, notes: textarea.val() });
      if (timeouts[beerId]) {
        clearTimeout(timeouts[beerId]);
        delete timeouts[beerId];
      }
      timeouts[beerId] = setTimeout(() => {
        delete timeouts[beerId];
        fetch(`/rate/${beerId}`, {
          method: hasTastedBefore ? 'PUT' : 'POST',
          body: num.toString()
        })
      }, 5000);
    });

    $('body').on('change', '.beer textarea', function(e) {
      const textarea = $(e.target);
      const notes = textarea.val();
      const beer = textarea.parents('.beer');
      const beerId = beer.data().id;
      this.toggleBeerTasted(beerId, true);
      this.updateBeerData(beerId, { notes });
    });

    $('body').on('click', 'a.add-rating', e => {
      e.stopPropagation();
      const button = $(e.target);
      const parent = button.parents('.beer');
      parent.toggleClass('add-rating');
      button.toggleClass('is-rating');
    });

  }

  setBeerRating(beerId, rating) {
    const timeouts = this.liveRatingUploadTimeouts;
    const hasTastedBefore = this.db.tastedBeers.indexOf(beerId) != -1;
    this.updateBeerData(beerId, { rating })
    if (timeouts[beerId]) {
      clearTimeout(timeouts[beerId]);
      delete timeouts[beerId];
    }
    timeouts[beerId] = setTimeout(() => {
      delete timeouts[beerId];
      fetch(`/rate/${beerId}`, {
        method: hasTastedBefore ? 'PUT' : 'POST',
        body: rating.toString()
      }).catch(() => {})
    }, 5000);
  }

  toggleBeerSaved(id, saved) {
    let {savedBeers} = this.db;
    if (!saved) {
      savedBeers = _.without(savedBeers, id);
    } else {
      savedBeers.push(id);
    }
    this.beerset.forAllBeersWithId(beer => beer.saved = saved);
    this.db.savedBeers = savedBeers;
    //$(`.beer[data-id=${id}]`).toggleClass('saved', saved);
    this.updateExportLink();
  }

  toggleBeerTasted(id, tasted) {
    let {tastedBeers} = this.db;
    if (!tasted) {
      tastedBeers = _.without(tastedBeers, id);
    } else {
      tastedBeers.push(id);
    }
    this.beerset.forAllBeersWithId(id, beer => beer.tasted = tasted);
   // $(`.beer[data-id=${id}]`).toggleClass('tasted', tasted);
    this.db.tastedBeers = tastedBeers;
    this.updateExportLink();
  }

  updateBeerData(id, data) {
    this.db.refresh('beerData');
    let {beerData} = this.db;
    if (beerData[id]) {
      data = _.extend(beerData[id], data);
    }
    beerData[id] = data;
    this.beerset.forAllBeersWithId(id, beer => Object.assign(beer, data));
    const beerEls = $(`.beer[data-id=${id}]`);
    beerEls.find('.rating-slider').val(data.rating);
    beerEls.find('textarea').val(data.notes || '');
    beerEls.toggleClass('ut_checked_in', !!data.ut_checked_in);
    if (data.notes) beerEls.addClass('has-notes');
    if (data.rating != null) beerEls.addClass('has-rating');
    this.db.beerData = beerData;
    this.updateExportLink();
  }
}

