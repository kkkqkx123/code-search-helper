"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
class NebulaError extends Error {
  constructor(errno, message) {
    super(message);
    this.code = 'ERR_NEBULA';
    this.errno = 0;
    this.errno = errno;
  }
}
var _default = NebulaError;
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=NebulaError.js.map