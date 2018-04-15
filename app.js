var express = require('express');
var helmet = require('helmet');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var ms = require('ms');

var index = require('./routes/index');

var app = express();

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(helmet({
  hsts:false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      fontSrc: ["'self'"]
    }
  },
  referrerPolicy: {
    policy: 'no-referrer'
  }
}));

app.use(logger('dev'));
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(compression());

function setHeaders(res, path, stat) {
  res.setHeader('Cache-Control', 'public');
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
  res.locals.status = err.status || 500;
  res.status(res.locals.status);
  res.render('error', {
    title: 'HITMAN Status'
  });
});

module.exports = app;
