"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _traverse2 = _interopRequireDefault(require("./traverse"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const traverse = obj => {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve((0, _traverse2.default)(obj));
      } catch (err) {
        reject(err);
      }
    });
  });
};
var _default = {
  traverse
};
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=index.js.map