/* eslint-disable global-require */

'use strict';

const appender = require('../lib');

const fakeAxios = {
  create(config) {
    this.config = config;
    return {
      post(emptyString, event) {
        fakeAxios.args = [emptyString, event];
        return {
          catch: function (cb) {
            fakeAxios.errorCb = cb;
          },
        };
      },
    };
  },
};
jest.mock('axios', () => fakeAxios);

function setupLogging(category, enableCallStack, options) {
  const error = jest.spyOn(console, 'error').mockImplementation();
  let log4js;
  jest.isolateModules(() => {
    log4js = require('log4js');
  });

  log4js.configure({
    appenders: { http: { ...options, type: '../lib' } },
    categories: {
      default: {
        appenders: ['http'],
        level: 'trace',
        enableCallStack: enableCallStack,
      },
    },
  });

  return {
    logger: log4js.getLogger(category),
    logger2: log4js.getLogger(category),
    fakeAxios,
    error,
  };
}

describe('logFaces appender', () => {
  it('should export a configure function', () => {
    expect(typeof appender.configure).toBe('function');
  });

  describe('when using HTTP receivers', () => {
    const setup = setupLogging('myCategory', false, {
      application: 'LFS-HTTP',
      url: 'http://localhost/receivers/rx1',
      hostname: 'localhost',
    });

    it('axios should be configured', () => {
      expect(setup.fakeAxios.config.baseURL).toBe(
        'http://localhost/receivers/rx1'
      );
      expect(setup.fakeAxios.config.timeout).toBe(5000);
      expect(setup.fakeAxios.config.withCredentials).toBe(true);
      expect(setup.fakeAxios.config.headers).toEqual({
        'Content-Type': 'application/json',
      });
    });

    setup.logger.addContext('foo', 'bar');
    setup.logger.addContext('bar', 'foo');
    setup.logger.warn('Log event #1');

    it('an event should be sent', () => {
      const event = setup.fakeAxios.args[1];
      expect(event.a).toBe('LFS-HTTP');
      expect(event.m).toBe('Log event #1');
      expect(event.g).toBe('myCategory');
      expect(event.p).toBe('WARN');
      expect(event.h).toBe('localhost');
      expect(event.p_foo).toBe('bar');
      expect(event.p_bar).toBe('foo');

      // Assert timestamp, up to hours resolution.
      const date = new Date(event.t);
      expect(date.toISOString().substring(0, 14)).toBe(
        new Date().toISOString().substring(0, 14)
      );
    });

    it('errors should be sent to console.error', () => {
      setup.fakeAxios.errorCb({ response: { status: 500, data: 'oh no' } });
      expect(setup.error).toHaveBeenCalledWith(
        'log4js.logFaces-HTTP Appender error posting to http://localhost/receivers/rx1: 500 - oh no'
      );
      setup.fakeAxios.errorCb(new Error('oh dear'));
      expect(setup.error).toHaveBeenCalledWith(
        'log4js.logFaces-HTTP Appender error: oh dear'
      );
    });
  });

  it('should serialise stack traces correctly', () => {
    const setup = setupLogging('stack-traces', false, {
      url: 'http://localhost/receivers/rx1',
    });
    const error = new Error('something went wrong');
    setup.logger.error('Oh no', error);
    const event = setup.fakeAxios.args[1];
    expect(event.m).toBe('Oh no');
    expect(event.w).toBe(true);
    expect(event.i).toBe(error.stack);
  });

  it('log event should contain locations', () => {
    const setup = setupLogging('myCategory', true, {
      application: 'LFS-HTTP',
      url: 'http://localhost/receivers/rx1',
    });

    setup.logger.info('Log event #1');
    const event = setup.fakeAxios.args[1];
    expect(event.a).toBe('LFS-HTTP');
    expect(event.m).toBe('Log event #1');
    expect(event.g).toBe('myCategory');
    expect(event.p).toBe('INFO');

    expect(event.f).toMatch(/index.test.js/);
    expect(typeof event.l).toBe('number');
    expect(event.e).toBe('Object.info');
  });

  describe('can handle global context', () => {
    const ctx = {
      sessionID: 111,
    };

    const setup = setupLogging('myCategory', false, {
      application: 'LFS-HTTP',
      url: 'http://localhost/receivers/rx1',
      configContext: () => ctx,
    });

    it('event has properties from config context', () => {
      setup.logger.info('Log event #1');
      const event1 = setup.fakeAxios.args[1];
      expect(event1.m).toBe('Log event #1');
      expect(event1.p_sessionID).toBe(111);
    });

    it('two appenders share the same config context', () => {
      setup.logger.info('Log event #1');
      const event1 = setup.fakeAxios.args[1];
      expect(event1.m).toBe('Log event #1');
      expect(event1.p_sessionID).toBe(111);

      setup.logger2.info('Log event #2');
      const event2 = setup.fakeAxios.args[1];
      expect(event2.m).toBe('Log event #2');
      expect(event2.p_sessionID).toBe(111);
    });

    it('update config context', () => {
      setup.logger.info('Log event #1');
      const event1 = setup.fakeAxios.args[1];
      expect(event1.m).toBe('Log event #1');
      expect(event1.p_sessionID).toBe(111);

      ctx.sessionID = 222;

      setup.logger.info('Log event #2');
      const event2 = setup.fakeAxios.args[1];
      expect(event2.m).toBe('Log event #2');
      expect(event2.p_sessionID).toBe(222);
    });

    it('appender context overrides config context', () => {
      ctx.sessionID = 111;

      setup.logger.info('Log event #1');
      const event1 = setup.fakeAxios.args[1];
      expect(event1.m).toBe('Log event #1');
      expect(event1.p_sessionID).toBe(111);

      setup.logger.addContext('sessionID', 555);
      setup.logger.info('Log event #2');
      const event2 = setup.fakeAxios.args[1];
      expect(event2.m).toBe('Log event #2');
      expect(event2.p_sessionID).toBe(555);
    });
  });
});
