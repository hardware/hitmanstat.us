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
    return m("a", { href:(service.url) ? service.url : '#', target:(service.url) ? '_blank' : '_self', rel:'noopener', class: "service-block"}, [
      m("div", { class:setClass(service) }),
      m("h1", service.name),
      m("h2", setState(service)),
      setInfo(service),
      setElusive(service)
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

function setInfo(service) {
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

function setElusive(service) {
  if(service.elusive) {
    var start = moment(service.elusive.nextWindow.start);
    var end = moment(service.elusive.nextWindow.end);
    var duration = moment.duration(start.diff(moment()));
    return [
      m("span", { class:'help elusive' }, [ 'Elusive target',
        m("span", { class:'popover' }, [
          m('p', 'ELUSIVE TARGET CONTRACT ACTIVATED'),
          m('hr'),
          m('p', [
            m('span', { class: 'item' }, 'Name :'),
            service.elusive.name
          ]),
          m('p', [
            m('span', { class: 'item' }, 'Start in :'),
            duration.humanize()
          ]),
          m('p', [
            m('span', { class: 'item' }, 'Location :'),
            service.elusive.location
          ]),
          m('p', [
            m('span', { class: 'item' }, 'Start :'),
            start.format(dateFormat)
          ]),
          m('p', [
            m('span', { class: 'item' }, 'End :'),
            end.format(dateFormat)
          ]),
          m('p', [
            m('span', { class: 'item' }, 'Duration :'),
            end.diff(start, 'days') + ' days'
          ])
        ])
      ])
    ];
  } else {
    return [];
  }
}

m.mount(servicesView, services);
