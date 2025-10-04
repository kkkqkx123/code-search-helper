"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var _thrift = _interopRequireDefault(require("../thrift"));
var _events = require("events");
var _GraphService = _interopRequireDefault(require("./interface/GraphService"));
var _parser = _interopRequireDefault(require("./parser"));
var _NebulaError = _interopRequireDefault(require("./NebulaError"));
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
class Connection extends _events.EventEmitter {
  constructor(connectionOption) {
    super();
    this.isReady = false;
    this.isBusy = true;
    connectionOption = _lodash.default.defaults(connectionOption, {
      bufferSize: 2000,
      poolSize: 5
    });
    this.connectionOption = connectionOption;
    this.connection = _thrift.default.createConnection(this.connectionOption.host, this.connectionOption.port, {
      max_attempts: Number.MAX_SAFE_INTEGER,
      retry_max_delay: 1000,
      transport: _thrift.default.TFramedTransport
    });
    this.client = _thrift.default.createClient(_GraphService.default, this.connection);
    this.connection.on('error', err => {
      var _this$_events;
      this.isReady = false;
      this.isBusy = true;
      if (this !== null && this !== void 0 && (_this$_events = this._events) !== null && _this$_events !== void 0 && _this$_events.error) {
        this.emit('error', {
          sender: this,
          error: err
        });
      }
    });
    this.connection.on('connect', () => {
      this.emit('connected', {
        sender: this
      });
      this.prepare();
    });
    this.connection.on('close', () => {
      this.isReady = false;
      this.isBusy = true;
      this.emit('close', {
        sender: this
      });
    });
    this.connection.on('reconnecting', ({
      delay,
      attempt
    }) => {
      this.emit('reconnecting', {
        sender: this,
        retryInfo: {
          delay,
          attempt
        }
      });
    });
  }
  prepare() {
    this.client.authenticate(this.connectionOption.userName, this.connectionOption.password).then(response => {
      if (response.error_code !== 0) {
        throw new _NebulaError.default(response.error_code, response.error_msg);
      }
      this.sessionId = response.session_id;
      this.emit('authorized', {
        sender: this
      });
      return new Promise((resolve, reject) => {
        this.run({
          command: `Use ${this.connectionOption.space}`,
          returnOriginalData: false,
          resolve,
          reject
        });
      });
    }).then(response => {
      if (response.error_code !== 0) {
        throw new _NebulaError.default(response.error_code, response.error_msg);
      }
      this.isReady = true;
      this.isBusy = false;
      this.emit('ready', {
        sender: this
      });
      this.emit('free', {
        sender: this
      });
    }).catch(err => {
      var _this$_events2;
      this.isReady = false;
      this.isBusy = true;
      if (this !== null && this !== void 0 && (_this$_events2 = this._events) !== null && _this$_events2 !== void 0 && _this$_events2.error) {
        this.emit('error', {
          sender: this,
          error: err
        });
      }
      const self = this;
      setTimeout(() => {
        this.prepare.bind(self)();
      }, 1000);
    });
  }
  close() {
    return new Promise((resolve, reject) => {
      if (this.connection.connected) {
        Promise.resolve().then(() => {
          return this.isReady ? this.client.signout(this.sessionId) : Promise.resolve();
        }).then(() => {
          return this.connection.end();
        }).then(() => {
          resolve({});
        }).catch(reject);
      } else {
        resolve({});
      }
    });
  }
  ping(timeout) {
    if (this.connection.connected) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(false);
        }, timeout);
        this.client.execute(this.sessionId, 'YIELD 1').then(response => {
          clearTimeout(timer);
          resolve(response.error_code === 0);
        }).catch(() => {
          clearTimeout(timer);
          resolve(false);
        });
      });
    }
    return Promise.resolve(false);
  }
  run(task) {
    this.isBusy = true;
    const start = Date.now();
    let end = Date.now();
    Promise.resolve().then(() => {
      return this.client.execute(this.sessionId, Buffer.from(task.command, 'utf-8'));
    }).then(response => {
      var _response$metrics;
      if (task.executingTimer) {
        clearTimeout(task.executingTimer);
        task.executingTimer = null;
      }
      end = Date.now();
      if (response.error_code !== 0) {
        throw new _NebulaError.default(response.error_code, response.error_msg);
      }
      response.metrics = (_response$metrics = response.metrics) !== null && _response$metrics !== void 0 ? _response$metrics : {
        execute: 0,
        traverse: 0
      };
      const elapsed = end - start;
      response.metrics.execute = elapsed;
      if (!task.returnOriginalData) {
        return _parser.default.traverse(response);
      }
      return Promise.resolve(response);
    }).then(response => {
      response.metrics.connectionId = this.connectionId;
      task.resolve(response);
    }).catch(err => {
      task.reject(err);
    }).finally(() => {
      this.isBusy = false;
      this.emit('free', {
        sender: this
      });
    });
  }
  getConnectionInfo() {
    return {
      connectionId: this.connectionId,
      host: this.connectionOption.host,
      port: this.connectionOption.port,
      space: this.connectionOption.space,
      isReady: this.isReady
    };
  }
}
exports.default = Connection;
module.exports = exports.default;
//# sourceMappingURL=Connection.js.map