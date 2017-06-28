/* global document */
'use strict';

var play = false;

/**
 * Mithril Namespaces
 */
var services = services || {};

/**
 * Views DOM anchors
 */
var servicesView = document.getElementById('services-container');
var timerView = document.getElementById('next-refresh');

/**
 * DOM Elements
 */
var audioElement = document.getElementById('audio-element');
var errorElement = document.getElementById('backend-error-container');

/**
 * Misc Functions
 */
var audioControl = function() {
  if(!play) {
    audioElement.play();
    play = true;
  } else {
    audioElement.pause();
    play = false;
  }
};
