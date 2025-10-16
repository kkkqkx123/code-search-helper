# Guard Services 重构实施检查清单

## 🎯 重构目标
合并 MemoryGuard 和 ProcessingGuard，创建 UnifiedGuardCoordinator，解决职能重叠问题，简化架构。

## 📋 实施前准备
- [ ] 确认开发环境正常运行
- [ ] 运行现有测试确保基线正常
- [ ] 创建功能分支 `refactor/guard-services-unification`
- [ ] 备份当前代码状态

## 🔧 阶段一：准备阶段（1-2天）

### 创建 UnifiedGuardCoordinator 类
- [ ] 创建 `src/service/parser/guard/UnifiedGuardCoordinator.ts`
- [ ] 实现单例模式设计
- [ ] 定义核心接口和数据结构
- [ ] 添加基础构造函数
- [ ] 验证编译通过：`npm run build`

### 更新类型定义
- [ ] 在 `src/types.ts` 中添加 `TYPES.UnifiedGuardCoordinator`
- [ ] 定义相关接口类型
- [ ] 验证类型检查：`npm run type-check`

## 🔄 阶段二：依赖注入配置（1天）

### 更新 BusinessServiceRegistrar
- [ ] 添加 UnifiedGuardCoordinator DI 绑定
- [ ] 配置所有必需的依赖
- [ ] 暂时保留旧的 MemoryGuard 和 ProcessingGuard 绑定
- [ ] 验证 DI 配置：`npm run test BusinessServiceRegistrar`

## ⚙️ 阶段三：核心逻辑实现（2-3天）

### 统一内存管理
- [ ] 实现 `startMonitoring()` / `stopMonitoring()`
- [ ] 实现 `checkMemoryUsage()` 方法
- [ ] 实现 `forceCleanup()` 方法
- [ ] 实现 `gracefulDegradation()` 方法
- [ ] 实现内存历史记录管理
- [ ] 统一事件处理机制
- [ ] 验证内存监控功能：`npm run test -- --testNamePattern="内存监控"`

### 统一处理协调
- [ ] 实现 `processFile()` 方法
- [ ] 实现 `shouldUseFallback()` 方法
- [ ] 实现 `recordError()` 方法
- [ ] 实现 `getStatus()` 方法
- [ ] 集成错误阈值管理
- [ ] 集成策略选择器
- [ ] 验证文件处理功能：`npm run test -- --testNamePattern="文件处理"`

## 🔄 阶段四：向后兼容（1-2天）

### 创建 ProcessingGuardAdapter
- [ ] 创建 `src/service/parser/guard/ProcessingGuardAdapter.ts`
- [ ] 实现 ProcessingGuard 完整接口
- [ ] 内部委托给 UnifiedGuardCoordinator
- [ ] 保持静态工厂方法兼容性
- [ ] 验证适配器功能：`npm run test ProcessingGuardAdapter`

### 更新 DI 配置使用适配器
- [ ] 更新 BusinessServiceRegistrar 使用适配器
- [ ] 验证向后兼容性
- [ ] 确保现有代码无需修改

## 🔄 阶段五：迁移使用（2-3天）

### 迁移 ChunkToVectorCoordinationService
- [ ] 修改 `src/service/parser/ChunkToVectorCoordinationService.ts`
- [ ] 将 ProcessingGuard 依赖替换为 UnifiedGuardCoordinator
- [ ] 更新相关的方法调用
- [ ] 验证功能完整性：`npm run test ChunkToVectorCoordinationService`

### 更新测试代码
- [ ] 创建 UnifiedGuardCoordinator 完整测试套件
- [ ] 更新所有相关的单元测试
- [ ] 更新集成测试
- [ ] 验证测试覆盖率：`npm run test -- --coverage`

## ✅ 阶段六：验证测试（1-2天）

### 功能验证
- [ ] 内存监控功能正常工作
- [ ] 错误阈值管理正常
- [ ] 文件处理流程完整
- [ ] 降级策略正确执行
- [ ] 清理机制正确触发
- [ ] 事件处理无遗漏
- [ ] 运行集成测试：`npm run test:integration`

### 性能验证
- [ ] 内存使用对比测试
- [ ] 处理性能对比测试
- [ ] 响应时间对比测试
- [ ] 并发处理测试
- [ ] 内存泄漏检测
- [ ] 运行性能测试：`npm run test:performance`

## 🧹 阶段七：清理优化（1-2天）

### 移除旧代码
- [ ] 确认所有使用已迁移到新类
- [ ] 移除 `src/service/parser/guard/MemoryGuard.ts`
- [ ] 移除 `src/service/parser/guard/ProcessingGuard.ts`
- [ ] 移除适配器类（如果不再需要）
- [ ] 清理相关的类型定义
- [ ] 验证编译通过：`npm run build`

### 清理 DI 配置
- [ ] 移除旧的 MemoryGuard 绑定
- [ ] 移除旧的 ProcessingGuard 绑定
- [ ] 清理不再使用的类型符号
- [ ] 验证 DI 配置：`npm run test BusinessServiceRegistrar`

## 📊 最终验证清单

### 功能验证
- [ ] 所有原有功能正常工作
- [ ] 新功能按预期工作
- [ ] 错误处理正确
- [ ] 边界条件处理正确

### 性能要求
- [ ] 处理性能不低于原有水平
- [ ] 内存使用无显著增加
- [ ] 响应时间在可接受范围
- [ ] 资源使用效率良好

### 代码质量
- [ ] 代码结构更清晰
- [ ] 重复代码消除
- [ ] 职责分离明确
- [ ] 可测试性提升

### 可维护性
- [ ] 文档更新完整
- [ ] 代码注释清晰
- [ ] 测试覆盖充分
- [ ] 易于扩展和维护

## 🚨 风险缓解措施

### 实施风险
- [ ] 功能回归风险：分阶段实施，充分测试
- [ ] 性能退化风险：性能基准测试
- [ ] 内存泄漏风险：内存监控和泄漏检测
- [ ] 依赖冲突风险：依赖分析，渐进式迁移

### 回滚策略
- [ ] 代码版本控制
- [ ] 功能开关准备
- [ ] 回滚脚本准备
- [ ] 紧急修复计划

## 🎯 完成标志

### 主要完成标志
- [ ] 所有测试用例通过
- [ ] 性能基准测试通过
- [ ] 功能回归测试通过
- [ ] 代码审查通过
- [ ] 文档更新完成

### 次要完成标志
- [ ] 代码覆盖率不低于重构前
- [ ] 无新的警告或错误
- [ ] 向后兼容性验证通过
- [ ] 部署验证通过

## 📝 备注
- 每个阶段完成后进行验证
- 发现问题立即回滚到上一阶段
- 保持与团队沟通进度和风险
- 文档化所有重大变更

这个检查清单将帮助跟踪重构过程中的每个步骤，确保所有功能都得到正确实现和验证。