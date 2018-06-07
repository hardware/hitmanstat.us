/* global m, window, moment, dateFormat, servicesView */
'use strict';

var services = services || {};

services.oncreate = function() {
  window.addEventListener("load", function() {
    services.refresh();
  });
};

services.view = function() {
  return m("#services", { class:"services-block" }, services.list.map(function(service) {
    return m("a", { href:service.url, target:'_blank', title:'Show ' + service.name + ' stats', class: "service-block"}, [
      m("div", { class:setClass(service) }),
      m("h1", service.name),
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
  if(service.nextWindow) {
    return [
      m("span", { class:'help' }, [ '?',
        m("span", { class:'popover' }, [
          m('p', 'Next maintenance period :'),
          m('p', 'Start : ' + moment(service.nextWindow.start).format(dateFormat)),
          m('p', 'End : ' + moment(service.nextWindow.end).format(dateFormat)),
          m('p', 'Last check : ' + service.lastCheck)
        ])
      ])
    ];
  } else if(service.state) {
    return [
      m("span", { class:'help' }, [ '?',
        m("span", { class:'popover' }, [
          m('p', 'STATUS : ' + service.state),
          m('p', 'Last check : ' + service.lastCheck)
        ])
      ])
    ];
  } else {
    return [
      m("span", { class:'help' }, [ '?',
        m("span", { class:'popover' }, [
          m('p', 'Last check : ' + service.lastCheck)
        ])
      ])
    ];
  }
}

m.mount(servicesView, services);
