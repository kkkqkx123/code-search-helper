"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
Object.defineProperty(exports, "Client", {
  enumerable: true,
  get: function () {
    return _Client.default;
  }
});
Object.defineProperty(exports, "Connection", {
  enumerable: true,
  get: function () {
    return _Connection.default;
  }
});
exports.default = exports.createClient = void 0;
Object.defineProperty(exports, "parser", {
  enumerable: true,
  get: function () {
    return _parser.default;
  }
});
var _Client = _interopRequireDefault(require("./Client"));
var _Connection = _interopRequireDefault(require("./Connection"));
var _parser = _interopRequireDefault(require("./parser"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const createClient = option => new _Client.default(option);
exports.createClient = createClient;
var _default = createClient;
exports.default = _default;
//# sourceMappingURL=index.js.map