/* global m, moment, Notify, errorElement, audioElement */
'use strict';

var services = services || {};
var dateFormat = 'MMM Do YYYY hh:mmA';
var HitmanNotification = false;

services.list = [
  { name:'auth', endpoint:'auth.hitman.io', platform:'azure' },
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
    var lastCheck = moment().format(dateFormat);
    if(result.status) {
      if(!HitmanNotification) {
        notification('Hitman services are unavailable.');
        HitmanNotification = true;
      }
      errorElement.style.display = 'block';
      errorElement.innerHTML = '<h1>All services are unavailable</h1><span></span><h2>' + result.title + '</h2><h3>Status : ' + result.status + '</h3>';
      services.list.map(function(service) {
        if(service.platform == 'azure') {
          service.status = 'down';
          service.title = '';
          service.lastCheck = lastCheck;
        }
      });
    } else {
      if(HitmanNotification) {
        notification('Hitman services are back.');
        HitmanNotification = false;
      }
      lastCheck = moment(result.timestamp).format(dateFormat);
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
        var state = result.services[service.endpoint].status;
        // Service main state
        switch (state) {
          case 'UI_GAME_SERVICE_NOT_AVAILABLE':
            if(!nextWindow) break;
            // if the service is in maintenance during the next window
            if(nextWindow.status == 'UI_GAME_SERVICE_DOWN_MAINTENANCE') {
              service.status = 'maintenance';
              service.title = '';
              service.nextWindow = nextWindow;
              service.lastCheck = lastCheck;
              return;
            }
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
        service.state = (state) ? state : null;
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
    var lastCheck = moment().format(dateFormat);
    services.list.map(function(service) {
      if(service.platform != 'discourse')
        return;
      service.status = result.status;
      service.lastCheck = lastCheck;
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
    var lastCheck = moment().format(dateFormat);
    services.list.map(function(service) {
      if(service.platform != 'steam')
        return;
      if(!result.success) {
        service.status = result.status;
        service.title = result.title;
        service.lastCheck = lastCheck;
        return;
      }
      var status = result.services[service.endpoint].status;
      var map = {good:'up', minor:'warn', major:'down'};
      var regex = new RegExp(Object.keys(map).join("|"), "gi");
      status = status.replace(regex, function(match) {
        return map[match];
      });
      service.status = status;
      service.title = result.services[service.endpoint].title;
      service.lastCheck = lastCheck;
    });
  });
};

function notification(message) {
  var icon = null;
  switch (message) {
    case 'Hitman services are back.':
      icon = '/images/up.jpg';
      break;
    case 'Hitman services are unavailable.':
      icon = '/images/down.jpg';
      break;
  }
  if(!Notify.needsPermission) {
    var notification = new Notify('HITMAN Status', {
      body:message,
      icon:icon,
      timeout:10
    });
    notification.show();
  }
}
