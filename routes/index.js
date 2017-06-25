'use strict';

var express = require('express');
var https = require('https');
var router = express.Router();

router.get('/', function(req, res, next) {
  res.render('index', {
    title: 'HITMAN status',
    region: process.env.REGION,
    elusive:{
      url:process.env.ELUSIVE_URL,
      status:process.env.ELUSIVE_STATUS
    }
  });
});

router.get('/get/services', function(req, res, next) {
  res.json([
    { name:'auth', endpoint:'auth', platform:'azure' },
    { name:'pc', endpoint:'pc-service', platform:'azure' },
    { name:'xbox one', endpoint:'xboxone-service', platform:'azure' },
    { name:'ps4', endpoint:'ps4-service', platform:'azure' },
    { name:'steam webapi', endpoint:'webapi', platform:'steam' },
    { name:'steam cms', endpoint:'cms', platform:'steam' }
  ]);
});

router.get('/status/:endpoint', function(req, res, next) {

  var start = Date.now();
  var options = {
    host: req.params.endpoint + '.hitman.io',
    port: 443,
    path: '/'
  };

  var request = https.get(options, function(response) {
    clearTimeout(reqTimeout);
    var responseTime = Date.now() - start;
    // 'auth' endpoint returns 403, other endpoints returns 200
    if (response.statusCode == 200 || response.statusCode == 403) {
      res.json({
        status:(responseTime > 5000) ? 'warn' : 'up',
      });
    } else {
      res.json({
        status:'down'
      });
    }
  }).on('error', function() {
    clearTimeout(reqTimeout);
    if(!res.headersSent)
      res.json({
        status:'unknown'
      });
  }).on('abort', function() {
    if(!res.headersSent)
      res.json({
        status:'down',
        title:'timeout'
      });
  });

  var reqTimeout = setTimeout(reqTimeoutWrapper(request), 15000);

});

router.get('/steam', function(req, res, next) {

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

var reqTimeoutWrapper = function(req) {
  return function() {
    req.abort();
  };
};

module.exports = router;
