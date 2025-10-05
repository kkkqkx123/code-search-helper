"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;
var _lodash = _interopRequireDefault(require("lodash"));
var _Connection = _interopRequireDefault(require("./Connection"));
var _NebulaError = _interopRequireDefault(require("./NebulaError"));
var _events = require("events");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
let AsyncResource;
let executionAsyncId;
let isSupported = false;
try {
  const asyncHooks = require('async_hooks');
  if (typeof asyncHooks.AsyncResource.prototype.runInAsyncScope === 'function') {
    AsyncResource = asyncHooks.AsyncResource;
    executionAsyncId = asyncHooks.executionAsyncId;
    isSupported = true;
  }
} catch (e) {
  console.log('async_hooks does not support');
}
const getNumberValue = (actualValue, defaultValue) => {
  if (!_lodash.default.isInteger(actualValue)) {
    return defaultValue;
  } else if (actualValue <= 0) {
    return defaultValue;
  }
  return actualValue;
};
class Client extends _events.EventEmitter {
  constructor(option) {
    super();
    this.clientOption = null;
    this.connections = [];
    this.taskQueue = [];
    this.connectionGuarders = [];
    option.poolSize = getNumberValue(option.poolSize, 5);
    option.bufferSize = getNumberValue(option.bufferSize, 2000);
    option.executeTimeout = getNumberValue(option.executeTimeout, 10000);
    option.pingInterval = getNumberValue(option.pingInterval, 60000);
    this.clientOption = option;
    this.connections = [];
    
    // 启动会话监控
    this.startSessionMonitor();
    
    _lodash.default.forEach(this.clientOption.servers, conf => {
      for (let i = 0; i < this.clientOption.poolSize; ++i) {
        let host = null;
        let port = null;
        if (_lodash.default.isString(conf)) {
          const list = conf.split(':');
          if (list.length !== 2) {
            throw new _NebulaError.default(9998, `Config Error for nebula:${conf}`);
          }
          host = list[0];
          port = +list[1];
        } else if (_lodash.default.isPlainObject(conf)) {
          host = conf.host;
          port = conf.port;
        } else {
          throw new _NebulaError.default(9998, 'Config Error for nebula');
        }
        if (!host) {
          throw new _NebulaError.default(9998, 'Config Error for nebula, host is invalid');
        }
        if (!_lodash.default.isInteger(port) || port < 0) {
          throw new _NebulaError.default(9998, 'Config Error for nebula, port is invalid');
        }
        const connection = new _Connection.default({
          host,
          port,
          userName: this.clientOption.userName,
          password: this.clientOption.password,
          space: this.clientOption.space
        });
        connection.on('ready', ({
          sender
        }) => {
          this.emit('ready', {
            sender
          });
        });
        connection.on('free', ({
          sender
        }) => {
          if (this.taskQueue.length > 0) {
            const task = this.taskQueue.shift();
            if (task.asyncResource) {
              task.asyncResource.runInAsyncScope(sender.run, sender, task);
              task.asyncResource.emitDestroy();
            } else {
              sender.run(task);
            }
          }
        });
        connection.on('error', ({
          sender,
          error
        }) => {
          var _this$_events;
          if (this !== null && this !== void 0 && (_this$_events = this._events) !== null && _this$_events !== void 0 && _this$_events.error) {
            this.emit('error', {
              sender,
              error
            });
          }
        });
        connection.on('connected', ({
          sender
        }) => {
          this.emit('connected', {
            sender
          });
        });
        connection.on('authorized', ({
          sender
        }) => {
          this.emit('authorized', {
            sender
          });
        });
        connection.on('reconnecting', ({
          sender,
          retryInfo
        }) => {
          this.emit('reconnecting', {
            sender,
            retryInfo
          });
        });
        connection.on('close', ({
          sender
        }) => {
          this.emit('close', {
            sender
          });
        });
        connection.connectionId = `${host}-${port}-${i}`;
        this.connectionGuarders.push(setInterval(() => {
          connection.ping(this.clientOption.executeTimeout);
        }, this.clientOption.pingInterval));
        this.connections.push(connection);
      }
    });
  }
  execute(command, returnOriginalData = false) {
    return new Promise((resolve, reject) => {
      const timeout = this.clientOption.executeTimeout;
      const asyncResourceForExecute = new AsyncResource('nebula', executionAsyncId());
      const asyncResourceForTimeout = new AsyncResource('nebula', executionAsyncId());
      const task = {
        command,
        returnOriginalData,
        resolve,
        reject,
        executingTimer: setTimeout(() => {
          const err = new _NebulaError.default(9996, `Execute command timeout after ${timeout}`);
          asyncResourceForTimeout.runInAsyncScope(() => {
            reject(err);
          });
          asyncResourceForTimeout.emitDestroy();
        }, timeout)
      };
      if (isSupported) {
        task.asyncResource = asyncResourceForExecute;
      }
      const freeConnections = _lodash.default.filter(this.connections, o => o.isReady && !o.isBusy);
      if (freeConnections.length > 0) {
        const seed = _lodash.default.random(0, freeConnections.length - 1);
        const connection = freeConnections[seed];
        if (task.asyncResource) {
          task.asyncResource.runInAsyncScope(connection.run, connection, task);
          task.asyncResource.emitDestroy();
        } else {
          connection.run(task);
        }
      } else {
        if (this.taskQueue.length >= this.clientOption.bufferSize) {
          const taskShouldReject = this.taskQueue.shift();
          const err = new _NebulaError.default(9997, 'Nebula command buffer is full');
          if (taskShouldReject.asyncResource) {
            taskShouldReject.asyncResource.runInAsyncScope(() => {
              taskShouldReject.reject(err);
            });
            taskShouldReject.asyncResource.emitDestroy();
          } else {
            taskShouldReject.reject(err);
          }
        }
        this.taskQueue.push(task);
      }
    });
  }
  startSessionMonitor() {
    // 监控配置
    const monitorConfig = {
      checkInterval: 30000,     // 检查间隔（毫秒）
      zombieThreshold: 60000,   // 僵尸会话阈值（毫秒）
      enableDetailedLogs: true, // 启用详细日志
      enableStats: true          // 启用统计信息
    };
    
    // 初始化统计信息
    this.sessionStats = {
      totalConnections: 0,
      activeSessions: 0,
      zombieSessions: 0,
      cleanedSessions: 0,
      lastCleanupTime: new Date().toISOString()
    };
    
    // 每30秒检查一次会话状态
    this.sessionMonitor = setInterval(() => {
      const stats = {
        total: this.connections.length,
        active: 0,
        zombie: 0,
        cleaned: 0
      };
      
      this.connections.forEach(conn => {
        // 更新统计信息
        if (conn.sessionId && conn.isReady) {
          stats.active++;
        }
        
        // 增强的僵尸会话识别逻辑
        const isZombie = this.identifyZombieSession(conn);
        if (isZombie) {
          stats.zombie++;
          
          if (monitorConfig.enableDetailedLogs) {
            console.warn(`[SessionMonitor] 发现僵尸会话 ${conn.sessionId} (连接: ${conn.connectionId})`);
            console.log(`[SessionMonitor] 会话状态: sessionId=${conn.sessionId}, isReady=${conn.isReady}`);
            console.log(`[SessionMonitor] 僵尸标记: isZombieSession=${conn.isZombieSession}`);
            console.log(`[SessionMonitor] 最后活跃: ${new Date(conn.lastActivityTime).toLocaleString()}`);
          }
          
          // 执行分层清理策略
          const cleanupLevel = this.determineCleanupLevel(conn);
          this.performCleanup(conn, cleanupLevel).then(result => {
            if (result.success) {
              stats.cleaned++;
              if (monitorConfig.enableDetailedLogs) {
                console.log(`[SessionMonitor] 清理完成: ${conn.sessionId} (级别: ${cleanupLevel})`);
              }
            } else {
              if (monitorConfig.enableDetailedLogs) {
                console.error(`[SessionMonitor] 清理失败: ${conn.sessionId}, 原因: ${result.error}`);
              }
            }
          });
        }
      });
      
      // 更新统计信息
      if (monitorConfig.enableStats) {
        this.sessionStats = {
          totalConnections: stats.total,
          activeSessions: stats.active,
          zombieSessions: stats.zombie,
          cleanedSessions: this.sessionStats.cleanedSessions + stats.cleaned,
          lastCleanupTime: new Date().toISOString()
        };
        
        if (monitorConfig.enableDetailedLogs && stats.zombie > 0) {
          console.log(`[SessionMonitor] 统计信息 - 总计: ${stats.total}, 活跃: ${stats.active}, 僵尸: ${stats.zombie}, 已清理: ${stats.cleaned}`);
        }
      }
      
    }, monitorConfig.checkInterval);
  }
  
  // 僵尸会话识别方法
  identifyZombieSession(conn) {
    // 基础检查：有sessionId但连接未就绪
    if (!conn.sessionId || conn.isReady) {
      return false;
    }
    
    // 增强检查：使用Connection的僵尸会话检测方法
    if (conn.checkZombieSession && conn.checkZombieSession()) {
      return true;
    }
    
    // 时间阈值检查：最后活动时间超过阈值
    const zombieThreshold = 60000; // 60秒
    const timeSinceLastActivity = Date.now() - conn.lastActivityTime;
    if (timeSinceLastActivity > zombieThreshold) {
      // 标记为僵尸会话
      if (conn.markAsZombie) {
        conn.markAsZombie();
      }
      return true;
    }
    
    return false;
  }
  
  // 确定清理级别
  determineCleanupLevel(conn) {
    const timeSinceLastActivity = Date.now() - conn.lastActivityTime;
    const zombieThreshold = 60000; // 60秒
    const deepCleanupThreshold = 120000; // 120秒
    
    if (timeSinceLastActivity > deepCleanupThreshold) {
      return 'DEEP'; // 深度清理：重建连接
    } else if (timeSinceLastActivity > zombieThreshold * 1.5) {
      return 'MEDIUM'; // 中度清理：强制清理
    } else {
      return 'LIGHT'; // 轻度清理：常规清理
    }
  }
  
  // 执行分层清理
  async performCleanup(conn, level) {
    try {
      switch (level) {
        case 'LIGHT':
          // 轻度清理：重置状态
          conn.isReady = false;
          conn.isBusy = true;
          if (conn.updateActivityTime) {
            conn.updateActivityTime();
          }
          return { success: true, level: 'LIGHT' };
          
        case 'MEDIUM':
          // 中度清理：调用forceCleanup
          await conn.forceCleanup();
          return { success: true, level: 'MEDIUM' };
          
        case 'DEEP':
          // 深度清理：完全重建连接
          await conn.forceCleanup();
          // 尝试重新准备连接
          setTimeout(() => {
            conn.prepare();
          }, 1000);
          return { success: true, level: 'DEEP' };
          
        default:
          return { success: false, error: '未知的清理级别' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  stopSessionMonitor() {
    if (this.sessionMonitor) {
      clearInterval(this.sessionMonitor);
      this.sessionMonitor = null;
    }
  }
  
  close() {
    // 停止会话监控
    this.stopSessionMonitor();
    
    _lodash.default.forEach(this.connectionGuarders, timer => {
      clearInterval(timer);
    });
    return Promise.all([..._lodash.default.map(this.connections, o => o.close())]);
  }
}
exports.default = Client;
module.exports = exports.default;
//# sourceMappingURL=Client.js.map