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

router.get('/status/steam', function(req, res, next) {

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

  if(process.env.HITMAN_MAINTENANCE === 'true') {
    res.json({
      status:'maintenance'
    });
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

router.put('/set/:type', function(req, res, next) {

  if(!req.is('application/json')) {
    res.status(400).send('Bad Request');
    return;
  }

  validateToken(res, req.body.token, function() {

    switch (req.params.type) {
      case 'maintenance':
        if(typeof req.body.maintenance !== 'string') {
          res.status(400).send('Bad Request');
          return;
        }
        process.env.HITMAN_MAINTENANCE = req.body.maintenance;
        console.log('Setting HITMAN_MAINTENANCE=' + process.env.HITMAN_MAINTENANCE);
        res.send('OK');
        break;

      case 'elusivetarget':
        if(typeof req.body.elusive_url !== 'string' || typeof req.body.elusive_status !== 'string') {
          res.status(400).send('Bad Request');
          return;
        }
        process.env.ELUSIVE_URL = req.body.elusive_url;
        process.env.ELUSIVE_STATUS = req.body.elusive_status;
        console.log('Setting ELUSIVE_STATUS=' + process.env.ELUSIVE_STATUS);
        res.send('OK');
        break;
      default:
        res.status(400).send('Bad Request');
        break;
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

var validateToken = function(res, token, callback) {
  if(token === process.env.TOKEN)
    callback();
  else
    res.status(401).send('Unauthorized');
};

var reqTimeoutWrapper = function(req) {
  return function() {
    req.abort();
  };
};

module.exports = router;
