var express = require('express');
var nib = require('nib');
var stylus = require('stylus');
var app = express();

function compile(str, path) {
  return stylus(str)
    .set('filename', path)
    .set('compress', true)
    .use(nib());
}

app.use('public/css', stylus.middleware({ src: __dirname , compile: compile }));

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.get('/', function(req, res) {
  res.render('index');
});

app.listen(8090);
