var express = require('express');
var db = require('seraph')();
var nib = require('nib');
var stylus = require('stylus');
var fs = require('fs');
var argv = require('optimist').argv;
var async = require('async');
var _ = require('underscore');
var cache = require('appcache-node');
var app = express();
var server = require('http').createServer(app);
var csvWriter = require('csv-write-stream');
var redisClient = require('redis');
var redis = redisClient.createClient();
var io = require('socket.io')(server);
const browserify = require('browserify-middleware');

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
  //.set('compress', true) 
    .use(nib());
}

app.use('/css', stylus.middleware({ src: __dirname + '/public/css' , compile: compile }));
app.use('/js/app/', browserify(`${__dirname}/public/js/app`, { 
  transform: [
    ['babelify', {
      presets: [
        ['env', {
          targets: {
            browsers: [
              "Chrome >= 52",
              "FireFox >= 44",
              "Safari >= 7",
              "Explorer 11",
              "last 4 Edge versions"
            ]
          },
          useBuiltIns: true
        }],
        ['react']
      ],
      plugins: ["transform-object-rest-spread"]
    }]
  ]
}));

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');
express.static.mime.define({
   'application/x-font-woff': ['woff'],
   'application/font-woff': ['woff'],
   'font/woff2': ['woff2']
}); 

var beerQuery = fs.readFileSync(__dirname + '/beer.cypher', 'utf8');

var beers;
if (argv.disk) {
  beers = JSON.parse(fs.readFileSync(__dirname + '/beers.json', 'utf8'));
} else {
  getBeerData(function(err, data) {
    if (err) {
      console.error("Couldn't get beer data:");
      console.error(err);
      process.exit(1);
    }
    beers = data;
    if (argv.persist) {
      fs.writeFileSync(__dirname + '/beers.json', JSON.stringify(data));
      console.log('wrote ' + data.beers.length + ' to disk');
    }
  });
} 


function getBeerData(cb) {
  updateRatingCache(() => {
    async.parallel({
      beers: function(cb) {
        db.query(beerQuery, function(err, beers) {
          if (err) return cb(err);
          else cb(null, beers.map(function(row) {
            var beer = row.beer;
            if (beer.ut_rating) beer.ut_rating_clamped = beer.ut_rating.toFixed(2)
            beer.brewery = row.brewery;
            beer.session = row.session;
            beer.location = row.location;
            beer.superstyle = row.superstyle;
            beer.metastyle = row.metastyle;
            if (memoryRatingCache[beer.id]) {
              beer.live_rating = memoryRatingCache[beer.id].rating;
              beer.live_rating_clamped = memoryRatingCache[beer.id].rating.toFixed(2);
              beer.live_rating_count = memoryRatingCache[beer.id].count;
            }
            return beer;
          }));
        }); 
      },
      breweries: function(cb) {
        db.query("MATCH (brewery:brewery) RETURN brewery", function(err, breweries) {
          if (err) return cb(err);
          cb(null, breweries.map(function(b) { return b.name }));
        });
      },
      superstyles: function(cb) {
        db.query("MATCH (superstyle:superstyle) RETURN superstyle", function(err, superstyles) {
          if (err) return cb(err);
          cb(null, superstyles.map(function(s) { return s.name }));
        });
      },
      metastyles: function(cb) {
        db.query("MATCH (metastyle:metastyle) RETURN metastyle", function(err, metastyle) {
          if (err) return cb(err);
          cb(null, metastyle.map(function(m) { return m.name }));
        });
      }
    }, cb);
  });
};

var memoryRatingCache = {};
function updateRatingCache(cb) {
  redis.keys('_br*', (err, keys) => {
    if (err) return cb(err);
    redis.mget(keys, (err, values) => {
      if (err) return cb(err);
      keys.forEach((key, i) => {
        var subkeys = key.match(/(\d+)_(\w+)/);
        memoryRatingCache[subkeys[1]] = memoryRatingCache[subkeys[1]] || {};
        memoryRatingCache[subkeys[1]][subkeys[2]] = parseFloat(values[i]);
      });
      cb();
    });
  });
}

io.on('connection', (socket) => {
  socket.emit('update', memoryRatingCache);
});

var handleRate = (req, res) => {
  var id = parseInt(req.params.id);
  if (isNaN(id)) return res.send(400);
  var body = '';
  req.on('data', (ch) => { body += ch.toString() })
  req.on('end', () => {
    var newRating = parseFloat(body);
    if (isNaN(newRating)) return res.send(400);
    if (memoryRatingCache[id]) {
      var cached = memoryRatingCache[id];
      var newCount = req.method == 'POST' ? cached.count + 1 : cached.count;
      cached.count = newCount;
      newRating = cached.rating = (cached.rating*(newCount-1) + newRating) / newCount;
    } else {
      memoryRatingCache[id] = { rating: newRating, count: 1 };
    }
    redis.set(`_br${id}_rating`, newRating);
    redis.incr(`_br${id}_count`);
    res.sendStatus(200);
    io.emit('rate', {beer:id,rating:newRating,count:memoryRatingCache[id].count});
  }); 
};
app.post('/rate/:id', handleRate);
app.put('/rate/:id', handleRate);

app.get('/', function(req, res) {
  res.render('index', beers);
});

var dataCache = {};

app.get('/mbcc-2017-dump-jonpacker.csv', function(req, res) {
  if (!dataCache.csvTime || Date.now() - dataCache.csvTime > 120000) {
    getBeerData(function(err, data) {
      if (err) return res.sendStatus(500);
      var csv = csvWriter({
        headers: ['brewery', 'session', 'beer', 'abv', 'style', 'metastyle',
                  'untappd rating', 'description', 'untappd link']
      });
      
      var csvData = '';
      
      res.set('Content-Type', 'text/csv');
      csv.pipe(res);
      
      csv.on('data', function(chunk) {
        var part = chunk.toString();
        csvData += part;
      });
      
      csv.on('end', function() {
        dataCache.csvData = csvData;
        dataCache.csvTime = Date.now();
      });
      
      var sessions = ['yellow', 'blue', 'red', 'green']
      data.breweries.sort().forEach(function(brewery) {
        var beers = data.beers.filter((beer) => { return beer.brewery == brewery });
        beers = _.sortBy(beers, (beer) => { return sessions.indexOf(beer.session) });
        beers.forEach((beer) => {
          csv.write([beer.brewery, beer.session, beer.name, beer.percent, 
            beer.superstyle, beer.metastyle, beer.ut_rating, beer.desc, `https://untappd.com/b/_/${beer.ut_bid}`]);
        });
      });
      csv.end();
    });
  } else {
    res.set('Content-Type', 'text/csv');
    res.send(dataCache.csvData);
  }
})

app.get('/latest.json', function(req, res) {
  if (!dataCache.time || Date.now() - dataCache.time > 120000) {
    getBeerData(function(err, updates) {
      if (err) return res.sendStatus(500);
      dataCache.time = Date.now();
      dataCache.data = updates;
      beers = updates;
      res.json(updates);
    });
  } else {
    res.json(dataCache.data);
  }
});

app.post('/snapshot/:ut', function(req, res) {
  if (!req.params.ut) return res.send(400);
  var data = '';
  req.on('data', (d) => { data += d.toString() });
  req.on('end', () => {
    redis.set(req.params.ut, data, function(err) {
      if (err) res.sendStatus(500);
      else res.sendStatus(200);
    });
  });
});

app.get('/snapshot/:ut', function(req, res) {
  if (!req.params.ut) return res.sendStatus(400);
  redis.get(req.params.ut, function(err, snap) {
    if (err) return res.sendStatus(500);
    else if (!snap) return res.sendStatus(404);
    else {
      res.write(snap);
      res.end();
    }
  });
});

var cf = cache.newCache([
    'js/jquery-2.2.3.min.js',
    'js/mustache.min.js',
    'js/underscore-min.js',
    'js/drag-listener.min.js',
    'js/rate.js',
    'js/cbc.js',
    'css/cbc.css',
    'fonts/oswald-v10-latin-700.woff',
    'fonts/oswald-v10-latin-700.woff2',
    'fonts/oswald-v10-latin-regular.woff',
    'fonts/oswald-v10-latin-regular.woff2',
    'img/beer_icon_check.png',
    'img/drank_flag.png',
    'img/puff.svg',
    'img/spin.svg',
    'img/ut_icon_144.png'
]);
if (!argv.noappcache) {
  app.get('/app.cache', function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/cache-manifest'});
    res.end([cf, '','NETWORK:', 'latest.json', '/mbcc-2017-dump-jonpacker.csv','*'].join('\r\n'));
  });
}

app.use(express.static(__dirname + '/public'));
server.listen(8090,'0.0.0.0');
