/**
 * logFaces appender sends JSON formatted log events to logFaces receivers over HTTP.
 */
/* eslint global-require:0 */

'use strict';

const util = require('util');
const axios = require('axios');

/**
 *
 * @param {any[]} logData
 * @returns {string}
 */
function format(logData) {
  let hasError = false;
  return util.format(
    ...logData.map((item) => {
      if (!hasError && item instanceof Error && item.stack) {
        hasError = true;
        // send only the base string for the first Error with a stack
        // note: all errors on node have `stack` unless it's specifically deleted
        return item.toString();
      }
      return item;
    })
  );
}

function getErrorStack(logData) {
  const obj = logData.find((item) => item instanceof Error && item.stack);
  if (obj) {
    return obj.stack;
  }
  return null;
}

/**
 *
 * For HTTP (browsers or node.js) use the following configuration params:
 *   {
 *      "type": "logFaces-HTTP",       // must be present for instantiation
 *      "application": "LFS-TEST",        // name of the application (domain)
 *      "url": "http://lfs-server/logs",  // logFaces receiver servlet URL
 *   }
 */
function logFacesAppender(config) {
  const sender = axios.create({
    baseURL: config.url,
    timeout: config.timeout || 5000,
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true,
  });

  const { configContext } = config;

  /**
   * @param {import('log4js').LoggingEvent} event
   */
  return function log(event) {
    // convert to logFaces compact json format
    const lfsEvent = {
      a: config.application || '', // application name
      t: event.startTime.getTime(), // time stamp
      p: event.level.levelStr, // level (priority)
      g: event.categoryName, // logger name
      m: format(event.data), // message text
      h: config.hostname, // hostname
    };

    if (event.fileName) {
      lfsEvent.f = event.fileName;
    }
    if (event.lineNumber) {
      lfsEvent.l = event.lineNumber;
    }
    if (event.functionName) {
      lfsEvent.e = event.functionName;
    }

    const errStack = getErrorStack(event.data);
    if (errStack) {
      lfsEvent.i = errStack;
      lfsEvent.w = true;
    }

    // add context variables if exist. Start with global context so that event.context
    // may override the same keys if defined
    if (configContext && configContext instanceof Function) {
      const ctx = configContext();
      Object.keys(ctx).forEach((key) => {
        lfsEvent[`p_${key}`] = ctx[key];
      });
    }

    Object.keys(event.context).forEach((key) => {
      lfsEvent[`p_${key}`] = event.context[key];
    });

    // send to server
    sender.post('', lfsEvent).catch((error) => {
      if (error.response) {
        // eslint-disable-next-line
        console.error(
          `log4js.logFaces-HTTP Appender error posting to ${config.url}: ${error.response.status} - ${error.response.data}`
        );
      } else {
        // eslint-disable-next-line
        console.error(`log4js.logFaces-HTTP Appender error: ${error.message}`);
      }
    });
  };
}

function configure(config) {
  return logFacesAppender(config);
}

module.exports.configure = configure;
