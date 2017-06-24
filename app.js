var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var ms = require('ms');

var index = require('./routes/index');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

if(app.get('env') == 'development') {
  app.use(logger('dev'));
}

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

function setHeaders(res, path, stat) {
  res.setHeader('Cache-Control', 'private');
  res.setHeader('Expires', new Date(Date.now() + ms('30d')).toUTCString());
}

app.use(express.static(path.join(__dirname, 'public'), { maxAge:ms('30d'), setHeaders:setHeaders }));
app.use('/', index);

app.use(function(req, res, next) {
  var err = new Error('Page not found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error', {
    title: 'HITMAN status',
    region: process.env.REGION
  });
});

module.exports = app;
