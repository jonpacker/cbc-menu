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
  templates[this.dataset.templateId] = _.template(this.innerHTML);
});


var view = $('#window');
function render(renderer, opts) {
  if (!renderers[renderer]) return;
  view.html(renderers[renderer](opts))
};

var renderers = {
  session: function(opts) {
    if (!opts.colour) return;
  },
  index: function(opts) {
    return templates.index();
  }
};

if (location.hash) route(location.hash);
else route('#index');
