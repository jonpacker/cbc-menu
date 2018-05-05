import checkIfDeviceIsMobile from './helpers/isMobile'
import _ from 'underscore'
import config from '../../../config.json'
import {connectToWebsocket} from './live_ratings'
import readTemplates from './read_templates'
import State from './local_persistence'
import Renderer from './renderer'
import BeerSet from './beer_set'
import Untappd from './untappd'
import EventEmitter from 'events'
import LeaderBeer from './leaderbeer'

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

    this.beerset = new BeerSet(beers);
    this.untappd = new Untappd(this);
    this.leaderbeer = new LeaderBeer();
    this.leaderbeerCheckins = new LeaderBeer();
    this.leaderbeerSessions = {};

    this.updateExportLink();
    this.updateBeersMarked();

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
    this.emit('dataUpdate');
  }


  async loadIndex(url) {
    await this.beerset.loadIndex();
    console.log('index loaded');
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

  getLeaderbeerSession(sess, topChecked) {
    if (topChecked) {
      if (!this.leaderbeerSessionsCheckins[sess]) this.leaderbeerSessionsCheckins[sess] = new LeaderBeer();
      return this.leaderbeerSessionsCheckins[sess];
    } else {
      if (!this.leaderbeerSessions[sess]) this.leaderbeerSessions[sess] = new LeaderBeer();
      return this.leaderbeerSessions[sess];
    }
  }

  setSession(pass, name) {
    this.socket.emit('leaderbeer-start-session', {pass, name});
    this.socket.once('leaderbeer-return', ({err}) => {
      if (!err) alert(`session ${name} started`);
      else alert('bad pass');
    });
  }

  clearSession(pass) {
    this.socket.emit('leaderbeer-clear-session', {pass});
    this.socket.once('leaderbeer-return', ({err}) => {
      if (!err) alert(`session cleared`);
      else alert('bad pass');
    });
  }

  connectToLiveRatings() {
    this.socket = connectToWebsocket(this);

    this.socket.on('leaderbeer-init', data => {
      this.leaderbeer.updateBeers(data.all);
      this.leaderbeerCheckins.updateBeers(data.topChecked);
      console.log(data.topChecked);
      if (data.all.length > 0) $('#leaderbeer-button').show();
      for (let [session, beers] of Object.entries(data.sessions)) {
        this.getLeaderbeerSession(session).updateBeers(beers);
      }
    });
    this.socket.on('leaderbeer-update', data => {
      $('#leaderbeer-button').show();
      this.leaderbeer.updateBeers(data);
    });
    this.socket.on('leaderbeer-update-checked', data => {
      $('#leaderbeer-button').show();
      this.leaderbeerCheckins.updateBeers(data);
    });
    this.socket.on('leaderbeer-update-session', ({session, beers}) => {
      this.getLeaderbeerSession(session).updateBeers(beers);
    });
    this.socket.on('leaderbeer-update-session-checked', ({session, beers}) => {
      this.getLeaderbeerSession(session, true).updateBeers(beers);
    });
    this.socket.on('leaderbeer-new-session', session => {
      this.getLeaderbeerSession(session);
      this.getLeaderbeerSession(session, true);
    });
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

  async saveUntappdToken({arg}) {
    const {response} = await this.untappd.fetchUntappd('/user/info', {token: arg});
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
    this.beerset.forAllBeersWithId(id, beer => beer.saved = saved);
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
