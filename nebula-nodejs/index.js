"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "Client", {
  enumerable: true,
  get: function () {
    return _nebula.Client;
  }
});
Object.defineProperty(exports, "Connection", {
  enumerable: true,
  get: function () {
    return _nebula.Connection;
  }
});
Object.defineProperty(exports, "bytesToLongLongString", {
  enumerable: true,
  get: function () {
    return _native.bytesToLongLongString;
  }
});
Object.defineProperty(exports, "createClient", {
  enumerable: true,
  get: function () {
    return _nebula.createClient;
  }
});
exports.default = void 0;
Object.defineProperty(exports, "hash64", {
  enumerable: true,
  get: function () {
    return _native.hash64;
  }
});
Object.defineProperty(exports, "parser", {
  enumerable: true,
  get: function () {
    return _nebula.parser;
  }
});
var _nebula = require("./nebula");
var _native = require("./native");
var _default = _nebula.createClient;
exports.default = _default;
//# sourceMappingURL=index.js.map