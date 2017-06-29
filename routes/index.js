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
    title: 'HITMAN status',
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
    path: '/Barney'
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

router.get('/status/global', function(req, res, next) {

  res.set(cacheHeaders);

  var service = {
    service:'global',
    status:'unknown'
  };

  var buffer = '';
  var options = {
    host:'hitman.reversing.space',
    port:443,
    path:'/api/status.json'
  };

  var request = https.get(options, function(response) {
    response.on('data', function (chunk) {
      buffer += chunk;
    });
    response.on('end', function() {
      clearTimeout(reqTimeout);
      if(response.statusCode === 200 && response.headers['content-type'].indexOf('application/json') !== -1) {
        var result = JSON.parse(buffer);
        if(!result.availability_msg)
          res.json({
            status:'available',
            last_check:result.last_check
          });
        else
          res.json({
            status:'unavailable',
            message:result.availability_msg,
            last_check:result.last_check
          });
      } else res.json(service);
    });
  }).on('error', function() {
    clearTimeout(reqTimeout);
    if(!res.headersSent) res.json(service);
  }).on('abort', function() {
    if(!res.headersSent) res.json(service);
  });

  var reqTimeout = setTimeout(reqTimeoutWrapper(request), 4000);

});

// Hitman azure endpoints status (HTTPS)
router.get('/status/:endpoint', function(req, res, next) {

  res.set(cacheHeaders);

  var service = {
    service:req.params.endpoint,
    status:'down'
  };

  if(process.env.HITMAN_MAINTENANCE === 'true') {
    service.status = 'maintenance';
    res.json(service);
    return;
  }

  var start = Date.now();
  var options = {
    host: req.params.endpoint + '.hitman.io',
    port: 443,
    path: '/'
  };

  var request = https.get(options, function(response) {
    clearTimeout(reqTimeout);
    if(response.statusCode === 200 || response.statusCode === 403)
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

router.get('/get/services', function(req, res, next) {
  res.set('Cache-Control', 'public, max-age=21600');
  res.json([
    { name:'auth', endpoint:'auth', platform:'azure' },
    { name:'pc', endpoint:'pc-service', platform:'azure' },
    { name:'xbox one', endpoint:'xboxone-service', platform:'azure' },
    { name:'ps4', endpoint:'ps4-service', platform:'azure' },
    { name:'metrics', endpoint:'metrics', platform:'azure' },
    { name:'steam webapi', endpoint:'webapi', platform:'steam' },
    { name:'steam cms', endpoint:'cms', platform:'steam' },
    { name:'hitmanforum.com', endpoint:'hitmanforum', platform:'discourse' }
  ]);
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
