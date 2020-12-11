const chrome = require('sinon-chrome/extensions');
const browser = require('sinon-chrome/webextensions');
global.chrome = chrome;
global.browser = browser;

window.isTest = true;
console.log("initializing tests");