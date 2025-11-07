# 基于查询规则目录的语言分类

## 分类原则

根据 `src/service/parser/constants/queries` 目录的实际结构：
- **有独立子目录** = 高级规则语言（复杂查询）
- **仅有单个 .ts 文件** = 基本规则语言（简单查询）
- **特殊处理** = 完全独立解析方式（跳过 AST）

## 实际目录结构分析

### 高级规则语言（有独立子目录）

```
src/service/parser/constants/queries/
├── c/                    # 高级规则
├── cpp/                  # 高级规则  
├── csharp/               # 高级规则
├── css/                  # 高级规则
├── go/                   # 高级规则
├── html/                 # 高级规则
├── java/                 # 高级规则
├── javascript/           # 高级规则
├── kotlin/               # 高级规则
├── python/               # 高级规则
├── rust/                 # 高级规则
├── tsx/                  # 高级规则
├── typescript/           # 高级规则
└── vue/                  # 高级规则
```

### 基本规则语言（仅有 .ts 文件）

```
src/service/parser/constants/queries/
├── elisp.ts              # 基本规则
├── elixir.ts             # 基本规则
├── embedded_template.ts  # 基本规则
├── lua.ts                # 基本规则
├── ocaml.ts              # 基本规则
├── php.ts                # 基本规则
├── ruby.ts               # 基本规则
├── scala.ts              # 基本规则
├── solidity.ts           # 基本规则
├── swift.ts              # 基本规则
├── systemrdl.ts          # 基本规则
├── tlaplus.ts            # 基本规则
├── yaml.ts               # 基本规则
├── zig.ts                # 基本规则
├── json.ts               # 基本规则
└── toml.ts               # 基本规则
```

### 特殊处理语言（完全独立解析）

基于 `src/service/parser/processing` 目录分析：

```
特殊处理语言：
├── markdown/             # 使用 MarkdownTextStrategy
├── xml/                  # 使用 XMLTextStrategy  
├── html/                 # 同时有高级规则和专用处理
└── css/                  # 同时有高级规则和专用处理
```

## 准确语言分类

### 1. 高级编程语言（复杂 AST 查询）

**特征**：有独立子目录，包含多种查询类型
- `typescript` - 12种查询类型（classes, functions, exports, imports, interfaces, methods, properties, types, variables, control-flow, data-flow, expressions）
- `javascript` - 类似 typescript 的复杂查询
- `python` - 多种查询类型（functions, classes, imports, variables, types, data-flow, control-flow, etc.）
- `java` - 面向对象复杂查询
- `cpp` - C++ 特有查询（classes, functions, namespaces, modern-features, etc.）
- `go` - Go 语言特有查询（functions, concurrency, data-flow, etc.）
- `rust` - Rust 特有查询（functions, modules, types, macros, etc.）
- `csharp` - C# 特有查询（classes, methods, properties, patterns, etc.）
- `kotlin` - Kotlin 特有查询
- `tsx` - React TSX 特有查询（components, jsx, types-hooks）
- `vue` - Vue 特有查询（components, template-directives）
- `html` - 标记语言查询（elements, attributes）
- `css` - 样式查询（rules, properties, selectors）
- `c` - C 语言查询（functions, control-flow, data-flow, etc.）

### 2. 基本编程语言（简单 AST 查询）

**特征**：仅有单个 .ts 文件，查询规则相对简单
- `php` - 基础查询
- `ruby` - 基础查询  
- `scala` - 基础查询
- `swift` - 基础查询
- `solidity` - 智能合约语言
- `elixir` - 函数式语言
- `ocaml` - 函数式语言
- `lua` - 脚本语言
- `zig` - 系统编程语言
- `elisp` - Lisp 方言
- `systemrdl` - 寄存器描述语言
- `tlaplus` - 规范语言
- `embedded_template` - 嵌入式模板

### 3. 数据格式语言（结构化查询）

**特征**：数据序列化格式，查询规则简单
- `json` - 键值对查询
- `yaml` - 结构化数据查询
- `toml` - 配置文件查询

### 4. 特殊处理语言（跳过 AST）

**特征**：使用专用处理器，不依赖 AST 查询
- `markdown` - 使用 `MarkdownTextStrategy` 和 `MarkdownSegmentationStrategy`
- `xml` - 使用 `XMLTextStrategy` 和 `XMLSegmentationStrategy`

### 5. 混合处理语言

**特征**：既有 AST 查询又有专用处理
- `html` - 有高级查询规则，也有专用 XML 处理
- `css` - 有高级查询规则，也有专用处理

## 处理策略映射

### 高级编程语言
```typescript
const ADVANCED_PROGRAMMING_LANGUAGES = [
  'typescript', 'javascript', 'python', 'java', 'cpp', 'c',
  'go', 'rust', 'csharp', 'kotlin', 'tsx', 'vue'
];

// 处理策略：完整 AST + 复杂查询
const strategy = {
  primary: 'treesitter_ast',
  fallback: ['structure_aware', 'function'],
  useFullAST: true,
  supportedQueryTypes: ['functions', 'classes', 'methods', 'imports', 'exports', 'variables', 'types', 'interfaces'],
  maxQueryDepth: 10
};
```

### 基本编程语言
```typescript
const BASIC_PROGRAMMING_LANGUAGES = [
  'php', 'ruby', 'scala', 'swift', 'solidity', 'elixir', 
  'ocaml', 'lua', 'zig', 'elisp', 'systemrdl', 'tlaplus', 'embedded_template'
];

// 处理策略：简化 AST + 基础查询
const strategy = {
  primary: 'treesitter_ast',
  fallback: ['universal_line'],
  useSimplifiedAST: true,
  supportedQueryTypes: ['functions', 'classes'],
  maxQueryDepth: 3
};
```

### 数据格式语言
```typescript
const DATA_FORMAT_LANGUAGES = ['json', 'yaml', 'toml'];

// 处理策略：结构化解析
const strategy = {
  primary: 'universal_bracket',
  fallback: ['universal_line'],
  skipComplexQueries: true,
  maxQueryDepth: 2
};
```

### 特殊处理语言
```typescript
const SPECIAL_PROCESSING_LANGUAGES = ['markdown', 'xml'];

// 处理策略：专用处理器
const strategy = {
  primary: 'specialized_processor',
  skipASTParsing: true,
 专用处理器: {
    'markdown': 'MarkdownTextStrategy',
    'xml': 'XMLTextStrategy'
  }
};
```

### 混合处理语言
```typescript
const HYBRID_LANGUAGES = ['html', 'css'];

// 处理策略：优先专用处理，回退到 AST
const strategy = {
  primary: 'specialized_processor',
  fallback: ['treesitter_ast'],
  专用处理器: {
    'html': 'XMLTextStrategy',
    'css': 'CSSTextStrategy'
  }
};
```

## 重构建议

基于这个准确的分类，建议的配置文件结构：

```
src/service/parser/config/
├── LanguageCore.ts                    # 核心定义
├── AdvancedProgrammingConfig.ts       # 高级编程语言
├── BasicProgrammingConfig.ts          # 基本编程语言  
├── DataFormatConfig.ts                # 数据格式语言
├── SpecialProcessingConfig.ts         # 特殊处理语言
├── HybridProcessingConfig.ts          # 混合处理语言
└── LanguageMappingManager.ts          # 统一管理
```

这种分类方式完全基于实际的目录结构和查询规则复杂度，避免了主观猜测，确保分类的准确性和实用性。