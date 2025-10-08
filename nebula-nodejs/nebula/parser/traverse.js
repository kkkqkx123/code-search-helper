"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _nodeInt = _interopRequireDefault(require("node-int64"));
var _lodash = _interopRequireDefault(require("lodash"));
var _dataset = _interopRequireDefault(require("./dataset"));
var _edge = _interopRequireDefault(require("./edge"));
var _list = _interopRequireDefault(require("./list"));
var _map = _interopRequireDefault(require("./map"));
var _native = _interopRequireDefault(require("../../native"));
var _path = _interopRequireDefault(require("./path"));
var _set = _interopRequireDefault(require("./set"));
var _utils = _interopRequireDefault(require("./utils"));
var _value = _interopRequireDefault(require("./value"));
var _vertex = _interopRequireDefault(require("./vertex"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
const getNebulaValue = obj => {
  if (_utils.default.isNebulaValue(obj)) {
    const propName = _utils.default.getNebulaValueTypeName(obj);
    if (propName) {
      if (_utils.default.isNebulaValueTypeName(propName)) {
        return (0, _value.default)(obj, propName);
      } else if (_utils.default.isNebulaNListTypeName(propName)) {
        return (0, _list.default)(obj, propName);
      } else if (_utils.default.isNebulaVertexTypeName(propName)) {
        return (0, _vertex.default)(obj, propName);
      } else if (_utils.default.isNebulaEdgeTypeName(propName)) {
        return (0, _edge.default)(obj, propName);
      } else if (_utils.default.isNebulaPathTypeName(propName)) {
        return (0, _path.default)(obj, propName);
      } else if (_utils.default.isNebulaNMapTypeName(propName)) {
        return (0, _map.default)(obj, propName);
      } else if (_utils.default.isNebulaNSetTypeName(propName)) {
        return (0, _set.default)(obj, propName);
      } else if (_utils.default.isNebulaNDataSetTypeName(propName)) {
        return (0, _dataset.default)(obj, propName);
      } else {
        return {
          [propName]: obj[propName]
        };
      }
    }
    return null;
  }
  return obj;
};
const convert = entity => {
  if (_lodash.default.isFunction(entity)) {
    return undefined;
  } else if (_utils.default.isNebulaValue(entity)) {
    const obj = getNebulaValue(entity);
    if (_lodash.default.isDate(entity)) {
      return entity;
    } else if (_lodash.default.isArray(obj) || _lodash.default.isPlainObject || _lodash.default.isObject(obj)) {
      return convert(obj);
    }
    return obj;
  } else if (_lodash.default.isArray(entity)) {
    const out = [];
    _lodash.default.forEach(entity, o => {
      out.push(convert(o));
    });
    return out;
  } else if (_lodash.default.isPlainObject(entity)) {
    const out = {};
    const keys = _lodash.default.keys(entity);
    _lodash.default.forEach(keys, key => {
      const o = entity[key];
      out[key] = convert(o);
    });
    return out;
  } else if (entity instanceof _nodeInt.default) {
    if (isFinite(entity.valueOf())) {
      return +entity.toString();
    } else {
      if (entity.buffer) {
        return _native.default.bytesToLongLongString(entity.buffer);
      }
      return entity.toOctetString();
    }
  } else if (_lodash.default.isDate(entity)) {
    return entity;
  } else if (_lodash.default.isObject(entity)) {
    return convert(_lodash.default.toPlainObject(entity));
  } else {
    return entity;
  }
};
const traverse = obj => {
  var _result$data, _result$data2, _result$metrics;
  const start = Date.now();
  const result = convert(obj);
  const columns = result === null || result === void 0 ? void 0 : (_result$data = result.data) === null || _result$data === void 0 ? void 0 : _result$data.column_names;
  const rows = result === null || result === void 0 ? void 0 : (_result$data2 = result.data) === null || _result$data2 === void 0 ? void 0 : _result$data2.rows;
  if (columns && rows) {
    const entity = {};
    _lodash.default.forEach(columns, c => {
      entity[c] = [];
    });
    _lodash.default.forEach(rows, row => {
      _lodash.default.forEach(columns, (c, i) => {
        entity[c].push(row.values[i]);
      });
    });
    result.data = entity;
  }
  const end = Date.now();
  result.metrics = (_result$metrics = result.metrics) !== null && _result$metrics !== void 0 ? _result$metrics : {
    execute: 0,
    traverse: 0
  };
  result.metrics.traverse = end - start;
  return result;
};
var _default = traverse;
exports.default = _default;
module.exports = exports.default;
//# sourceMappingURL=traverse.js.map