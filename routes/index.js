'use strict';

var express = require('express');
var pgp = require('pg-promise')();
var debug = require('debug')('hitmanstat.us:app');
var axios = require('axios');
var throttleAdapterEnhancer = require('axios-extensions').throttleAdapterEnhancer;
var cloudscraper = require('cloudscraper');
var moment = require('moment');
var router = express.Router();

pgp.pg.defaults.ssl = true;
var db = pgp(process.env.DATABASE_URL);
var tn = new pgp.helpers.TableName(process.env.DATABASE_TABLE, 'public');
var cs = new pgp.helpers.ColumnSet(['service', 'status'], { table:tn });

// CONSTANTS
var TIMEOUT = 25000;
var HIGHLOAD_THRESHOLD = 5000;

// State preserved server-side variables
var initialTime = moment().subtract(1, 'm');
var steamLastRequestTimestamp = 0;
var hitmanLastRequestTimestamp = '';
var hitmanLastRequestContent = '';

// Down counters
var steamDownCounter = 0;
var hitmanDownCounter = 0;
var hitmanForumDownCounter = 0;

// Disable HTTP Caching (cache prevention)
var cacheHeaders = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Expires': '0'
};

// Internet Explorer compatibility mode
var uaCompatible = {
  'X-UA-Compatible': 'IE=edge,chrome=1'
};

// Make requests throttled with a threshold equal to 60 seconds
// Used by '/events' and '/status/hitmanforum' routes
var httpMediumThrottle = axios.create({
	adapter: throttleAdapterEnhancer(axios.defaults.adapter, { threshold: 60 * 1000 })
});

// Make requests throttled with a threshold equal to 30 seconds
// Used by '/status/steam' and '/status/hitman' routes
var httpHighThrottle = axios.create({
	adapter: throttleAdapterEnhancer(axios.defaults.adapter, { threshold: 30 * 1000 })
});

String.prototype.startsWith = function(str) {
  return (this.indexOf(str) === 0);
};

router.get('/', function(req, res, next) {
  res.set(uaCompatible);
  res.render('index', {
    path: req.path,
    title: 'HITMAN Status'
  });
});

router.get('/events', function(req, res, next) {

  res.set(uaCompatible);

  var days = (!isNaN(parseInt(req.query.days)) && req.query.days.length <= 3) ? Math.abs(req.query.days) : 7 ;
  var query = pgp.as.format("SELECT * FROM $1 WHERE date > NOW() - INTERVAL '$2# days' ORDER BY id DESC LIMIT 300", [tn, days]);

  db.any(query)
  .then(function(data) {
    res.render('events', {
      path: req.path,
      title: 'HITMAN Status',
      events: data,
      moment: moment,
      days: days
    });
  })
  .catch(function(error) {
    res.locals.status = error.routine;
    res.locals.message = error;
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
    { service:"STEAM WEBAPI", status:"unknow" },
    { service:"STEAM CMS", status:"unknown" }
  ];

  httpHighThrottle.request(options).then(function(response) {
    if(response.headers['content-type'].indexOf('application/json') !== -1) {
      if(moment(response.data.time).isAfter(steamLastRequestTimestamp)) {
        debug('New data received from steamstat.us');
        steamLastRequestTimestamp = response.data.time;
        events[0].status = formatServiceStatus(response.data.services.webapi.status, 'steam');
        events[1].status = formatServiceStatus(response.data.services.cms.status, 'steam');
        submitEvents(events);
      }
      res.json(response.data);
    } else {
      // if cloudflare block the request, use cloudscraper to bypass cloudflare's protection
      debug('HTTP request denied by cloudflare');
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
        if(moment(output.time).isAfter(steamLastRequestTimestamp)) {
          debug('New data received from steamstat.us');
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

// www.hitmanforum.com status
router.get('/status/hitmanforum', function(req, res, next) {

  res.set(cacheHeaders);

  var options = {
    url: 'https://www.hitmanforum.com',
    timeout: TIMEOUT,
    transformResponse: [
      function () {
        return null;
      }
    ]
  };

  var service = {
    service: 'hitmanforum',
    status: 'down'
  };

  var start = Date.now();

  httpMediumThrottle.request(options).then(function(response) {
    service.status = ((Date.now() - start) > HIGHLOAD_THRESHOLD) ? 'warn' : 'up';
    res.json(service);
  }).catch(function (error) {
    if (error.code === 'ECONNABORTED')
      service.title = 'timeout';
    if(!res.headersSent) res.json(service);
    submitEvents([
      { service:"HITMAN FORUM", status:service.status }
    ]);
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
    { service:"HITMAN AUTHENTICATION", status:"down" },
    { service:"HITMAN PC", status:"down" },
    { service:"HITMAN XboxOne", status:"down" },
    { service:"HITMAN PS4", status:"down" },
    { service:"HITMAN SNIPER ASSASSIN PC", status:"down" },
    { service:"HITMAN SNIPER ASSASSIN XboxOne", status:"down" },
    { service:"HITMAN SNIPER ASSASSIN PS4", status:"down" }
  ];

  httpHighThrottle.request(options).then(function(response) {
    if(response.headers['content-type'].indexOf('application/json') !== -1) {
      body = response.data;
      // If hitman server sends a more recent response
      if(moment(body.timestamp).isAfter(hitmanLastRequestTimestamp) || !hitmanLastRequestTimestamp) {
        debug('New data received from auth.hitman.io');
        // store the response
        hitmanLastRequestTimestamp = body.timestamp;
        hitmanLastRequestContent = body;
        // send the new status of hitman services
        events[0].status = "up";
        events[1].status = formatServiceStatus(hitmanLastRequestContent.services['pc-service.hitman.io'].health, 'hitman');
        events[2].status = formatServiceStatus(hitmanLastRequestContent.services['xboxone-service.hitman.io'].health, 'hitman');
        events[3].status = formatServiceStatus(hitmanLastRequestContent.services['ps4-service.hitman.io'].health, 'hitman');
        events[4].status = formatServiceStatus(hitmanLastRequestContent.services['scpc-service.hitman.io'].health, 'hitman');
        events[5].status = formatServiceStatus(hitmanLastRequestContent.services['scxboxone-service.hitman.io'].health, 'hitman');
        events[6].status = formatServiceStatus(hitmanLastRequestContent.services['scps4-service.hitman.io'].health, 'hitman');
        submitEvents(events);
      }
      res.json(hitmanLastRequestContent);
    } else {
      service.status = 'Unknown';
      service.title = 'Bad data returned by authentication server';
      res.json(service);
      submitEvents([events[0]]);
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
    submitEvents([events[0]]);
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

// Submit events to database
function submitEvents(events) {

  debug('A submission request to database has been initiated (%d event(s))', events.length);

  var noUpEvents = [];
  var downCounter = 0;
  var type = "";

  if(events[0].service.startsWith('STEAM')) {
    type = "STEAM";
    downCounter = steamDownCounter;
  } else if(events[0].service == 'HITMAN FORUM') {
    type = "HMF";
    downCounter = hitmanForumDownCounter;
  } else {
    type = "HITMAN";
    downCounter = hitmanDownCounter;
  }

  // Exclude up and high load status
  for (var index = 0; index < events.length; index++)
    if(events[index].status != 'up' && events[index].status != 'high load') noUpEvents.push(events[index]);

  // If one or more services are not available
  if (noUpEvents.length > 0) {
    if(downCounter === 0)
      downCounter++;
    else if(downCounter > 1)
      downCounter = downCounter * 2;
    if(!moment().isAfter(moment(initialTime.toISOString()).add(downCounter, 'm')))
      return;
    else {
      initialTime = moment();
      switch (type) {
        case "STEAM":
          steamDownCounter++;
          break;
        case "HMF":
          hitmanForumDownCounter++;
          break;
        case "HITMAN":
          hitmanDownCounter++;
          if(noUpEvents.length > 2) {
            var maintenanceMode = 0;
            for (index = 0; index < noUpEvents.length; index++)
              if(noUpEvents[index].status == 'maintenance')
                maintenanceMode++;
            if(maintenanceMode >= 3)
              noUpEvents = [{ service:"HITMAN PC / Xbox One / PS4", status:"maintenance" }];
          }
          break;
      }
    }
    debug('Sending %d event(s)', noUpEvents.length);
    var query = pgp.helpers.insert(noUpEvents, cs);
    db.none(query).catch(function(error) {
      console.error("Failed to submit data to database. Routine " + error.routine + " " + error);
    });
  } else {
    debug("No event sent. Service type '%s' seems available, only 'up' or 'high load' events have been received", type);
    switch (type) {
      case "STEAM":
        steamDownCounter = 0;
        break;
      case "HMF":
        hitmanForumDownCounter = 0;
        break;
      case "HITMAN":
        hitmanDownCounter = 0;
        break;
    }
  }

}

module.exports = router;
