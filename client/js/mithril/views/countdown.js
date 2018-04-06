/* global m, countdownView */
'use strict';

var content = "";
var countdown = {
  oninit: tack,
  view: function() {
    return m("span", (content) ? m.trust("HITMAN Definitive Edition : " + content) : "Loading countdown...");
  }
};

function tack() {
  var timeinterval = setInterval(function() {
    content = "";
    var time = getRemainingTime("May 15 2018 00:00:00 GMT+0100");
    if (time.days > 0)
      content += time.days + " day" + (time.days > 1 ? "s" : "") + " ";
    if (time.days > 0 || time.hours > 0)
      content += ('0' + time.hours).slice(-2) + " hour" + (time.hours > 1 ? "s" : "") + " ";
    if (time.days > 0 || time.hours > 0 || time.minutes > 0)
      content += ('0' + time.minutes).slice(-2) + " minute" + (time.minutes > 1 ? "s" : "") + " ";
    if (time.days > 0 || time.hours > 0 || time.minutes > 0 || time.seconds > 0)
      content += ('0' + time.seconds).slice(-2) + " second" + (time.seconds > 1 ? "s" : "");
    else
      content = '<a href="https://www.ioi.dk/20-years-of-ioi/">https://www.ioi.dk/20-years-of-ioi/</a>';
    if(time.total <= 0)
      clearInterval(timeinterval);
  }, 1000);
}

function getRemainingTime(endtime) {
  var time    = Date.parse(endtime) - Date.parse(new Date());
  var seconds = Math.floor((time / 1000) % 60);
  var minutes = Math.floor((time / 1000 / 60) % 60);
  var hours   = Math.floor((time / (1000 * 60 * 60)) % 24);
  var days    = Math.floor(time / (1000 * 60 * 60 * 24));
  return {
    'total': time,
    'days': days,
    'hours': hours,
    'minutes': minutes,
    'seconds': seconds
  };
}

m.mount(countdownView, countdown);
