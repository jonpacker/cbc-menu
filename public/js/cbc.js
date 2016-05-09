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

var renderers = {
  session: function(opts) {
    if (!opts.colour) return;
    var breweries = window.beers.reduce(function(breweries, beer) {
      if (beer.session != opts.colour) return breweries;
      if (!breweries[beer.brewery]) breweries[beer.brewery] = [];
      
      beer.avg_score_fixed = beer.avg_score ? beer.avg_score.toFixed(2) : '';
      beer.hype_score_fixed = beer.hype_score ? beer.hype_score.toFixed(2) : '';
      beer.trunc_desc = beer.desc ? beer.desc.length > 250 ? beer.desc.slice(0, 200) + '...' : beer.desc : '';

      breweries[beer.brewery].push(beer);
      return breweries;
    }, {});
    opts.breweries = Object.keys(breweries).map(function(brewery) {
      return {
        name: brewery,
        beers: breweries[brewery]
      }
    });
    opts.breweries = _.sortBy(opts.breweries, 'name');
    console.log(opts.breweries);
    return Mustache.render(templates.session, opts);
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
