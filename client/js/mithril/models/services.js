/* global m */
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
  // Azure and hitmanforum
  services.list.map(function(service) {
    if(service.platform == 'steam') return;
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
  });
  // Steam
  return m.request({
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
