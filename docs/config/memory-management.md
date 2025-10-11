当前项目中的内存使用统计实现机制主要通过 `MemoryMonitorService` 和 `MemoryGuard` 两个核心组件协同工作，基于 Node.js 的 `process.memoryUsage()` 方法获取内存数据，并通过定时任务进行持续监控和统计分析。

### 核心实现方法

#### 1. 内存数据获取
内存使用数据通过 Node.js 内置的 [`process.memoryUsage()`](https://nodejs.org/api/process.html#process_memoryusage) 方法获取，该方法返回一个包含以下关键指标的对象：

- `heapUsed`: V8 引擎堆内存已使用量（字节）
- `heapTotal`: V8 引擎堆内存总量（字节）
- `rss`: 常驻内存集（Resident Set Size，字节）
- `external`: 外部内存使用量（字节）
- `arrayBuffers`: ArrayBuffer 内存使用量（字节）

```typescript
const memoryUsage = process.memoryUsage();
```

#### 2. 主要监控服务：MemoryMonitorService

`MemoryMonitorService` 是系统的主要内存监控服务，其核心实现包括：

- **定时监控**：通过 `setInterval` 定期调用 `internalCheckMemoryUsage()` 方法，检查频率由配置决定（默认30秒）。
- **内存状态计算**：实时计算堆内存使用百分比 `heapUsedPercent = heapUsed / heapTotal`。
- **阈值管理**：设置三级阈值（警告、严重、紧急），当内存使用超过阈值时触发相应级别的清理操作。
- **历史记录**：维护一个有限大小的内存使用历史记录数组，用于趋势分析和峰值计算。

```typescript
private internalCheckMemoryUsage(): void {
  const memoryUsage = process.memoryUsage();
  const heapUsedPercent = memoryUsage.heapUsed / memoryUsage.heapTotal;
  
  // 记录历史数据
  this.recordMemoryUsage(memoryUsage);
  
  // 根据阈值执行相应措施
  if (heapUsedPercent >= this.emergencyThreshold) {
    this.handleEmergencyMemory(memoryUsage, heapUsedPercent);
  } else if (heapUsedPercent >= this.criticalThreshold) {
    this.handleCriticalMemory(memoryUsage, heapUsedPercent);
  } else if (heapUsedPercent >= this.warningThreshold) {
    this.handleWarningMemory(memoryUsage, heapUsedPercent);
  }
}
```

#### 3. 统计功能实现

`MemoryMonitorService` 提供了丰富的统计功能，通过以下方法实现：

| 统计指标 | 实现方法 |
|---------|---------|
| 当前内存使用 | [`getMemoryUsage()`](src/service/memory/MemoryMonitorService.ts:346) 直接返回 `process.memoryUsage()` 结果 |
| 内存趋势 | [`calculateMemoryTrend()`](src/service/memory/MemoryMonitorService.ts:672) 分析最近5次历史记录的变化趋势 |
| 平均内存使用 | [`calculateAverageUsage()`](src/service/memory/MemoryMonitorService.ts:695) 计算历史记录中 heapUsed 的平均值 |
| 峰值内存使用 | [`calculatePeakMemory()`](src/service/memory/MemoryMonitorService.ts:707) 遍历历史记录找出最大 heapUsed 值 |

#### 4. 协同组件：MemoryGuard

`MemoryGuard` 作为内存保护机制，与 `MemoryMonitorService` 协同工作：

- **依赖注入**：通过依赖注入获取 `MemoryMonitorService` 实例
- **统一监控**：使用 `memoryMonitor.getMemoryStatus()` 获取统一的内存状态
- **特定场景保护**：在文件解析等特定场景下进行内存限制检查和优雅降级处理

```mermaid
graph TD
    A[Node.js Runtime] -->|process.memoryUsage()| B(MemoryMonitorService)
    B --> C[定时监控]
    B --> D[阈值检查]
    B --> E[历史记录存储]
    B --> F[趋势分析]
    B --> G[峰值计算]
    B --> H[平均值计算]
    I[MemoryGuard] -->|依赖| B
    I --> J[内存限制检查]
    I --> K[优雅降级]
    I --> L[强制清理]
    
    style A fill:#f9f,stroke:#333
    style B fill:#bbf,stroke:#333
    style I fill:#bbf,stroke:#333
```

### 配置与扩展性

系统通过 `ConfigService` 和环境变量提供灵活的配置选项：

- 可配置的检查间隔（`checkInterval`）
- 可配置的阈值（警告、严重、紧急）
- 可配置的历史记录大小（`maxHistorySize`）
- 支持运行时更新配置

这种设计使得内存监控系统既能够满足通用监控需求，又能够根据不同应用场景进行定制化调整。