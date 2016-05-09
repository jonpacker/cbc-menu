var express = require('express');
var db = require('seraph')();
var nib = require('nib');
var stylus = require('stylus');
var fs = require('fs');
var async = require('async');
var app = express();

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('compress', true)
    .use(nib());
}

app.use('/css', stylus.middleware({ src: __dirname + '/public/css' , compile: compile }));

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

var beerQuery = fs.readFileSync(__dirname + '/beer.cypher', 'utf8');

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
  getBeerData(function(err, data) {
    if (err) return res.send(500, err);
    res.render('index', data);
  });
});

app.use(express.static(__dirname + '/public'));
app.listen(8090);
