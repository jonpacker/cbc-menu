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
    opts.breweries = {
      name: "3 Floyds Brewing",
      beers: [
        {name: "Zombie Dust", style: "American Pale Ale"}
      ]
    }
    return Mustache.render(templates.session, opts);
  },
  index: function(opts) {
    return Mustache.render(templates.index, {});
  }
};

if (location.hash) route(location.hash);
else route('#index');

$(window).on('hashchange', function() {
  route(location.hash);
});
