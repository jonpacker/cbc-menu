export default function route(path, renderer) {
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

  renderer(viewName, opts);
}
