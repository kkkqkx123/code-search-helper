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
      
      // 认证成功，先清理可能存在的旧会话
      if (this.sessionId && this.sessionId !== response.session_id) {
        console.warn(`发现旧会话 ${this.sessionId}，正在清理...`);
        return this.forceCleanup().then(() => response);
      }
      
      return response;
    }).then(response => {
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
      
      // 重连前先清理当前会话
      if (this.sessionId) {
        this.forceCleanup().finally(() => {
          const self = this;
          setTimeout(() => {
            this.prepare.bind(self)();
          }, 1000);
        });
      } else {
        const self = this;
        setTimeout(() => {
          this.prepare.bind(self)();
        }, 1000);
      }
    });
  }
  close() {
    return new Promise((resolve, reject) => {
      // 优先尝试会话注销，无论连接状态如何
      const cleanupPromise = this.sessionId 
        ? this.client.signout(this.sessionId).catch(() => {}) 
        : Promise.resolve();
      
      cleanupPromise.finally(() => {
        // 清理本地会话ID
        this.sessionId = null;
        
        if (this.connection.connected) {
          try {
            this.connection.end();
            resolve({});
          } catch (error) {
            reject(error);
          }
        } else {
          resolve({});
        }
      });
    });
  }
  forceCleanup() {
    return new Promise((resolve) => {
      if (this.sessionId) {
        // 无论连接状态如何，都尝试注销会话
        this.client.signout(this.sessionId)
          .catch(() => {
            // 忽略注销失败，但确保尝试过
          })
          .finally(() => {
            // 清理本地会话ID
            this.sessionId = null;
            resolve();
          });
      } else {
        resolve();
      }
    });
  }
  ping(timeout) {
    if (this.connection.connected && this.sessionId) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve(false);
        }, timeout);
        this.client.execute(this.sessionId, 'YIELD 1').then(response => {
          clearTimeout(timer);
          // 验证会话是否仍然有效
          const isValid = response.error_code === 0 || 
                         (response.error_code === -1005); // 会话无效错误码
          resolve(isValid);
        }).catch((error) => {
          clearTimeout(timer);
          // 如果是会话相关错误，标记为需要重新认证
          if (error.code === -1005) {
            this.isReady = false;
            this.forceCleanup();
          }
          resolve(false);
        });
      });
    }
    return Promise.resolve(false);
  }
  run(task) {
    // 执行前验证会话状态
    if (!this.sessionId || !this.isReady) {
      const error = new _NebulaError.default(9995, '会话无效或连接未就绪');
      task.reject(error);
      this.isBusy = false;
      this.emit('free', { sender: this });
      return;
    }
    
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