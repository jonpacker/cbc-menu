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

app.use('/css', stylus.middleware({ src: __dirname + '/public/css' , compile: compile }));

app.set('view engine', 'jade');
app.set('views', __dirname + '/views');

app.get('/', function(req, res) {
  res.render('index');
});

app.use(express.static(__dirname + '/public'));
app.listen(8090);
