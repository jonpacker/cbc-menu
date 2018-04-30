import FullTextSearch from 'full-text-search-light'

let index;

onmessage = msg => {
  if (!msg.data.type) return;
  fn[msg.data.type](msg.data.args);
}

const fn = {
  init: data => {
    console.log('got init');
    index = new FullTextSearch();
    data.forEach(beer => {
      try{
        index.add(beer, (key, val) => val[key] != null);
      } catch(e) { }
    });
    postMessage('finished_indexing');
  },
  search: args => {
    console.log('got search', args.query);
    const result = index.search(args.query);
    postMessage({id:args.id, result});
  }
}

console.log('sending ready');
postMessage('ready');