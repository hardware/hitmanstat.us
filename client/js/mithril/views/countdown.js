/* global m, countdownView */
'use strict';

var content = "";
var countdown = {
  oninit: tack,
  view: function() {
    return m("span", (content) ? m.trust("October content reveal : " + content) : "Loading countdown...");
  }
};

function tack() {
  var timeinterval = setInterval(function() {
    content = "";
    var time = getRemainingTime("October 24 2017 14:00:00 GMT+0200");
    if (time.days > 0)
      content += time.days + " day" + (time.days > 1 ? "s" : "") + " ";
    if (time.days > 0 || time.hours > 0)
      content += ('0' + time.hours).slice(-2) + " hour" + (time.hours > 1 ? "s" : "") + " ";
    if (time.days > 0 || time.hours > 0 || time.minutes > 0)
      content += ('0' + time.minutes).slice(-2) + " minute" + (time.minutes > 1 ? "s" : "") + " ";
    if (time.days > 0 || time.hours > 0 || time.minutes > 0 || time.seconds > 0)
      content += ('0' + time.seconds).slice(-2) + " second" + (time.seconds > 1 ? "s" : "");
    else
      content = '<a href="https://www.ioi.dk/news/">https://www.ioi.dk/news/</a>';
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
