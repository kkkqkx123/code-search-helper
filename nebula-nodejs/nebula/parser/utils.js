"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const NebulaValueTypeNames = ['nVal', 'bVal', 'iVal', 'fVal', 'sVal', 'dVal', 'tVal', 'dtVal', 'gVal'];
const getNebulaValueTypeName = obj => {
  return _lodash.default.chain(obj).keys().filter(k => obj[k] !== null).first().value();
};
const isNebulaValue = obj => {
  return obj && obj.nVal !== undefined;
};
const isNebulaValueTypeName = propName => {
  return _lodash.default.includes(NebulaValueTypeNames, propName);
};
const isNebulaNListTypeName = propName => {
  return propName === 'lVal';
};
const isNebulaVertexTypeName = propName => {
  return propName === 'vVal';
};
const isNebulaEdgeTypeName = propName => {
  return propName === 'eVal';
};
const isNebulaPathTypeName = propName => {
  return propName === 'pVal';
};
const isNebulaNMapTypeName = propName => {
  return propName === 'mVal';
};
const isNebulaNSetTypeName = propName => {
  return propName === 'uVal';
};
const isNebulaNDataSetTypeName = propName => {
  return propName === 'gVal';
};
var _default = {
  isNebulaValueTypeName,
  isNebulaNListTypeName,
  isNebulaVertexTypeName,
  isNebulaEdgeTypeName,
  isNebulaPathTypeName,
  isNebulaValue,
  isNebulaNMapTypeName,
  isNebulaNSetTypeName,
  isNebulaNDataSetTypeName,
  getNebulaValueTypeName
};
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=utils.js.map