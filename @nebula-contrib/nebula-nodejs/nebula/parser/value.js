"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _nodeInt = _interopRequireDefault(require("node-int64"));
var _native = _interopRequireDefault(require("../../native"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _default = (obj, propName) => {
  const v = obj[propName];
  if (v instanceof _nodeInt.default) {
    if (isFinite(v.valueOf())) {
      return +v.toString();
    } else {
      if (v.buffer) {
        return _native.default.bytesToLongLongString(v.buffer);
      }
      return v.toOctetString();
    }
  }
  return v;
};
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=value.js.map