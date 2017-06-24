/* global document */
'use strict';

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

/**
 * Misc Functions
 */
var audioControl = function() {
  audioElement.muted = !audioElement.muted;
};
