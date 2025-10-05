# NebulaQueryUtils 实现方案

## 📋 概述

本文档详细描述了 `NebulaQueryUtils` 工具类的设计和实现方案，用于集中处理 Nebula Graph 查询的参数插值、转义和格式化逻辑。

## 🎯 设计目标

### 核心功能
1. **参数插值**: 将命名参数替换为实际的查询值
2. **SQL 注入防护**: 自动转义特殊字符，防止 nGQL 注入攻击
3. **查询格式化**: 提供统一的查询结果格式化方法
4. **工具函数**: 提供通用的查询处理辅助函数

### 架构原则
- **单一职责**: 只负责查询字符串处理，不涉及连接管理
- **无状态**: 所有方法都是静态的，不保存任何状态
- **可测试**: 提供完整的单元测试覆盖
- **类型安全**: 使用 TypeScript 确保类型安全

## 📊 接口设计

### INebulaQueryUtils 接口

```typescript
interface INebulaQueryUtils {
  // 参数处理
  interpolateParameters(nGQL: string, parameters: Record<string, any>): string;
  escapeValue(value: any): string;
  escapeProperties(properties: Record<string, any>): Record<string, any>;
  
  // 查询验证
  validateQuery(nGQL: string): boolean;
  detectQueryType(nGQL: string): QueryType;
  
  // 结果处理
  formatResult(rawResult: any, executionTime?: number): NebulaQueryResult;
  normalizeResultData(data: any[]): any[];
  
  // 工具函数
  extractSpaceFromUseQuery(nGQL: string): string | null;
  isUseQuery(nGQL: string): boolean;
}

enum QueryType {
  DDL = 'DDL',       // CREATE, DROP, ALTER
  DML = 'DML',       // INSERT, UPDATE, DELETE
  QUERY = 'QUERY',   // MATCH, FETCH, GO
  ADMIN = 'ADMIN',   // SHOW, DESCRIBE
  OTHER = 'OTHER'
}
```

## 🔧 实现细节

### 1. 参数插值实现

```typescript
static interpolateParameters(nGQL: string, parameters: Record<string, any>): string {
  let interpolatedQuery = nGQL;
  
  for (const [key, value] of Object.entries(parameters)) {
    const placeholder = `:${key}`;
    const escapedValue = NebulaQueryUtils.escapeValue(value);
    
    interpolatedQuery = interpolatedQuery.replace(
      new RegExp(placeholder, 'g'), 
      escapedValue
    );
  }
  
  return interpolatedQuery;
}
```

### 2. 值转义实现

```typescript
static escapeValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (typeof value === 'string') {
    // 转义引号和反斜杠
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'");
    
    return `"${escaped}"`;
  }
  
  if (Array.isArray(value)) {
    return `[${value.map(v => NebulaQueryUtils.escapeValue(v)).join(', ')}]`;
  }
  
  if (typeof value === 'object') {
    return JSON.stringify(NebulaQueryUtils.escapeProperties(value));
  }
  
  return String(value);
}
```

### 3. 属性转义实现

```typescript
static escapeProperties(properties: Record<string, any>): Record<string, any> {
  const escaped: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(properties)) {
    escaped[key] = NebulaQueryUtils.escapeValue(value);
  }
  
  return escaped;
}
```

### 4. 查询验证实现

```typescript
static validateQuery(nGQL: string): boolean {
  if (!nGQL || typeof nGQL !== 'string' || nGQL.trim() === '') {
    return false;
  }
  
  // 检查是否包含潜在的危险操作
  const dangerousPatterns = [
    /DROP\s+SPACE/i,
    /DELETE\s+FROM/i,
    /TRUNCATE/i,
    /SYSTEM/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(nGQL));
}
```

## 🚀 集成计划

### 阶段一：基础工具类创建（2天）
1. 创建 `NebulaQueryUtils` 类文件
2. 实现核心参数处理功能
3. 编写单元测试

### 阶段二：重构现有代码（3天）
1. 修改 `NebulaConnectionManager` 使用工具类
2. 更新 `NebulaSpaceService` 使用工具类
3. 确保向后兼容性

### 阶段三：测试验证（2天）
1. 单元测试覆盖
2. 集成测试验证
3. 性能基准测试

## 📈 优势

### 代码质量提升
- **减少重复代码**: 参数处理逻辑集中在一处
- **提高可维护性**: 修改参数处理逻辑只需修改一个文件
- **增强安全性**: 统一的 SQL 注入防护

### 性能优化
- **缓存优化**: 可以添加查询模板缓存
- **预处理**: 批量查询时可以预处理参数

### 扩展性
- **插件系统**: 支持自定义转义规则
- **多方言支持**: 支持不同的 nGQL 方言

## 🧪 测试策略

### 单元测试覆盖
```typescript
describe('NebulaQueryUtils', () => {
  test('should interpolate parameters correctly', () => {
    const result = NebulaQueryUtils.interpolateParameters(
      'CREATE TAG :tagName', 
      { tagName: 'user' }
    );
    expect(result).toBe('CREATE TAG "user"');
  });
  
  test('should escape special characters', () => {
    const result = NebulaQueryUtils.escapeValue('test"value');
    expect(result).toBe('"test\\"value"');
  });
});
```

### 集成测试
- 与现有服务的集成测试
- 性能基准测试
- 安全漏洞扫描

## 📋 实施时间表

| 阶段 | 时间 | 负责人 | 状态 |
|------|------|--------|------|
| 需求分析和设计 | 1天 | 架构师 | 📅 计划 |
| 工具类实现 | 2天 | 开发团队 | 📅 计划 |
| 重构现有代码 | 3天 | 开发团队 | 📅 计划 |
| 测试验证 | 2天 | QA团队 | 📅 计划 |

## ✅ 验收标准

1. **功能完整性**: 所有参数处理功能正常工作
2. **性能达标**: 参数处理时间减少 50%
3. **安全性**: 通过 SQL 注入测试
4. **测试覆盖**: 单元测试覆盖率 95% 以上
5. **向后兼容**: 现有代码无需修改即可工作

## 🎯 总结

`NebulaQueryUtils` 工具类将显著提高代码的可维护性和安全性，为未来的功能扩展奠定坚实基础。建议立即开始第一阶段的设计和实现工作。