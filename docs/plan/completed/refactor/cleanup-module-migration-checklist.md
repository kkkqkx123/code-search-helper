# Cleanup模块迁移检查清单

## ✅ 迁移前准备

### 1. 环境准备
- [ ] 确保所有现有测试通过
- [ ] 备份当前代码状态
- [ ] 确认开发环境正常

### 2. 目录结构创建
- [ ] 创建 `src/infrastructure/cleanup/` 目录
- [ ] 创建 `src/infrastructure/cleanup/strategies/` 子目录
- [ ] 创建 `src/infrastructure/cleanup/__tests__/` 子目录

## 🔄 文件迁移步骤

### 3. 迁移核心文件
- [ ] 移动 `src/service/parser/universal/cleanup/CleanupManager.ts` → `src/infrastructure/cleanup/CleanupManager.ts`
- [ ] 移动 `src/service/parser/universal/cleanup/ICleanupStrategy.ts` → `src/infrastructure/cleanup/interfaces/ICleanupStrategy.ts`
- [ ] 移动 `src/service/parser/universal/cleanup/strategies/LRUCacheCleanupStrategy.ts` → `src/infrastructure/cleanup/strategies/LRUCacheCleanupStrategy.ts`
- [ ] 移动 `src/service/parser/universal/cleanup/strategies/TreeSitterCacheCleanupStrategy.ts` → `src/infrastructure/cleanup/strategies/TreeSitterCacheCleanupStrategy.ts`
- [ ] 移动 `src/service/parser/universal/cleanup/strategies/GarbageCollectionStrategy.ts` → `src/infrastructure/cleanup/strategies/GarbageCollectionStrategy.ts`
- [ ] 移动 `src/service/parser/universal/cleanup/__tests__/CleanupManager.test.ts` → `src/infrastructure/cleanup/__tests__/CleanupManager.test.ts`

### 4. 创建索引文件
- [ ] 创建 `src/infrastructure/cleanup/index.ts` 导出文件

## 🔧 代码更新步骤

### 5. 更新导入路径

#### MemoryGuard.ts
- [ ] 更新 CleanupManager 导入路径
- [ ] 验证导入正确性

#### ErrorThresholdManager.ts
- [ ] 更新 CleanupManager 导入路径
- [ ] 更新 ICleanupContext 导入路径
- [ ] 验证导入正确性

#### BusinessServiceRegistrar.ts
- [ ] 更新所有清理策略的导入路径
- [ ] 验证依赖注入配置

#### 测试文件
- [ ] 更新所有测试文件中的导入路径

### 6. 更新类型定义
- [ ] 检查 `src/types.ts` 是否需要更新
- [ ] 确保所有导出类型正确

## 🧪 验证步骤

### 7. 单元测试验证
- [ ] 运行清理模块单元测试
  ```bash
  npm test src/infrastructure/cleanup/__tests__/CleanupManager.test.ts
  ```

### 8. 集成测试验证
- [ ] 验证 MemoryGuard 功能正常
- [ ] 验证 ErrorThresholdManager 功能正常
- [ ] 验证 BusinessServiceRegistrar 依赖注入正常

### 9. 端到端测试
- [ ] 运行完整测试套件
  ```bash
  npm test
  ```

### 10. 构建验证
- [ ] 验证代码构建正常
  ```bash
  npm run build
  ```

## 📋 最终检查

### 11. 代码质量检查
- [ ] 无编译错误
- [ ] 无类型错误
- [ ] 所有测试通过
- [ ] 代码格式正确

### 12. 文档更新
- [ ] 更新相关文档中的路径引用
- [ ] 更新架构文档

## 🔄 回滚检查点

如果在任何步骤遇到问题，立即回滚：
- [ ] 恢复原文件位置
- [ ] 恢复原导入路径
- [ ] 验证系统功能正常

---

**检查清单版本**: 1.0  
**创建日期**: 2025-10-17  
**最后更新**: 2025-10-17