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
  view.empty().html(renderers[renderer](opts))
};

function calcBeerList(opts) {
  var beers = beerSubsetWithRankings(function(beer) { 
    if (opts.metastyle) {
      return beer.session == opts.colour && beer.metastyle == opts.metastyle;
    }
    return beer.session == opts.colour 
  });
  var breweries = beers.reduce(function(breweries, beer) {
    var brewery = beer.brewery;
    if (opts.order && beer[opts.order + '_rank']) brewery = beer[opts.order + '_rank'] + '. ' + brewery;
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
}

var renderers = {
  session: function(opts) {
    if (!opts.colour) return;
    calcBeerList(opts);
    opts.typeclass = opts.title = opts.colour + ' session'
    return Mustache.render(templates.beerlist, opts);
  },
  index: function(opts) {
    return Mustache.render(templates.index, {});
  }
};

if (location.hash) route(location.hash);
else route('#index');

$(window).on('hashchange', function() {
  route(location.hash || '#index');
});
