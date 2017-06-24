/* global m, timerView, services */
'use strict';

var count = 30;
var timer = {
  oninit: tick,
  view: function() {
    return m("span", count);
  }
};

function tick() {
  setInterval(function() {
    if(count === 0) {
      count = 30;
      services.refresh();
    } else
      count--;
    m.redraw();
  }, 1000);
}

m.mount(timerView, timer);
