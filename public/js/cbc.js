function route(path) {
  var segments = path.match(/#(\w+)(\[(.*)\])?/i);
  if (!segments) return;
  var renderer = segments[1];
  var opts = {};
  if (segments[3]) {
    try {
      opts = JSON.parse(segments[3]);
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
        saved: opts.saved
      };
      updates = updates.reduce(function(u, update) {
        var kv = update.split('=');
        if (kv[1].trim() == '!') {
          delete settings[kv[0].trim()];
          return u;
        }
        u[kv[0].trim()] = kv[1].trim();
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
    return Mustache.render(templates.index, {});
  }
};

var savedBeers = JSON.parse(localStorage.getItem('savedBeers') || '[]');
var tastedBeers = JSON.parse(localStorage.getItem('tastedBeers') || '[]');
window.beers.forEach(function(beer) {
  if (savedBeers.indexOf(beer.id) != -1) beer.saved = 'saved';
  if (tastedBeers.indexOf(beer.id) != -1) beer.tasted = 'tasted';
});
$('body').on('click', '.beer .star', function(e) {
  var beer = $(e.target).parents('.beer');
  var beerId = beer.data().id;
  var willSave = savedBeers.indexOf(beer.data().id) == -1;
  toggleBeerSaved(beerId, willSave);
  beer.toggleClass('saved', willSave);
  window.beers.forEach(function(beer) {
    if (beer.id == beerId) beer.saved = willSave ? 'saved' : undefined;
  });
});
$('body').on('click', '.beer .tick', function(e) {
  var beer = $(e.target).parents('.beer');
  var beerId = beer.data().id;
  var willSave = tastedBeers.indexOf(beer.data().id) == -1;
  toggleBeerTasted(beerId, willSave);
  beer.toggleClass('tasted', willSave);
  window.beers.forEach(function(beer) {
    if (beer.id == beerId) beer.tasted = willSave ? 'tasted' : undefined;
  });
});
function toggleBeerSaved(id, saved) {
  if (!saved) {
    savedBeers = _.without(savedBeers, id);
  } else {
    savedBeers.push(id);
  }
  localStorage.setItem('savedBeers', JSON.stringify(savedBeers));
}
function toggleBeerTasted(id, tasted) {
  if (!tasted) {
    tastedBeers = _.without(tastedBeers, id);
  } else {
    tastedBeers.push(id);
  }
  localStorage.setItem('tastedBeers', JSON.stringify(tastedBeers));
}

if (location.hash) route(location.hash);
else route('#index');

$(window).on('hashchange', function() {
  route(location.hash || '#index');
});
