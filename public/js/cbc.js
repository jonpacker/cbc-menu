function route(path) {
  var segments = path.match(/#(\w+)(\[(.*)\])?/i);
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

var savedBeers = JSON.parse(localStorage.getItem('savedBeers') || '[]');
var tastedBeers = JSON.parse(localStorage.getItem('tastedBeers') || '[]');
var beerData = JSON.parse(localStorage.getItem('beerData') || '{}');

var view = $('#window');
function render(renderer, opts) {
  if (!renderers[renderer]) return;
  opts.page = renderer;
  view.empty().html(renderers[renderer](opts))
};

function calcBeerList(opts) {
  var beers = beerSubsetWithRankings(function(beer) { 
    var match = true;
    if (opts.metastyle) match = match && beer.metastyle == opts.metastyle;
    if (opts.colour) match = match && beer.session == opts.colour;
    if (opts.tasted) match = match && (opts.tasted == 'not-tasted' ? !beer.tasted : beer.tasted === opts.tasted);
    if (opts.saved) match = match && (opts.saved == 'not-saved' ? !beer.saved : beer.saved === opts.saved);
    return match;
  });
  var breweries = beers.reduce(function(breweries, beer) {
    var brewery = beer.brewery;
    if (opts.order) {
      if (beer[opts.order + '_rank']) brewery = beer[opts.order + '_rank'] + '. ' + brewery;
      else brewery = 'UNRANKED - ' + brewery;
    }

    if (!breweries[brewery]) breweries[brewery] = [];
    
    beer.beeradvocate_clamped = beer.beeradvocate > 0 ? beer.beeradvocate : '';
    beer.avg_score_fixed = beer.avg_score ? beer.avg_score.toFixed(2) : '';
    beer.hype_score_fixed = beer.hype_score ? beer.hype_score.toFixed(2) : '';
    beer.trunc_desc = beer.desc ? beer.desc.length > 250 ? beer.desc.slice(0, 200) + '...' : beer.desc : '';

    breweries[brewery].push(beer);
    return breweries;
  }, {});
  opts.breweries = Object.keys(breweries).map(function(brewery) {

    return {
      name: brewery,
      beers: breweries[brewery]
    }
  });
  opts.breweries = _.sortBy(opts.breweries, 'name');
  if (opts.order) {
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

var renderers = {
  session: function(opts) {
    if (!opts.colour) return;
    calcBeerList(opts);
    opts.typeclass = opts.title = opts.colour + ' session'
    return Mustache.render(templates.beerlist, opts);
  },
  beerlist: function(opts) {
    calcBeerList(opts);
    opts.typeclass = 'beer-list';
    opts.title = 'All Beers';
    return Mustache.render(templates.beerlist, opts);
  },
  index: function(opts) {
    if (localStorage.getItem('msg')) {
      opts.msg = localStorage.getItem('msg');
      localStorage.removeItem('msg');
    }
    return Mustache.render(templates.index, opts);
  },
  load: function(opts) {
    if (!opts.data) return renderers.index(opts);
    var savedBeers = _.compact(opts.data.saved.split(','));
    var tastedBeers = _.compact(opts.data.tasted.split(','));
    localStorage.setItem('savedBeers', JSON.stringify(savedBeers));
    localStorage.setItem('tastedBeers', JSON.stringify(tastedBeers));
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
    localStorage.setItem('savedBeers', JSON.stringify(newSavedBeers));
    localStorage.setItem('tastedBeers', JSON.stringify(newTastedBeers));
    localStorage.setItem('beerData', JSON.stringify(newBeerData));
    savedBeers = newSavedBeers;
    tastedBeers = newTastedBeers;
    beerData = newBeerData;
    updateBeersMarked();
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
    }
    if (!beer.rating) beer.rating = 0;
  });
}
updateBeersMarked();
$('body').on('click', '.beer .star', function(e) {
  var beer = $(e.target).parents('.beer');
  var beerId = beer.data().id;
  var willSave = savedBeers.indexOf(beer.data().id) == -1;
  toggleBeerSaved(beerId, willSave);
});
$('body').on('click', '.beer .tick', function(e) {
  var beer = $(e.target).parents('.beer');
  var beerId = beer.data().id;
  var willSave = tastedBeers.indexOf(beer.data().id) == -1;
  toggleBeerTasted(beerId, willSave);
});
function toggleBeerSaved(id, saved) {
  if (!saved) {
    savedBeers = _.without(savedBeers, id);
  } else {
    savedBeers.push(id);
  }
  window.beers.forEach(function(beer) {
    if (beer.id == id) beer.saved = saved ? 'saved' : undefined;
  });
  localStorage.setItem('savedBeers', JSON.stringify(savedBeers));
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
  localStorage.setItem('tastedBeers', JSON.stringify(tastedBeers));
  updateExportLink();
}
function updateBeerData(id, data) {
  beerData = JSON.parse(localStorage.getItem('beerData') || '{}');
  if (beerData[id]) {
    data = _.extend(beerData[id], data);
  }
  beerData[id] = data;
  window.beers.forEach(function(beer) {
    if (beer.id == id) {
      beer.notes = data.notes;
      beer.rating = data.rating; 
    }
  });
  var beerEls = $(".beer[data-id=" + id + "]");
  beerEls.find('.rating-slider').val(data.rating);
  beerEls.find('textarea').val(data.notes || '');
  if (data.notes) beerEls.addClass('has-notes');
  if (data.rating != null) beerEls.addClass('has-rating');
  localStorage.setItem('beerData', JSON.stringify(beerData));
  updateExportLink();
}

$('body').on('input', '.rating-slider', function(e) {
  var slider = $(e.target);
  var num = slider.val();
  slider.next('.rating-text').text(num);
})
$('body').on('change', '.rating-slider', function(e) {
  var slider = $(e.target);
  var textarea = slider.siblings('textarea');
  var num = slider.val();
  var beer = slider.parents('.beer');
  var beerId = beer.data().id;
  toggleBeerTasted(beerId, true);
  updateBeerData(beerId, { rating: num, notes: textarea.val() });
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
  var button = $(e.target);
  var parent = button.parents('.beer');
  parent.toggleClass('add-rating');
  button.toggleClass('is-rating');
});


function updateExportLink() {
  $('#export').val('http://' + window.location.hostname + window.location.pathname + '#loadb[{"d":"' +
      btoa(JSON.stringify({savedBeers:savedBeers,tastedBeers:tastedBeers,beerData:beerData})) + '"}]');
}

if (location.hash) route(location.hash);
else route('#index');

$(window).on('hashchange', function() {
  route(location.hash || '#index');
});
