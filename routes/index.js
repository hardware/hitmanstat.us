'use strict';

var express = require('express');
var https = require('https');
var router = express.Router();

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

router.get('/status/steam', function(req, res, next) {

  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Expires': '0'
  });

  var buffer = '';
  var options = {
    host: 'crowbar.steamstat.us',
    port: 443,
    path: '/Barney'
  };

  https.get(options, function(response) {
    response.on('data', function (chunk) {
      buffer += chunk;
    });
    response.on('end', function() {
      res.json(JSON.parse(buffer));
    });
  }).on('error', function() {
    res.json({ success:false });
  });

});

router.get('/status/:endpoint', function(req, res, next) {

  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Expires': '0'
  });

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
      service.status = ((Date.now() - start) > 5000) ? 'warn' : 'up';
    res.json(service);
  }).on('error', function() {
    clearTimeout(reqTimeout);
    service.status = 'unknown';
    if(!res.headersSent) res.json(service);
  }).on('abort', function() {
    service.title = 'timeout';
    if(!res.headersSent) res.json(service);
  });

  var reqTimeout = setTimeout(reqTimeoutWrapper(request), 15000);

});

router.get('/get/services', function(req, res, next) {

  res.set('Cache-Control', 'public, max-age=2592000');
  res.json([
    { name:'auth', endpoint:'auth', platform:'azure' },
    { name:'pc', endpoint:'pc-service', platform:'azure' },
    { name:'xbox one', endpoint:'xboxone-service', platform:'azure' },
    { name:'ps4', endpoint:'ps4-service', platform:'azure' },
    { name:'steam webapi', endpoint:'webapi', platform:'steam' },
    { name:'steam cms', endpoint:'cms', platform:'steam' }
  ]);
});

var reqTimeoutWrapper = function(req) {
  return function() {
    req.abort();
  };
};

module.exports = router;
