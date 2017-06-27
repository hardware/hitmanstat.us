/* global m, window, servicesView */
'use strict';

var services = services || {};

services.oncreate = function() {
  window.addEventListener("load", function() {
    services.refresh();
  });
  // refresh backup if load event doesn't work
  setTimeout(function() {
    services.refresh();
  }, 1000);
};

services.view = function() {
  return m("#services", { class:"services-block" }, services.list.map(function(service) {
    return m("a", { href:"#", class: "service-block"}, [
      m("div", { class:setclass(service) }),
      m("h1", (service.platform != 'azure') ? service.name : service.name + " service" ),
      m("h2", setState(service))
    ]);
  }));
};

function setclass(service) {
  var status = (service.status) ? service.status : 'loading';
  return 'service-status ' + status;
}

function setState(service) {
  var status = (service.status) ? service.status : 'loading...';
  var title = (service.title) ? ' - ' + service.title : '';
  return status + title;
}

m.mount(servicesView, services);
