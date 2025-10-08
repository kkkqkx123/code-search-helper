"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hash64 = exports.default = exports.bytesToLongLongString = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const addon = require('bindings')('addon');
const bytesToLongLongString = buffer => {
  const tmp = _lodash.default.reverse(buffer);
  return addon.bytesToLongLongString(...tmp);
};
exports.bytesToLongLongString = bytesToLongLongString;
const hash64 = key => {
  return addon.hash64(key);
};
exports.hash64 = hash64;
var _default = {
  bytesToLongLongString,
  hash64
};
exports.default = _default;
//# sourceMappingURL=index.js.map