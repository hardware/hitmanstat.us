'use strict';

var express = require('express');
var axios = require('axios');
var cloudscraper = require('cloudscraper');
var router = express.Router();

var TIMEOUT = 15000;
var HIGHLOAD_THRESHOLD = 5000;

// Disable HTTP Caching (cache prevention)
var cacheHeaders = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Expires': '0'
};

router.get('/', function(req, res, next) {
  res.set('X-UA-Compatible', 'IE=edge,chrome=1');
  res.render('index', {
    path: req.path,
    title: 'HITMAN Status',
    elusive:{
      url:process.env.ELUSIVE_URL,
      status:process.env.ELUSIVE_STATUS
    }
  });
});

// Steam WebAPI and Connection Manager (CMs) status
router.get('/status/steam', function(req, res, next) {

  res.set(cacheHeaders);

  var output = '';
  var options = {
    url: 'https://crowbar.steamstat.us/Barney',
    timeout: TIMEOUT,
    headers: {
      'cache-control': 'no-cache',
    },
    validateStatus: function (status) {
      return status === 200;
    }
  };

  var service = {
    success: false,
    status: 'unknown',
    title: null
  };

  axios.request(options).then(function(response) {
    if(response.headers['content-type'].indexOf('application/json') !== -1)
      res.json(response.data);
    else {
      // if cloudflare block the request, use cloudscraper to bypass cloudflare's protection
      cloudscraper.request({
        method: 'GET',
        url: options.url,
        headers: options.headers
      }, function(err, response, body) {
        if (err) {
          service.title = 'request error';
          return res.json(service);
        }
        if(response.headers['content-type'].indexOf('application/json') === -1) {
          service.title = 'bad data';
          return res.json(service);
        }
        try {
          output = JSON.parse(body.toString());
        } catch (e) {
          service.title = 'JSON Parsing Error';
          return res.json(service);
        }
        res.json(output);
      });
    }
  }).catch(function (error) {
    if (error.response)
      service.title = 'steamstat.us error';
    else if (error.code === 'ECONNABORTED')
      service.title = 'steamstat.us timeout';
    if(!res.headersSent) res.json(service);
  });

});

// www.hitmanforum.com status (only reachable with HTTP protocol)
router.get('/status/hitmanforum', function(req, res, next) {

  res.set(cacheHeaders);

  var options = {
    url: 'http://www.hitmanforum.com',
    timeout: TIMEOUT,
    transformResponse: [
      function () {
        return null;
      }
    ],
    validateStatus: function (status) {
      return status === 200;
    }
  };

  var service = {
    service: 'hitmanforum',
    status: 'down'
  };

  var start = Date.now();

  axios.request(options).then(function(response) {
    service.status = ((Date.now() - start) > HIGHLOAD_THRESHOLD) ? 'warn' : 'up';
    res.json(service);
  }).catch(function (error) {
    if (error.response)
      service.status = 'down';
    else if (error.code === 'ECONNABORTED')
      service.title = 'timeout';
    else
      service.status = 'unknown';
    if(!res.headersSent) res.json(service);
  });

});

var timestamp = '';
var content = '';

// Hitman status
router.get('/status/hitman', function(req, res, next) {

  res.set(cacheHeaders);

  var body = '';
  var options = {
    url: 'https://auth.hitman.io/status',
    timeout: TIMEOUT,
    headers: {
      'cache-control': 'no-cache',
    },
    validateStatus: function (status) {
      return status === 200;
    }
  };

  var service = {
    status: 'Down',
    title: null
  };

  // Make a first request to initialize IOI health checks (authenticated call on
  // all 3 servers, which allocates a proper session on the cluster, and check for
  // the response time. All of that takes few seconds) and a second request to get
  // a more accurate services status.
  axios.request(options).then(function() {
    return axios.request(options);
  }).then(function(response) {
    if(response.headers['content-type'].indexOf('application/json') !== -1) {
      body = response.data;
      // keep the most recent response
      if(body.timestamp > timestamp) {
        timestamp = body.timestamp;
        content = body;
      }
      res.json(content);
    } else {
      service.status = 'Unknown';
      service.title = 'Bad data returned by authentication server';
      res.json(service);
    }
  }).catch(function (error) {
    if (error.response) {
      switch (error.response.status) {
        case 500:
          service.title = 'Internal authentication server error';
          break;
        case 502:
        case 503:
          service.status = 'Maintenance';
          service.title = 'Temporary Azure backend maintenance';
          break;
        default:
          service.title = 'Unknown error code returned by authentication server - error HTTP ' + error.response.status;
          break;
      }
    } else if (error.code === 'ECONNABORTED') {
      service.status = 'Timed out';
      service.title = 'Authentication server connection timeout';
    } else {
      service.status = 'Unknown - Error code : ' + error.code;
      service.title = 'Unknown error from authentication server';
    }
    if(!res.headersSent) res.json(service);
  });

});

router.get('/robots.txt', function (req, res, next) {
  res.type('text/plain');
  res.send("User-Agent: *\nAllow: /");
});

module.exports = router;
