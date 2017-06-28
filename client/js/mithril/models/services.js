/* global m, errorElement */
'use strict';

var services = services || {};

services.list = [];

services.loadList = (function() {
  return m.request({
    method: 'GET',
    url: '/get/services'
  })
  .then(function(result) {
    services.list = result;
  });
})();
services.refresh = function() {
  // --------- Azure ---------
  m.request({
    method: 'GET',
    url: '/status/global',
  })
  .then(function(result) {
    if(result.status == 'unavailable') {
      errorElement.style.display = 'block';
      errorElement.innerHTML = '<h1>All services are unavailable</h1><span></span><h2>' + result.message + '</h2><h3>Last check : ' + result.last_check + ' UTC</h3>';
      services.list.map(function(service) {
        if(service.platform == 'azure')
          service.status = 'down';
      });
    } else {
      errorElement.style.display = 'none';
      errorElement.innerHTML = '';
      services.list.map(function(service) {
        if(service.platform == 'azure') {
          return m.request({
            method: 'GET',
            url: '/status/' + service.endpoint,
          })
          .then(function(result) {
            service.status = result.status;
            if(result.title)
              service.title = result.title;
            else
              service.title = (service.status == 'warn') ? 'high load' : '';
          });
        }
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
