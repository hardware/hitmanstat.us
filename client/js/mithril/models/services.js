/* global m, errorElement */
'use strict';

var services = services || {};

services.list = [
  { name:'auth', platform:'azure' },
  { name:'pc', endpoint:'pc-service.hitman.io', platform:'azure' },
  { name:'xbox one', endpoint:'xboxone-service.hitman.io', platform:'azure' },
  { name:'ps4', endpoint:'ps4-service.hitman.io', platform:'azure' },
  { name:'steam webapi', endpoint:'webapi', platform:'steam' },
  { name:'steam cms', endpoint:'cms', platform:'steam' },
  { name:'hitmanforum.com', endpoint:'hitmanforum', platform:'discourse' }
];

services.refresh = function() {
  // --------- HITMAN ---------
  m.request({
    method: 'GET',
    url: '/status/hitman',
  })
  .then(function(result) {
    if(result.status) {
      errorElement.style.display = 'block';
      errorElement.innerHTML = '<h1>All services are unavailable</h1><span></span><h2>' + result.title + '</h2><h3>Status : ' + result.status + '</h3>';
      services.list.map(function(service) {
        if(service.platform == 'azure') {
          service.status = 'down';
          service.title = null;
        }
      });
    } else {
      var lastCheck = result.timestamp;
      errorElement.style.display = 'none';
      errorElement.innerHTML = '';
      services.list.map(function(service) {

        if(service.platform != 'azure')
          return;

        if(service.name == 'auth') {
          service.status = 'up';
          service.lastCheck = lastCheck;
          return;
        }

        // Next maintenance
        var nextWindow = result.services[service.endpoint].nextWindow;

        // Service main status (e.g. UI_GAME_SERVICE_DOWN_MAINTENANCE)
        switch (result.services[service.endpoint].status) {
          case 'UI_GAME_SERVICE_DOWN_MAINTENANCE':
            service.status = 'maintenance';
            service.title = null;
            service.nextWindow = (nextWindow) ? nextWindow : null;
            service.lastCheck = lastCheck;
            return;
          /* case 'UI_GAME_SERVICE...':
            service.status = '...';
            return; */
        }

        // Service health (unknown, down, maintenance, slow, healthy)
        var status = result.services[service.endpoint].health;
        var map = { healthy:'up', slow:'warn' };
        var regex = new RegExp(Object.keys(map).join("|"), "gi");

        status = status.replace(regex, function(match) {
          return map[match];
        });

        service.status = status;
        service.title = (service.status == 'warn') ? 'high load' : '';
        service.nextWindow = (nextWindow) ? nextWindow : null;
        service.lastCheck = lastCheck;

      });
    }
  });
  //  --------- Hitmanforum ---------
  m.request({
    method: 'GET',
    url: '/status/hitmanforum',
  })
  .then(function(result) {
    services.list.map(function(service) {
      if(service.platform != 'discourse')
        return;
      service.status = result.status;
      if(result.title)
        service.title = result.title;
      else
        service.title = (service.status == 'warn') ? 'high load' : '';
    });
  });
  //  --------- Steam ---------
  m.request({
    method: 'GET',
    url: '/status/steam',
  })
  .then(function(result) {
    services.list.map(function(service) {
      if(service.platform != 'steam')
        return;
      if(!result.success) {
        service.status = result.status;
        service.title = result.title;
        return;
      }
      var status = result.services[service.endpoint].status;
      var map = {good:'up', minor:'warn', major:'down'};
      var regex = new RegExp(Object.keys(map).join("|"), "gi");
      status = status.replace(regex, function(match){
        return map[match];
      });
      service.status = status;
      service.title = result.services[service.endpoint].title;
    });
  });
};
