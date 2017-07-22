'use strict';

var express = require('express');
var http = require('http');
var https = require('https');
var router = express.Router();

var TIMEOUT = 15000;
var HIGHLOAD_THRESHOLD = 5000;

// Disable HTTP Caching (cache prevention)
var cacheHeaders = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Expires': '0'
};

router.get('/', function(req, res, next) {
  res.render('index', {
    path: req.path,
    title: 'HITMAN Status',
    region: process.env.REGION,
    elusive:{
      url:process.env.ELUSIVE_URL,
      status:process.env.ELUSIVE_STATUS
    }
  });
});

// Steam WebAPI and Connection Manager (CMs) status
router.get('/status/steam', function(req, res, next) {

  res.set(cacheHeaders);

  var buffer = '';
  var options = {
    host: 'crowbar.steamstat.us',
    port: 443,
    path: '/Barney',
    "headers": {
      "cache-control": "no-cache",
    }
  };

  var request = https.get(options, function(response) {
    response.on('data', function (chunk) {
      buffer += chunk;
    });
    response.on('end', function() {
      clearTimeout(reqTimeout);
      if(response.headers['content-type'].indexOf('application/json') !== -1)
        res.json(JSON.parse(buffer));
      else
        res.json({ success: false, status: 'unknown', title:'bad data' });
    });
  }).on('error', function() {
    clearTimeout(reqTimeout);
    if(!res.headersSent)
      res.json({ success: false, status: 'unknown', title:null });
  }).on('abort', function() {
    if(!res.headersSent)
      res.json({ success: false, status: 'down', title:'steamstat.us timeout' });
  });

  var reqTimeout = setTimeout(reqTimeoutWrapper(request), TIMEOUT);

});

// www.hitmanforum.com status (only reachable with HTTP protocol)
router.get('/status/hitmanforum', function(req, res, next) {

  res.set(cacheHeaders);

  var service = {
    service:'hitmanforum',
    status:'down'
  };

  var start = Date.now();
  var options = {
    host: 'www.hitmanforum.com',
    port: 80,
    path: '/'
  };

  var request = http.get(options, function(response) {
    clearTimeout(reqTimeout);
    if(response.statusCode === 200)
      service.status = ((Date.now() - start) > HIGHLOAD_THRESHOLD) ? 'warn' : 'up';
    res.json(service);
  }).on('error', function() {
    clearTimeout(reqTimeout);
    service.status = 'unknown';
    if(!res.headersSent) res.json(service);
  }).on('abort', function() {
    service.title = 'timeout';
    if(!res.headersSent) res.json(service);
  });

  var reqTimeout = setTimeout(reqTimeoutWrapper(request), TIMEOUT);

});

var timestamp = '';
var content = '';

// Hitman status
router.get('/status/hitman', function(req, res, next) {

  res.set(cacheHeaders);

  var buffer = '';
  var start = Date.now();

  var options = {
    host: 'auth.hitman.io',
    port: 443,
    path: '/status',
    "headers": {
      "cache-control": "no-cache",
    }
  };

  var service = {
    status: 'Down',
    title: null
  };

  var request = https.get(options, function(response) {
    response.on('data', function (chunk) {
      buffer += chunk;
    });
    response.on('end', function() {
      clearTimeout(reqTimeout);
      switch (response.statusCode) {
        case 200:
          if(response.headers['content-type'].indexOf('application/json') !== -1) {
            var body = JSON.parse(buffer);
            // keep the most recent response
            if(body.timestamp > timestamp) {
              timestamp = body.timestamp;
              content = body;
            }
            res.json(content);
          } else {
            service.status = 'Unknown';
            service.title = 'Bad data returned by authentication server';
          }
          break;
        case 500:
          service.title = 'Internal authentication server error';
          break;
        case 502:
        case 503:
          service.status = 'Maintenance';
          service.title = 'Temporary Azure backend maintenance';
          break;
        default:
          service.title = 'Unknown error code returned by authentication server';
          break;
      }
      if(!res.headersSent) res.json(service);
    });
  }).on('error', function(error) {
    clearTimeout(reqTimeout);
    service.status = 'Unknown (' + error.code + ')';
    service.title = 'Unknown error from authentication server';
    if(!res.headersSent) res.json(service);
  }).on('abort', function() {
    service.title = 'Authentication server connection timeout';
    if(!res.headersSent) res.json(service);
  });

  var reqTimeout = setTimeout(reqTimeoutWrapper(request), TIMEOUT);

});

router.get('/robots.txt', function (req, res, next) {
  res.type('text/plain');
  res.send("User-Agent: *\nAllow: /");
});

var reqTimeoutWrapper = function(req) {
  return function() {
    req.abort();
  };
};

module.exports = router;
