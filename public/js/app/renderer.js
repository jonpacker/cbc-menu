import calcBeerList from './calc_beer_list'
import EventEmitter from 'events'
export default class Renderer extends EventEmitter {
  constructor(app, templates, view) {
    this.app = app;
    this.templates = templates;
    this.view = view;
    this.globals = {
      tset: createLinkToSetParam
    };
  }

  canRender(viewName) {
    return !!this[`renderer_${viewName}`];
  }

  render(viewName, opts) {
    Object.assign(opts, this.globals);
    const html = this[`renderer_${viewName}`](opts);
    if (html) this.view.empty().html(html);
    this.emit('didRender');
  }

  renderer_session(opts) {
    if (!opts.colour) return;

    const {breweries, beer_count} = calcBeerList(app.beers, opts);
    opts.breweries = breweries;
    opts.beer_count = beer_count;
    opts.typeclass = opts.title = `${opts.colour} session`;
    opts.rating_as_percent = function() { return this.rating / 5 * 100 };
    return Mustache.render(this.templates.beerlist, opts);
  }

  renderer_beerlist(opts) {
    calcBeerList(opts);
    opts.typeclass = 'beer-list';
    opts.title = 'All Beers';
    opts.rating_as_percent = function() { return this.rating / 5 * 100 };
    return Mustache.render(this.templates.beerlist, opts);
  }

  renderer_index(opts) {
    if (this.app.db.msg) {
      opts.msg = this.app.db.msg;
      this.app.db.msg = null;
    }
    opts.untappd_redir_url = this.app.config.UT_REDIR_URL;
    opts.untappd_cid = this.app.config.UT_CLIENT;
    return Mustache.render(this.templates.index, opts);
  }

  renderer_toggle_live_ratings() {
    this.app.toggleLiveRatings();
    window.location = '/#index';
  }

  async renderer_access_token(opts) {
    try {
      await this.app.saveUntappdToken(opts);
    } catch (e) {
      this.app.db.msg = 'Untappd authentication failed 😨';
    } finally {
      window.location = '/#index';
    }
  }

  renderer_unicorn() {
    this.showLoading();
    try { 
      const count = await this.app.downloadUserUntappdCheckins();
      db.msg = `Marked ${count} beers as checked-in on untappd`;
    } catch (e) {
      db.msg = e.message;
    } finally {
      window.location = '/#index';
    }
  }

  renderer_snapshot() {
    let {untappdUser} = db;
    if (!untappdUser) {
      db.msg = 'You are not logged in to untappd! 😨';
      window.location = '/#index';
      return;
    }
    showLoading();
    fetch('/snapshot/' + untappdUser, {
      method: 'POST',
      body: btoa(JSON.stringify({savedBeers: db.savedBeers,tastedBeers:db.tastedBeers,beerData:db.beerData}))
    }).then(function(res) {
      if (res.status == 200) {
        db.msg = 'Snapshot saved!';
      } else {
        db.msg = 'Snapshot failed 😱 - ' + res.statusText;
      }
      window.location = '/#index';
    }).catch(function(err) {
      db.msg = 'Snapshot failed 😱 - ' + err.message;
      window.location = '/#index';
    });
  }

  renderer_loadsnapshot() {
    let {untappdUser} = db;
    if (!untappdUser) {
      db.msg = 'You are not logged in to untappd! 😨';
      window.location = '/#index';
      return;
    }
    if (!confirm("Load snapshot? This will overwrite any existing stars/checks/ratings with data from the snapshot")) {
      window.location = '/#index';
      return;
    }
    showLoading();
    fetch('/snapshot/' + untappdUser).then(function(res) {
      if (res.status != 200) {
        db.msg = 'Couldn\'t load snapshot 😱 - ' + res.statusText;
        window.location = '/#index';
      } else {
        return res.text().then(function(text) {
          window.location = '/#loadb[{"d":"' + text + '"}]';
        });
      }
    }).catch(function(err) {
      db.msg =  'Couldn\'t load snapshot 😱 - ' + err.message;
      window.location = '/#index';
    });
  }

  renderer_ut_logout() {
    db.untappdUser = null;
    db.untappdToken = null;
    window.location = '/#index';
  }

  renderer_load(opts) {
    if (!opts.data) return renderers.index(opts);
    db.savedBeers = _.compact(opts.data.saved.split(','));
    db.tastedBeers = _.compact(opts.data.tasted.split(','));
    updateBeersMarked();
    db.msg =  savedBeers.length + " saved, " + tastedBeers.length + " tasted beers loaded";
    location.hash = '/#index';
    return '';
  }

  renderer_loadb(opts) {
    if (!opts.d) return renderers.index(opts);
    var data = JSON.parse(atob(opts.d));
    db.savedBeers = data.savedBeers;
    db.tastedBeers = data.tastedBeers;
    db.beerData = data.beerData;
    updateBeersMarked();
    updateExportLink();
    var noteCount = _.reduce(db.beerData, function(c, d) { return c + (d.notes ? 1 : 0) }, 0);
    var ratingCount = _.reduce(db.beerData, function(c, d) { return c + (d.rating ? 1 : 0) }, 0);
    db.msg = noteCount + ' notes, ' + ratingCount + ' ratings, ' + db.savedBeers.length + " saved, " + db.tastedBeers.length + " tasted beers loaded";
    window.location = '/#index';
    return '';
  }

  showLoading() {
    if (!this._loadingTemplate) this._loadingTemplate = Mustache.render(this.templates.loading);
    this.view.empty().html(_loadingTemplate);
  }
}

const createLinkToSetParam = function() {
  return function(val, render) {
    val = render(val);
    var updates = val.split(',');
    var settings = {
      colour: opts.colour,
      metastyle: opts.metastyle,
      order: opts.order,
      tasted: opts.tasted,
      saved: opts.saved,
      today: opts.today,
      mini: opts.mini
    };
    updates = updates.reduce(function(u, update) {
      var kv = update.split('=');
      var key = kv[0].trim();
      var val = kv[1].trim();
      if (val == '!') {
        delete settings[key];
        return u;
      } else if (val.match(/!\w+/)) {
        settings[key] = !settings[key];
        return u;
      }
      u[key] = val;
      return u;
    }, {});
    return '#' + opts.page + '[' + JSON.stringify(_.extend(settings,updates)).replace(/"/g, "&quot;") + ']';
  }
};

