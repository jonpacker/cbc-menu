const express = require('express');
const db = require('seraph')();
const nib = require('nib');
const stylus = require('stylus');
const fs = require('fs');
const argv = require('optimist').argv;
const async = require('async');
const cache = require('appcache-node');
const browserify = require('browserify-middleware');
const app = express();

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('compress', true)
    .use(nib());
}

app.use('/css', stylus.middleware({ src: __dirname + '/public/css' , compile: compile }));

app.use('/js/app/', browserify(`${__dirname}/public/js/app`, { 
  transform: [
    ['babelify', {
      presets: [['env', {
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
      }]],
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
  async.parallel({
    beers: function(cb) {
      db.query(beerQuery, function(err, beers) {
        if (err) return cb(err);
        else cb(null, beers.map(function(row) {
          var beer = row.beer;
          beer.avg_score = row.avg_score;
          beer.hype_score = row.hype_score;
          beer.brewery = row.brewery;
          beer.session = row.session;
          beer.style = row.style;
          beer.superstyle = row.superstyle;
          beer.metastyle = row.metastyle;
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
};

app.get('/', function(req, res) {
  res.render('index', beers);
});

var cf = cache.newCache([
    'js/jquery-2.2.3.min.js',
    'js/mustache.min.js',
    'js/underscore-min.js',
    'js/rate.js',
    'js/cbc.js',
    'css/cbc.css',
    'fonts/oswald-v10-latin-700.woff',
    'fonts/oswald-v10-latin-700.woff2',
    'fonts/oswald-v10-latin-regular.woff',
    'fonts/oswald-v10-latin-regular.woff2'
]);
if (!argv.noappcache) {
  app.get('/app.cache', function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/cache-manifest'});
    res.end(cf);
  });
}

app.use(express.static(__dirname + '/public'));
app.listen(8090,'0.0.0.0');
