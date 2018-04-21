'use strict';

var express = require('express');
var axios = require('axios');
var throttleAdapterEnhancer = require('axios-extensions').throttleAdapterEnhancer;
var cloudscraper = require('cloudscraper');
var moment = require('moment');
var router = express.Router();

// CONSTANTS
var TIMEOUT = 15000;
var HIGHLOAD_THRESHOLD = 5000;
var NEW_RELIC_EVENT_TYPE = "ServiceStatusProduction";

// State preserved server-side variables
var initialTime = moment().subtract(1, 'm');
var steamLastRequestTimestamp = 0;
var hitmanLastRequestTimestamp = '';
var hitmanLastRequestContent = '';

// Disable HTTP Caching (cache prevention)
var cacheHeaders = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Expires': '0'
};

// Internet Explorer compatibility mode
var uaCompatible = {
  'X-UA-Compatible': 'IE=edge,chrome=1'
};

// Make requests throttled (threshold = 60 seconds)
var http = axios.create({
	adapter: throttleAdapterEnhancer(axios.defaults.adapter, 60 * 1000)
});

router.get('/', function(req, res, next) {
  res.set(uaCompatible);
  res.render('index', {
    path: req.path,
    title: 'HITMAN Status'
  });
});

router.get('/events', function(req, res, next) {

  res.set(uaCompatible);

  var options = {
    url: 'https://insights-api.newrelic.com/v1/accounts/' + process.env.NEW_RELIC_ACCOUNT + '/query?nrql=SELECT%20service%2C%20status%20FROM%20' + NEW_RELIC_EVENT_TYPE + '%20WHERE%20status%20NOT%20LIKE%20%27up%27%20AND%20status%20NOT%20LIKE%20%27high%20load%27%20SINCE%201%20month%20ago%20LIMIT%20200',
    headers: {
      'Accept': 'application/json',
      'X-Query-Key' : process.env.NEW_RELIC_API_QUERY_KEY,
    },
    validateStatus: function (status) {
      return status === 200;
    }
  };

  http.request(options).then(function(response) {
    res.render('events', {
      path: req.path,
      title: 'HITMAN Status',
      events: response.data.results[0].events,
      moment: moment
    });
  }).catch(function (error) {
    if (error.response) {
      res.locals.status = error.response.status;
      res.locals.message = error.response.data.error;
    } else {
      res.locals.status = error.code;
      res.locals.message = error.message;
    }
    res.render('error', {
      title: 'HITMAN Status'
    });
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

  var events = [
    { eventType:NEW_RELIC_EVENT_TYPE, service:"STEAM WEBAPI", status:"unknow" },
    { eventType:NEW_RELIC_EVENT_TYPE, service:"STEAM CMS", status:"unknown" }
  ];

  axios.request(options).then(function(response) {
    if(response.headers['content-type'].indexOf('application/json') !== -1) {
      if(response.data.time > steamLastRequestTimestamp) {
        steamLastRequestTimestamp = response.data.time;
        events[0].status = formatServiceStatus(response.data.services.webapi.status, 'steam');
        events[1].status = formatServiceStatus(response.data.services.cms.status, 'steam');
        submitEvents(events);
      }
      res.json(response.data);
    } else {
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
        if(output.time > steamLastRequestTimestamp) {
          steamLastRequestTimestamp = output.time;
          events[0].status = formatServiceStatus(output.services.webapi.status, 'steam');
          events[1].status = formatServiceStatus(output.services.cms.status, 'steam');
          submitEvents(events);
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

  var events = [
    { eventType:NEW_RELIC_EVENT_TYPE, service:"HITMAN AUTHENTICATION", status:"down" },
    { eventType:NEW_RELIC_EVENT_TYPE, service:"HITMAN PC", status:"down" },
    { eventType:NEW_RELIC_EVENT_TYPE, service:"HITMAN XboxOne", status:"down" },
    { eventType:NEW_RELIC_EVENT_TYPE, service:"HITMAN PS4", status:"down" }
  ];

  // Make a first request to initialize IOI health checks (authenticated call on
  // all 3 servers, which allocates a proper session on the cluster, and check for
  // the response time. All of that takes few seconds) and a second request to get
  // a more accurate services status.
  axios.request(options).then(function() {
    return axios.request(options);
  }).then(function(response) {
    if(response.headers['content-type'].indexOf('application/json') !== -1) {
      body = response.data;
      // If hitman server sends a more recent response
      if(body.timestamp > hitmanLastRequestTimestamp) {
        // store the response
        hitmanLastRequestTimestamp = body.timestamp;
        hitmanLastRequestContent = body;
        // send the new status of hitman services to new relic
        events[0].status = "up";
        events[1].status = formatServiceStatus(hitmanLastRequestContent.services['pc-service.hitman.io'].health, 'hitman');
        events[2].status = formatServiceStatus(hitmanLastRequestContent.services['xboxone-service.hitman.io'].health, 'hitman');
        events[3].status = formatServiceStatus(hitmanLastRequestContent.services['ps4-service.hitman.io'].health, 'hitman');
        submitEvents(events);
      }
      res.json(hitmanLastRequestContent);
    } else {
      service.status = 'Unknown';
      service.title = 'Bad data returned by authentication server';
      res.json(service);
      submitEvents(events, true);
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
    submitEvents(events, true);
  });

});

router.get('/robots.txt', function (req, res, next) {
  res.type('text/plain');
  res.send("User-Agent: *\nAllow: /");
});

function formatServiceStatus(status, type) {
  var map = null;
  switch (type) {
    case 'hitman':
      map = { healthy:'up', slow:'high load' };
      break;
    case 'steam':
      map = { good:'up', minor:'high load', major:'down' };
      break;
  }
  var regex = new RegExp(Object.keys(map).join("|"), "gi");
  var output = status.replace(regex, function(match) {
    return map[match];
  });
  return output;
}

// Submit custom events to NewRelic Insights
// Send down events only once a minute to avoid event flood
function submitEvents(events, down) {

  var noUpEvents = [];

  if(down) {
    if(!moment().isAfter(moment(initialTime.toISOString()).add(1, 'm')))
      return;
    else
      initialTime = moment();
  }

  for (var index = 0; index < events.length; index++)
    if(events[index].status != 'up' && events[index].status != 'high load') noUpEvents.push(events[index]);

  if (noUpEvents.length > 0) {
    axios.request({
      url: 'https://insights-collector.newrelic.com/v1/accounts/' + process.env.NEW_RELIC_ACCOUNT + '/events',
      method: 'post',
      headers: {
        'X-Insert-Key': process.env.NEW_RELIC_API_INSERT_KEY,
        'Content-Type': 'application/json'
      },
      data: noUpEvents
    }).catch(function (error) {
      if (error.response) {
        console.log("Failed to submit data to new relic. Error " + error.response.status + " : " + error.response.data.error);
      } else {
        console.log("Failed to submit data to new relic. Error " + error.code + " : " + error.message);
      }
    });
  }

}

module.exports = router;
