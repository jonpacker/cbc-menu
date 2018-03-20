import checkIfDeviceIsMobile from './helpers/isMobile'
import {UT_CLIENT} from './keys'

const isMobile = checkIfDeviceIsMobile();

function route(path) {
  var segments = path.match(/#(\w+)(\[(.*)\])?(=([\d\w]+))?/i);
  if (!segments) return;
  var renderer = segments[1];
  var opts = {};
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

  render(renderer, opts);
}


_.templateSettings = {
  interpolate: /\{\{=(.+?)\}\}/g,
  evaluate: /\{\{(.+?)\}\}/g,
};
var templates = {};
$(".template").each(function() {
  templates[this.dataset.templateId] = this.innerHTML;
});

var savedBeers = JSON.parse(localStorage.getItem('savedBeers17') || '[]');
var tastedBeers = JSON.parse(localStorage.getItem('tastedBeers17') || '[]');
var beerData = JSON.parse(localStorage.getItem('beerData17') || '{}');

var view = $('#window');
function render(renderer, opts) {
  if (!renderers[renderer]) return;
  opts.page = renderer;
  var html = renderers[renderer](opts);
  if (html) view.empty().html(html)
  addSliderListeners(view);
};

var _loadingTemplate;
function showLoading() {
  if (!_loadingTemplate) _loadingTemplate = Mustache.render(templates.loading);
  view.empty().html(_loadingTemplate);
}

function fetchUntappd(path, opts) {
  if (!opts) 
    opts = { };

  var token = opts.token || localStorage.getItem('untappd_token');
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

function calcBeerList(opts) {
  if (opts.order == 'live_rating') rankGroups.live_rating = orderByProp('live_rating');
  if (opts.order == 'ut_rating') rankGroups.ut_rating = orderByProp('ut_rating');
  
  var beers = beerSubsetWithRankings(function(beer) { 
    var match = true;
    if (opts.metastyle) match = match && beer.metastyle == opts.metastyle;
    if (opts.colour) match = match && ((beer.sessions && beer.sessions.indexOf(opts.colour) != -1) || beer.session == opts.colour);
    if (opts.today == 'true') match = match && (beer.sessionSet && beer.sessionSet == opts.colour);
    if (opts.tasted) match = match && (opts.tasted == 'not-tasted' ? !beer.tasted : beer.tasted === opts.tasted);
    if (opts.saved) match = match && (opts.saved == 'not-saved' ? !beer.saved : beer.saved === opts.saved);
    return match;
  });
  
  
  if (!opts.colour) { 
    beers = _.uniq(beers, function(beer) { return beer.id });
  }
  
  if (opts.order && opts.order != 'location') {
    beers = _.sortBy(beers, function(beer) { return beer[opts.order + '_rank'] });
  }
  
  var breweries = beers.reduce(function(breweries, beer, i) {
    var brewery = beer.brewery;
    if (opts.order && opts.order != 'location') {
      if (beer[opts.order + '_rank']) brewery = (i+1) + '. ' + brewery;
      else brewery = 'UNRANKED - ' + brewery;
    }

    if (!breweries[brewery]) breweries[brewery] = [];
    
    beer.trunc_desc = beer.desc ? beer.desc.length > 250 ? beer.desc.slice(0, 200) + '...' : beer.desc : '';

    breweries[brewery].push(beer);
    return breweries;
  }, {});
  opts.breweries = Object.keys(breweries).map(function(brewery) {

    return {
      name: brewery,
      location: breweries[brewery][0].location,
      beers: _.sortBy(breweries[brewery], function(b) { return b.session.toString() + b.tag })
    }
  });
  
  if (opts.order == 'location') opts.breweries = _.sortBy(opts.breweries, function(brewery) {
    return brewery.location;
  })
  else opts.breweries = _.sortBy(opts.breweries, 'name');
  
  if (opts.order && opts.order != 'location') {
    opts.breweries = _.sortBy(opts.breweries, function(brewery) {
      return brewery.beers[0][opts.order + '_rank'];
    });
  }
  opts.beer_count = beers.length;
  opts.metastyles = window.metastyles;

  opts.tset = function() {
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
}

function checkMini(opts) {
  if (opts.mini != null) localStorage.setItem('mini', opts.mini ? '1' : '0');
  var mini = localStorage.getItem('mini')
  mini = !(mini == false);
  opts.mini = mini;
};

function addUntappdUser(opts) {
  opts.untappd_token = localStorage.getItem('untappd_token');
  opts.untappd_user = localStorage.getItem('untappd_user');
}

var renderers = {
  session: function(opts) {
    if (!opts.colour) return;
    calcBeerList(opts);
    checkMini(opts);
    addUntappdUser(opts);
    opts.is_mobile = isMobile;
    opts.typeclass = opts.title = opts.colour + ' session';
    opts.live_ratings = !localStorage.getItem('disable_live_rating');
    opts.rating_as_percent = function() { return this.rating / 5 * 100 };
    return Mustache.render(templates.beerlist, opts);
  },
  beerlist: function(opts) {
    calcBeerList(opts);
    checkMini(opts);
    addUntappdUser(opts);
    opts.is_mobile = isMobile;
    opts.typeclass = 'beer-list';
    opts.title = 'All Beers';
    opts.live_ratings = !localStorage.getItem('disable_live_rating');
    opts.rating_as_percent = function() { return this.rating / 5 * 100 };
    return Mustache.render(templates.beerlist, opts);
  },
  index: function(opts) {
    if (localStorage.getItem('msg')) {
      opts.msg = localStorage.getItem('msg');
      localStorage.removeItem('msg');
    }
    addUntappdUser(opts);
    opts.untappd_redir_url = "http://wb.jonpacker.com";
    opts.untappd_cid = UT_CLIENT;
    opts.live_ratings = !localStorage.getItem('disable_live_rating');
    return Mustache.render(templates.index, opts);
  },
  toggle_live_ratings: function() {
    if (localStorage.getItem('disable_live_rating')) {
      localStorage.removeItem('disable_live_rating');
      connectToWebsocket();
    } else {
      localStorage.setItem('disable_live_rating', '1');
      socket.close();
      window.socket = undefined;
    }
    window.location = '/#index';
  },
  access_token: function(opts) {
    fetchUntappd('/user/info', {token:opts.arg}).then(function(data) {
      localStorage.setItem('untappd_user', data.response.user.user_name);
      localStorage.setItem('untappd_token', opts.arg);
      window.location = '/#index';
    }).catch(function() {
      localStorage.setItem('msg', 'Untappd authentication failed 😨');
      window.location = '/#index';
    });
  },
  unicorn: function() {
    var untappdUser = localStorage.getItem('untappd_user');
    if (!untappdUser) {
      localStorage.setItem('msg', 'You are not logged in to untappd! 😨');
      window.location = '/#index';
      return;
    }
    showLoading();
    readUntappdCheckins(untappdUser, function(count) {
      updateExportLink();
      updateBeersMarked();
      localStorage.setItem('msg', 'Marked ' + count + ' beers as checked-in on untappd');
      window.location = '/#index';
    });
  },
  snapshot: function() {
    var untappdUser = localStorage.getItem('untappd_user');
    if (!untappdUser) {
      localStorage.setItem('msg', 'You are not logged in to untappd! 😨');
      window.location = '/#index';
      return;
    }
    showLoading();
    fetch('/snapshot/' + untappdUser, {
      method: 'POST',
      body: btoa(JSON.stringify({savedBeers:savedBeers,tastedBeers:tastedBeers,beerData:beerData}))
    }).then(function(res) {
      if (res.status == 200) {
        localStorage.setItem('msg', 'Snapshot saved!');
      } else {
        localStorage.setItem('msg', 'Snapshot failed 😱 - ' + res.statusText);
      }
      window.location = '/#index';
    }).catch(function(err) {
      localStorage.setItem('msg', 'Snapshot failed 😱 - ' + err.message);
      window.location = '/#index';
    });
  },
  loadsnapshot: function() {
    var untappdUser = localStorage.getItem('untappd_user');
    if (!untappdUser) {
      localStorage.setItem('msg', 'You are not logged in to untappd! 😨');
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
        localStorage.setItem('msg', 'Couldn\'t load snapshot 😱 - ' + res.statusText);
        window.location = '/#index';
      } else {
        return res.text().then(function(text) {
          window.location = '/#loadb[{"d":"' + text + '"}]';
        });
      }
    }).catch(function(err) {
      localStorage.setItem('msg', 'Couldn\'t load snapshot 😱 - ' + err.message);
      window.location = '/#index';
    });
  },
  ut_logout: function() {
    localStorage.removeItem('untappd_user');
    localStorage.removeItem('untappd_token');
    window.location = '/#index';
  },
  load: function(opts) {
    if (!opts.data) return renderers.index(opts);
    var savedBeers = _.compact(opts.data.saved.split(','));
    var tastedBeers = _.compact(opts.data.tasted.split(','));
    localStorage.setItem('savedBeers17', JSON.stringify(savedBeers));
    localStorage.setItem('tastedBeers17', JSON.stringify(tastedBeers));
    updateBeersMarked();
    localStorage.setItem('msg',  savedBeers.length + " saved, " + tastedBeers.length + " tasted beers loaded");
    location.hash = '/#index';
    return '';
  },
  loadb: function(opts) {
    if (!opts.d) return renderers.index(opts);
    var data = JSON.parse(atob(opts.d));
    var newSavedBeers = data.savedBeers;
    var newTastedBeers = data.tastedBeers;
    var newBeerData = data.beerData;
    localStorage.setItem('savedBeers17', JSON.stringify(newSavedBeers));
    localStorage.setItem('tastedBeers17', JSON.stringify(newTastedBeers));
    localStorage.setItem('beerData17', JSON.stringify(newBeerData));
    savedBeers = newSavedBeers;
    tastedBeers = newTastedBeers;
    beerData = newBeerData;
    updateBeersMarked();
    updateExportLink();
    var noteCount = _.reduce(newBeerData, function(c, d) { return c + (d.notes ? 1 : 0) }, 0);
    var ratingCount = _.reduce(newBeerData, function(c, d) { return c + (d.rating ? 1 : 0) }, 0);
    localStorage.setItem('msg', noteCount + ' notes, ' + ratingCount + ' ratings, ' + newSavedBeers.length + " saved, " + newTastedBeers.length + " tasted beers loaded");
    window.location = '/#index';
    return '';
  }
};

updateExportLink();
function updateBeersMarked() {
  window.beers.forEach(function(beer) {
    if (savedBeers.indexOf(beer.id) != -1) beer.saved = 'saved';
    if (tastedBeers.indexOf(beer.id) != -1) beer.tasted = 'tasted';
    if (beerData[beer.id]) {
      beer.notes = beerData[beer.id].notes;
      beer.rating = beerData[beer.id].rating;
      beer.ut_checked_in = beerData[beer.id].ut_checked_in;
      beer.ut_h_ch = beerData[beer.id].ut_h_ch;
      beer.ut_h_id = beerData[beer.id].ut_h_id;
      beer.ut_h_ra = beerData[beer.id].ut_h_ra;
    }
    if (!beer.rating) beer.rating = 0;
  });
}
updateBeersMarked();

function addSliderListeners(view) {
  view.find('.rating-slider-control').each(function() {
    var container = $(this);
    var label;
    var handle = $(this.children[1]);
    var hasPrepped = false;
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

$('#window').on('click', '.mini-true .beer', function(e) {
  var beer = $(e.target).parents('.beer');
  if ($(e.target).is('.star, .tick, textarea, input, a, .rating-slider-control, .rating-slider-control > *')) return;
  beer.toggleClass('expand');
});
$('body').on('click', '.beer .star', function(e) {
  e.stopPropagation();
  var beer = $(e.target).parents('.beer');
  var beerId = beer.data().id;
  var willSave = savedBeers.indexOf(beer.data().id) == -1;
  toggleBeerSaved(beerId, willSave);
});
$('body').on('click', '.beer .tick', function(e) {
  e.stopPropagation();
  var beer = $(e.target).parents('.beer');
  var beerId = beer.data().id;
  var willSave = tastedBeers.indexOf(beer.data().id) == -1;
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
  if (!saved) {
    savedBeers = _.without(savedBeers, id);
  } else {
    savedBeers.push(id);
  }
  window.beers.forEach(function(beer) {
    if (beer.id == id) beer.saved = saved ? 'saved' : undefined;
  });
  localStorage.setItem('savedBeers17', JSON.stringify(savedBeers));
  $(".beer[data-id=" + id + "]").toggleClass('saved', saved);
  updateExportLink();
}
function toggleBeerTasted(id, tasted) {
  if (!tasted) {
    tastedBeers = _.without(tastedBeers, id);
  } else {
    tastedBeers.push(id);
  }
  window.beers.forEach(function(beer) {
    if (beer.id == id) beer.tasted = tasted ? 'tasted' : undefined;
  });
  $(".beer[data-id=" + id + "]").toggleClass('tasted', tasted);
  localStorage.setItem('tastedBeers17', JSON.stringify(tastedBeers));
  updateExportLink();
}
function updateBeerData(id, data) {
  beerData = JSON.parse(localStorage.getItem('beerData17') || '{}');
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
  localStorage.setItem('beerData17', JSON.stringify(beerData));
  updateExportLink();
}

var timeouts = {};
$('body').on('rating-slider:rate', function(e, slider, num) {
  var textarea = slider.siblings('textarea');
  var beer = slider.parents('.beer');
  var beerId = beer.data().id;
  var hasTastedBefore = tastedBeers.indexOf(beerId) != -1;
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
        btoa(JSON.stringify({savedBeers:savedBeers,tastedBeers:tastedBeers,beerData:beerData})) + '"}]');
  } catch(e) {}
}

if (location.hash) route(location.hash);
else route('#index');

$(window).on('hashchange', function() {
  route(location.hash || '#index');
});
