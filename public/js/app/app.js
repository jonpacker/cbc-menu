import checkIfDeviceIsMobile from './helpers/isMobile'
import _ from 'underscore'
import {UT_CLIENT} from './keys'
import io from 'socket.io-client'
import {connectToWebsocket} from './live_ratings'
import execRoute from './router'
import readTemplates from './read_templates'
import State from './local_persistence'
import Renderer from './renderer'
import Indexing from './indexing' 

_.templateSettings = {
  interpolate: /\{\{=(.+?)\}\}/g,
  evaluate: /\{\{(.+?)\}\}/g,
};

const config = {
  UT_REDIR_URL,
  UT_CLIENT
}

export default class App {
  constructor({beers, breweries, metastyles, superstyles}) {
    this.config = config;

    this.beers = beers;
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

    const {indexedBeers, indexedBeerSet, idArray} = Indexing.indexBeers(beers);
    this.indexedBeers = indexedBeers;
    this.indexedBeerSet = indexedBeerSet;
    this.idArray = idArray;


    // some kind of init function?
    if (!this.db.disableLiveRating) this.socket = connectToWebsocket(this);
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

  savePersistentOptions(opts) {
    if (opts.mini != null) this.db.mini = opts.mini;
  }

  setTemplateGlobals(renderer) {
    renderer.globals.metastyles = metastyles;
    renderer.globals.is_mobile = this.isMobile;
    
    const calc = (prop, getProp) => {
      Object.defineProperty(renderer.globals, prop, {
        enumerable: true,
        get: getProp
      })
    }

    calc('mini', () => this.db.mini);
    calc('untappd_token', () => this.db.untappdToken);
    calc('untappd_user', () => this.db.untappdUser);
    calc('live_ratings', () => !this.db.disableLiveRating);
  }

  toggleLiveRatings() {
    if (this.db.disableLiveRating) {
      this.db.disableLiveRating = null;
      this.socket = connectToWebsocket();
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
    let {untappdUser} = this.app.db;
    if (!untappdUser) throw new Error('You are not logged in to untappd! 😨');
    // TODO: promisify readUntappdCheckins
    await new Promise((res, rej) => {
      readUntappdCheckins(untappdUser, count => {
        // END 15/4 - import these into app class, continue modernizing renderers.
        this.updateExportLink();
        this.updateBeersMarked();
        res(count);
      });
    });  
  }
}


function fetchUntappd(path, opts) {
  if (!opts) 
    opts = { };

  var token = opts.token || db.untappdToken;;
  delete opts.token;
    
  if (opts.body) {
    opts.body.access_token = token;
    opts.body = $.param(opts.body)
    var headers = new Headers();
    headers.append('Content-Type', 'application/x-www-form-urlencoded');
    headers.append('Content-Length', opts.body.length);
    opts.headers = headers;
  }

  if (opts.query) opts.query = '&' + opts.query;
  
  return fetch('https://api.untappd.com/v4/' + path + '?access_token=' + token + (opts.query || ''), opts)
    .then(function(res) { return res.json() })
}

var renderers = {
};

updateExportLink();
function updateBeersMarked() {
  window.beers.forEach(function(beer) {
    if (db.savedBeers.indexOf(beer.id) != -1) beer.saved = 'saved';
    if (db.tastedBeers.indexOf(beer.id) != -1) beer.tasted = 'tasted';
    if (db.beerData[beer.id]) {
      beer.notes = db.beerData[beer.id].notes;
      beer.rating = db.beerData[beer.id].rating;
      beer.ut_checked_in = db.beerData[beer.id].ut_checked_in;
      beer.ut_h_ch = db.beerData[beer.id].ut_h_ch;
      beer.ut_h_id = db.beerData[beer.id].ut_h_id;
      beer.ut_h_ra = db.beerData[beer.id].ut_h_ra;
    }
    if (!beer.rating) beer.rating = 0;
  });
}
updateBeersMarked();


$('#window').on('click', '.mini-true .beer', function(e) {
  var beer = $(e.target).parents('.beer');
  if ($(e.target).is('.star, .tick, textarea, input, a, .rating-slider-control, .rating-slider-control > *')) return;
  beer.toggleClass('expand');
});
$('body').on('click', '.beer .star', function(e) {
  e.stopPropagation();
  var beer = $(e.target).parents('.beer');
  var beerId = beer.data().id;
  var willSave = db.savedBeers.indexOf(beer.data().id) == -1;
  toggleBeerSaved(beerId, willSave);
});
$('body').on('click', '.beer .tick', function(e) {
  e.stopPropagation();
  var beer = $(e.target).parents('.beer');
  var beerId = beer.data().id;
  var willSave = db.tastedBeers.indexOf(beer.data().id) == -1;
  toggleBeerTasted(beerId, willSave);
});
$('body').on('click', '.beer .send-to-untappd', function(e) {
  e.stopPropagation();
  var target = $(e.target);
  var beer = target.parents('.beer');
  var beerId = beer.data().id;
  var untappdId = target.closest('.send-to-untappd').data().bid;
  var rating = parseFloat(beer.find('.rating-slider').val());
  var comments = beer.find('.notes').val();
  var loader = beer.find('.sending-untappd-checkin').show()
  
  var handleError = function() {
    loader.hide();
    var errorText =beer.find('.untappd-error-text');
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
      foursquare_id: '59e5d6846fa81f4ea5407189',
      geolat: 58.969173,
      geolng: 5.758406,
      rating: rating > 0 ? rating : undefined
    }
  }).then(function(res) {
    loader.hide();
    if (res.meta.code >= 300) {
      return handleError();
    }
    beer.addClass('ut-checked-in');
    updateBeerData(beerId, {ut_checked_in:true})
  }).catch(handleError);
})
function toggleBeerSaved(id, saved) {
  let {savedBeers} = db;
  if (!saved) {
    savedBeers = _.without(savedBeers, id);
  } else {
    savedBeers.push(id);
  }
  window.beers.forEach(function(beer) {
    if (beer.id == id) beer.saved = saved ? 'saved' : undefined;
  });
  db.savedBeers = savedBeers;
  $(".beer[data-id=" + id + "]").toggleClass('saved', saved);
  updateExportLink();
}
function toggleBeerTasted(id, tasted) {
  let {tastedBeers} = db;
  if (!tasted) {
    tastedBeers = _.without(tastedBeers, id);
  } else {
    tastedBeers.push(id);
  }
  window.beers.forEach(function(beer) {
    if (beer.id == id) beer.tasted = tasted ? 'tasted' : undefined;
  });
  $(".beer[data-id=" + id + "]").toggleClass('tasted', tasted);
  db.tastedBeers = tastedBeers;
  updateExportLink();
}
function updateBeerData(id, data) {
  db.refresh('beerData');
  let {beerData} = db;
  if (beerData[id]) {
    data = _.extend(beerData[id], data);
  }
  beerData[id] = data;
  window.beers.forEach(function(beer) {
    if (beer.id == id) {
      beer.notes = data.notes;
      beer.rating = data.rating; 
      beer.ut_checked_in = data.ut_checked_in;
    }
  });
  var beerEls = $(".beer[data-id=" + id + "]");
  beerEls.find('.rating-slider').val(data.rating);
  beerEls.find('textarea').val(data.notes || '');
  beerEls.toggleClass('ut_checked_in', !!data.ut_checked_in);
  if (data.notes) beerEls.addClass('has-notes');
  if (data.rating != null) beerEls.addClass('has-rating');
  db.beerData = beerData;
  updateExportLink();
}

var timeouts = {};
$('body').on('rating-slider:rate', function(e, slider, num) {
  var textarea = slider.siblings('textarea');
  var beer = slider.parents('.beer');
  var beerId = beer.data().id;
  var hasTastedBefore = db.tastedBeers.indexOf(beerId) != -1;
  toggleBeerTasted(beerId, true);
  updateBeerData(beerId, { rating: num, notes: textarea.val() });
  if (timeouts[beerId]) {
    clearTimeout(timeouts[beerId]);
    delete timeouts[beerId];
  }
  timeouts[beerId] = setTimeout(function() {
    delete timeouts[beerId];
    fetch('/rate/' + beerId, {
      method: hasTastedBefore ? 'PUT' : 'POST',
      body: num.toString()
    })
  }, 5000);
});
$('body').on('change', '.beer textarea', function(e) {
  var textarea = $(e.target);
  var notes = textarea.val();
  var beer = textarea.parents('.beer');
  var beerId = beer.data().id;
  toggleBeerTasted(beerId, true);
  updateBeerData(beerId, { notes: notes });
});

$('body').on('click', 'a.add-rating', function(e) {
  e.stopPropagation();
  var button = $(e.target);
  var parent = button.parents('.beer');
  parent.toggleClass('add-rating');
  button.toggleClass('is-rating');
});

function updateLiveRating(id, count, rating) {
  var beer = $('.beer[data-id='+id+']');
  var lrBig = beer.find('.live-rating');
  var lrSmall = beer.find('.live-avg');
  lrSmall.text("👥 " + rating.toFixed(2))
  lrBig.text("Users (" + count + "): " + rating.toFixed(2)).show()
}

function readUntappdCheckins(user, cb, start, count) {
  if (!start) { 
    if (localStorage.getItem('ut_uniques_start')) {
      start = parseInt(localStorage.getItem('ut_uniques_start'));
      count = parseInt(localStorage.getItem('ut_uniques_count')) || 0;
    } else {
      start = 0;
      count = 0;
    }
  }
  fetchUntappd('/user/beers', {query: 'offset='+start+'&limit=50'})
    .then(function(result) {
      if (result.meta.code != 200) return cb(count);
      start += result.response.beers.count;
      localStorage.setItem('ut_uniques_start', start);
      if (result.response.beers.count == 0) {
        return cb(count);
      }
      var checkins = result.response.beers.items;
      checkins.forEach(function(checkin) {
        for (var i = 0; i < beers.length; ++i) {
          if (beers[i].ut_bid == checkin.beer.bid) {
            updateBeerData(beers[i].id+"", {ut_h_ch:true, ut_h_ra:checkin.rating_score, ut_h_id:checkin.first_checkin_id});
            count++;
            localStorage.setItem('ut_uniques_count', count);
            break;
          }
        }
      });
      $('.status-text').text(start + " beers read, " + count + " beers matched");
      readUntappdCheckins(user, cb, start, count);
    });
}

function updateExportLink() {
  try {
    $('#export').val('http://' + window.location.hostname + window.location.pathname + '#loadb[{"d":"' +
        btoa(JSON.stringify({savedBeers:db.savedBeers,tastedBeers:db.tastedBeers,beerData:db.beerData})) + '"}]');
  } catch(e) {}
}

if (location.hash) route(location.hash, render);
else route('#index', render);

$(window).on('hashchange', function() {
  route(location.hash || '#index', render);
});
