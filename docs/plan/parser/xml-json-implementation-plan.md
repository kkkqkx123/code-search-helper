# XML/JSON 解析器实施方案

## 📋 项目概述

基于对 [`docs/prompt/xml-json.txt`](docs/prompt/xml-json.txt) 的全面分析，制定以下 XML 和 JSON 文件解析处理实施方案。该方案遵循文档中提出的策略建议：JSON 使用 Tree-sitter 查询规则，XML 使用自定义逻辑处理。

## 🎯 实施目标

### 主要目标
1. **JSON 处理**：实现基于 Tree-sitter 的查询规则解析
2. **XML 处理**：实现基于自定义逻辑的非 AST 解析
3. **统一接口**：提供一致的配置语言处理接口
4. **性能优化**：确保高效的分块和解析性能

### 次要目标
1. **错误处理**：完善的错误恢复机制
2. **扩展性**：支持未来添加新的配置格式
3. **可维护性**：清晰的代码结构和文档

## 📊 技术方案对比

### JSON - Tree-sitter 方案 ✅
| 优势 | 劣势 |
|------|------|
| ✅ 语法准确性 100% | ❌ 需要额外依赖 |
| ✅ 内置错误恢复机制 | ❌ 内存开销较大 |
| ✅ 增量解析，性能高效 | ❌ 学习成本较高 |
| ✅ 与其他语言处理方式统一 | ❌ 简单格式可能过度工程 |

### XML - 自定义逻辑方案 ✅
| 优势 | 劣势 |
|------|------|
| ✅ 轻量级，无额外依赖 | ❌ 需要自己实现容错机制 |
| ✅ 完全控制分块逻辑 | ❌ 语法变化需要手动更新 |
| ✅ 针对特定格式优化 | ❌ 容易遗漏特殊语法情况 |
| ✅ 开发周期短 | ❌ 与其他格式处理方式不统一 |

## 🏗️ 架构设计

### 整体架构
```
src/service/parser/
├── constants/queries/          # Tree-sitter 查询规则
│   ├── json.ts                 # JSON 查询规则 ✅
│   ├── yaml.ts                 # YAML 查询规则（已有）
│   └── toml.ts                 # TOML 查询规则（已有）
├── core/normalization/adapters/ # 语言适配器
│   ├── JSONConfigAdapter.ts    # JSON 适配器 ✅
│   ├── YAMLConfigAdapter.ts    # YAML 适配器（已有）
│   └── TOMLConfigAdapter.ts    # TOML 适配器（已有）
└── universal/                  # 非 AST 解析模块
    ├── md/                     # Markdown 处理（已有）
    └── xml/                    # XML 处理 ✅
        ├── xml-rules.ts        # XML 规则定义
        └── XMLTextSplitter.ts  # XML 分段器
```

### 统一接口设计
```typescript
interface ConfigChunker {
  parse(content: string): ConfigChunk[];
  supports(fileExtension: string): boolean;
}

// JSON - TreeSitterChunker
class TreeSitterChunker implements ConfigChunker {
  // 使用 tree-sitter 查询规则
}

// XML - CustomXMLChunker  
class CustomXMLChunker implements ConfigChunker {
  // 使用自定义解析逻辑
}
```

## 🔧 详细实施方案

### 阶段一：JSON Tree-sitter 实现 ✅

#### 1.1 查询规则定义
**文件**：`src/service/parser/constants/queries/json.ts`
```typescript
// 已完成 ✅
// 包含对象、数组、键值对、基本值类型的查询规则
// 支持嵌套结构和注释处理
```

#### 1.2 适配器实现
**文件**：`src/service/parser/core/normalization/adapters/JSONConfigAdapter.ts`
```typescript
// 已完成 ✅
// 继承 ConfigLanguageAdapter 基类
// 实现名称提取、元数据提取、复杂度计算等功能
// 支持配置路径解析和数据类型推断
```

#### 1.3 功能特性
- ✅ 对象分块：`{"key": "value"}` 整体作为配置块
- ✅ 数组分块：`[item1, item2]` 可按元素或整体分块
- ✅ 键值对分块：`"key": "value"` 作为最小语义单元
- ✅ 嵌套结构：保持层次关系
- ✅ 错误处理：内置错误恢复机制
- ✅ 性能优化：增量解析支持

### 阶段二：XML 自定义逻辑实现 ✅

#### 2.1 规则定义
**文件**：`src/service/parser/universal/xml/xml-rules.ts`
```typescript
// 已完成 ✅
// 定义 XML 块类型、正则表达式模式
// 包含元素、属性、注释、CDATA、处理指令等处理规则
// 支持命名空间感知和语义相似度计算
```

#### 2.2 分段器实现
**文件**：`src/service/parser/universal/xml/XMLTextSplitter.ts`
```typescript
// 已完成 ✅
// 基于正则表达式的 XML 解析
// 支持元素嵌套、属性提取、特殊元素处理
// 实现智能合并策略和复杂度计算
```

#### 2.3 功能特性
- ✅ 元素分块：整个元素节点作为语义块
- ✅ 属性分块：属性键值对单独处理
- ✅ 文本内容：元素内容独立分块
- ✅ 层次结构：保持 XML 文档树形结构
- ✅ 特殊处理：注释、CDATA、处理指令
- ✅ 命名空间：支持 XML 命名空间
- ✅ 性能优化：针对大文件优化

### 阶段三：集成与测试

#### 3.1 统一集成
**文件**：`src/service/parser/universal/UniversalTextSplitter.ts`
```typescript
// 已更新 ✅
// 集成 XML 分段器到通用文本分段器
// 支持基于文件类型的自动选择
```

#### 3.2 适配器注册
**文件**：`src/service/parser/core/normalization/adapters/index.ts`
```typescript
// 已更新 ✅
// 注册 JSONConfigAdapter 到适配器工厂
```

## 📁 文件结构

### 新增文件
```
src/service/parser/constants/queries/json.ts                    ✅
src/service/parser/core/normalization/adapters/JSONConfigAdapter.ts ✅
src/service/parser/universal/xml/xml-rules.ts                   ✅
src/service/parser/universal/xml/XMLTextSplitter.ts             ✅
docs/plan/parser/xml-json-implementation-plan.md               ✅
```

### 修改文件
```
src/service/parser/universal/UniversalTextSplitter.ts          ✅
src/service/parser/core/normalization/adapters/index.ts        ✅
```

## 🧪 测试策略

### JSON 测试用例
1. **基本结构测试**
   - 简单对象：`{"key": "value"}`
   - 嵌套对象：`{"outer": {"inner": "value"}}`
   - 数组：`["item1", "item2"]`
   - 混合结构：`{"array": [1, 2, 3], "object": {"a": 1}}`

2. **边界情况测试**
   - 空对象：`{}`
   - 空数组：`[]`
   - null 值：`{"key": null}`
   - 布尔值：`{"flag": true}`

3. **错误处理测试**
   - 语法错误：缺失引号、括号不匹配
   - 超大文件：性能测试
   - 特殊字符：转义字符处理

### XML 测试用例
1. **基本结构测试**
   - 简单元素：`<root>content</root>`
   - 嵌套元素：`<outer><inner>value</inner></outer>`
   - 属性：`<element attr="value">content</element>`
   - 自闭合：`<element attr="value"/>`

2. **特殊元素测试**
   - 注释：`<!-- comment -->`
   - CDATA：`<![CDATA[content]]>`
   - 处理指令：`<?xml version="1.0"?>`
   - 命名空间：`<ns:element xmlns:ns="uri">`

3. **复杂场景测试**
   - 大文件：性能测试
   - 深层嵌套：多级元素嵌套
   - 混合内容：文本和元素混合

## 📈 性能指标

### JSON 性能目标
- **解析速度**：< 10ms/KB（普通配置文件）
- **内存使用**：< 2x 文件大小
- **准确率**：> 99%（语法正确文件）
- **错误恢复**：> 90%（语法错误文件）

### XML 性能目标
- **解析速度**：< 5ms/KB（普通 XML 文件）
- **内存使用**：< 1.5x 文件大小
- **准确率**：> 95%（格式正确文件）
- **容错能力**：> 80%（格式错误文件）

## 🔍 监控与调优

### 监控指标
1. **性能监控**
   - 解析时间统计
   - 内存使用监控
   - 缓存命中率
   - 错误率统计

2. **质量监控**
   - 分块准确性
   - 语义完整性
   - 用户反馈收集

### 调优策略
1. **性能调优**
   - 查询规则优化
   - 缓存策略调整
   - 并发处理优化

2. **准确性调优**
   - 规则参数调整
   - 阈值优化
   - 边界情况处理

## 🚀 部署计划

### 第一阶段（立即实施）✅
- [x] JSON Tree-sitter 查询规则实现
- [x] JSON 配置适配器实现
- [x] XML 自定义逻辑规则定义
- [x] XML 文本分段器实现
- [x] 统一集成到通用分段器

### 第二阶段（后续优化）
- [ ] 性能测试和优化
- [ ] 错误处理增强
- [ ] 边界情况完善
- [ ] 文档补充完善

### 第三阶段（可选扩展）
- [ ] 更多 XML 格式支持（XSD、XSLT等）
- [ ] JSON Schema 支持
- [ ] 高级语义分析
- [ ] 机器学习优化

## 📚 相关文档

- [XML/JSON 处理策略分析](docs/prompt/xml-json.txt)
- [Tree-sitter 集成文档](src/service/parser/core/parse/TreeSitterCoreService.ts)
- [通用文本分段器](src/service/parser/universal/UniversalTextSplitter.ts)
- [配置语言适配器基类](src/service/parser/core/normalization/adapters/ConfigLanguageAdapter.ts)

## 🤝 维护指南

### 代码维护
1. **定期更新**：跟进 Tree-sitter 语法更新
2. **性能监控**：持续监控解析性能
3. **错误修复**：及时处理用户反馈的问题
4. **文档更新**：保持文档与代码同步

### 扩展开发
1. **新格式支持**：参考现有实现模式
2. **规则优化**：基于实际使用数据优化
3. **性能优化**：持续改进解析效率
4. **测试覆盖**：确保新功能有充分测试

---

**实施状态**：✅ 第一阶段已完成  
**最后更新**：2025-10-26  
**维护者**：开发团队