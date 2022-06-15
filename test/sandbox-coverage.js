'use strict';

const sandbox = require('@log4js-node/sandboxed-module');
const NYC = require('nyc');

sandbox.configure({
  sourceTransformers: {
    nyc: function (source) {
      if (this.filename.indexOf('node_modules') > -1) {
        return source;
      }
      return new NYC().instrumenter().instrumentSync(source, this.filename);
    }
  }
});
