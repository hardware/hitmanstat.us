/* global m, window, moment, servicesView */
'use strict';

var services = services || {};
var dateFormat = 'MMM Do YYYY hh:mmA';

services.oncreate = function() {
  window.addEventListener("load", function() {
    services.refresh();
  });
};

services.view = function() {
  return m("#services", { class:"services-block" }, services.list.map(function(service) {
    return m("a", { href:"#", class: "service-block"}, [
      m("div", { class:setClass(service) }),
      m("h1", (service.platform != 'azure') ? service.name : service.name + " service" ),
      m("h2", setState(service)),
      setPopover(service)
    ]);
  }));
};

function setClass(service) {
  var status = (service.status) ? service.status : 'loading';
  return 'service-status ' + status;
}

function setState(service) {
  var status = (service.status) ? service.status : 'loading...';
  var title = (service.title) ? ' - ' + service.title : '';
  return status + title;
}

function setPopover(service) {
  if(service.platform != 'azure')
    return null;

  var lastCheck = moment(service.lastCheck).format(dateFormat);

  if(service.nextWindow) {
    return [
      m("span", { class:'help' }, [ '?',
        m("span", { class:'popover' }, [
          m('p', 'Next maintenance period :'),
          m('p', 'Start : ' + moment(service.nextWindow.start).format(dateFormat)),
          m('p', 'End : ' + moment(service.nextWindow.end).format(dateFormat)),
          m('p', 'Last check : ' + lastCheck)
        ])
      ])
    ];
  } else {
    return [
      m("span", { class:'help' }, [ '?',
        m("span", { class:'popover' }, [
          m('p', 'Last check : ' + lastCheck)
        ])
      ])
    ];
  }
}

m.mount(servicesView, services);
