# 查询映射解决方案：分离映射层设计

## 核心原则

1. **不破坏查询常量**: 查询常量保持原有格式和结构
2. **分离映射逻辑**: 在专门文件中定义查询模式到关系的映射
3. **通用模块复用**: 所有语言共享相同的映射解析逻辑
4. **集中管理**: 映射配置在专门目录中维护，每个查询常量对应一个映射文件

## 解决方案架构

### 1. 目录结构

```
src/service/parser/core/normalization/mapping/
├── c/                          # C语言映射目录
│   ├── lifecycle.ts            # 生命周期关系映射
│   ├── dependency.ts           # 依赖关系映射
│   ├── inheritance.ts          # 继承关系映射
│   ├── call.ts                 # 调用关系映射
│   ├── data-flow.ts            # 数据流关系映射
│   ├── control-flow.ts         # 控制流关系映射
│   ├── concurrency.ts          # 并发关系映射
│   ├── semantic.ts             # 语义关系映射
│   ├── creation.ts             # 创建关系映射
│   ├── reference.ts            # 引用关系映射
│   ├── annotation.ts           # 注解关系映射
│   └── index.ts                # 导出所有映射
├── cpp/                        # C++语言映射目录
├── java/                       # Java语言映射目录
├── python/                     # Python语言映射目录
├── types.ts                    # 映射类型定义
├── QueryMappingResolver.ts     # 通用映射解析器
└── index.ts                    # 导出映射解析器和类型
```

### 2. 映射类型定义

```typescript
// src/service/parser/core/normalization/mapping/types.ts

/**
 * 查询映射配置接口
 */
export interface QueryMapping {
  /** 查询模式标识符 */
  queryPattern: string;
  /** 捕获组映射配置 */
  captures: {
    /** 源节点捕获组 */
    source: string;
    /** 目标节点捕获组 */
    target: string;
    /** 可选的额外捕获组 */
    [key: string]: string;
  };
  /** 关系定义 */
  relationship: {
    /** 关系类型 */
    type: string;
    /** 关系类别 */
    category: string;
    /** 关系元数据 */
    metadata?: Record<string, any>;
  };
  /** 可选的自定义处理函数 */
  customProcessor?: string;
}

/**
 * 映射配置集合
 */
export interface MappingConfig {
  /** 映射配置数组 */
  mappings: QueryMapping[];
  /** 映射版本 */
  version: string;
  /** 映射描述 */
  description: string;
}

/**
 * 关系结果接口
 */
export interface RelationshipResult {
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 关系类型 */
  type: string;
  /** 关系类别 */
  category: string;
  /** 关系元数据 */
  metadata?: Record<string, any>;
  /** 位置信息 */
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
}

/**
 * 映射解析器选项
 */
export interface MappingResolverOptions {
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 自定义映射目录 */
  customMappingDir?: string;
}
```

### 3. 通用映射解析器

```typescript
// src/service/parser/core/normalization/mapping/QueryMappingResolver.ts

import { NodeIdGenerator } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { 
  QueryMapping, 
  MappingConfig, 
  RelationshipResult, 
  MappingResolverOptions 
} from './types';

/**
 * 通用查询映射解析器
 * 提供跨语言的统一映射解析逻辑
 */
export class QueryMappingResolver {
  private static mappingCache = new Map<string, QueryMapping[]>();
  private static options: MappingResolverOptions = {
    enableCache: true,
    debug: false
  };

  /**
   * 配置映射解析器选项
   */
  static configure(options: MappingResolverOptions): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 根据查询结果解析关系
   */
  static resolveRelationships(
    queryResults: any[],
    queryType: string,
    language: string
  ): RelationshipResult[] {
    const mappings = this.getMappings(queryType, language);
    const relationships: RelationshipResult[] = [];
    
    for (const result of queryResults) {
      for (const mapping of mappings) {
        if (this.matchesQueryPattern(result, mapping.queryPattern)) {
          const relationship = this.buildRelationship(result, mapping);
          if (relationship) {
            relationships.push(relationship);
          }
        }
      }
    }
    
    return relationships;
  }

  /**
   * 获取映射配置（带缓存）
   */
  private static getMappings(queryType: string, language: string): QueryMapping[] {
    const cacheKey = `${language}:${queryType}`;
    
    if (this.options.enableCache && this.mappingCache.has(cacheKey)) {
      return this.mappingCache.get(cacheKey)!;
    }
    
    const mappings = this.loadMappings(queryType, language);
    
    if (this.options.enableCache) {
      this.mappingCache.set(cacheKey, mappings);
    }
    
    return mappings;
  }

  /**
   * 加载映射配置
   */
  private static async loadMappings(queryType: string, language: string): Promise<QueryMapping[]> {
    try {
      const mappingModule = await import(`./${language}/${queryType}`);
      const config: MappingConfig = mappingModule.default || mappingModule[`${queryType.toUpperCase()}_MAPPINGS`];
      return config?.mappings || [];
    } catch (error) {
      if (this.options.debug) {
        console.warn(`No mappings found for ${language}.${queryType}:`, error);
      }
      return [];
    }
  }

  /**
   * 检查查询结果是否匹配模式
   */
  private static matchesQueryPattern(result: any, pattern: string): boolean {
    const captures = result.captures || [];
    const captureNames = captures.map((c: any) => c.name);
    
    // 检查是否有匹配的捕获组
    return captureNames.some(name => name.includes(pattern.replace('@', ''))) ||
           captures.some((capture: any) => 
             capture.node && capture.node.text && 
             capture.node.text.includes(pattern.replace('@', ''))
           );
  }

  /**
   * 构建关系对象
   */
  private static buildRelationship(result: any, mapping: QueryMapping): RelationshipResult | null {
    const captures = result.captures || [];
    const sourceCapture = captures.find((c: any) => c.name === mapping.captures.source);
    const targetCapture = captures.find((c: any) => c.name === mapping.captures.target);
    
    if (!sourceCapture) {
      return null;
    }

    const sourceNode = sourceCapture.node;
    const targetNode = targetCapture?.node;

    return {
      source: NodeIdGenerator.forAstNode(sourceNode),
      target: targetNode ? NodeIdGenerator.forAstNode(targetNode) : 'unknown',
      type: mapping.relationship.type,
      category: mapping.relationship.category,
      metadata: {
        ...mapping.relationship.metadata,
        // 添加额外的捕获组信息
        ...this.extractAdditionalCaptures(captures, mapping.captures)
      },
      location: {
        filePath: 'current_file',
        lineNumber: sourceNode.startPosition.row + 1,
        columnNumber: sourceNode.startPosition.column
      }
    };
  }

  /**
   * 提取额外的捕获组信息
   */
  private static extractAdditionalCaptures(
    captures: any[], 
    captureConfig: any
  ): Record<string, any> {
    const additionalInfo: Record<string, any> = {};
    
    for (const capture of captures) {
      if (capture.name !== captureConfig.source && capture.name !== captureConfig.target) {
        additionalInfo[capture.name] = capture.node?.text || capture.text;
      }
    }
    
    return additionalInfo;
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.mappingCache.clear();
  }

  /**
   * 获取缓存统计信息
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.mappingCache.size,
      keys: Array.from(this.mappingCache.keys())
    };
  }
}
```

需要提供方法，分别处理关系模式和实体模式、shared模式(同时给出2种解析结果，分别由后续后续处理)

### 4. C语言关系映射示例

```typescript
// src/service/parser/core/normalization/mapping/c/lifecycle.ts

import { MappingConfig } from '../types';

/**
 * C语言生命周期关系映射配置
 */
export const LIFECYCLE_MAPPINGS: MappingConfig = {
  description: 'C语言生命周期关系映射配置',
  mappings: [
    {
      queryPattern: '@lifecycle.relationship.memory.deallocation',
      captures: {
        source: '@deallocation.function',
        target: '@deallocated.pointer'
      },
      relationship: {
        type: 'deallocates',
        category: 'lifecycle',
        metadata: {
          phase: 'destruction',
          resourceType: 'memory'
        }
      }
    },
    ...
  ]
};

export default LIFECYCLE_MAPPINGS;
```

对于实体模式，仅提取类别，不需要source和target
对于shared模式，与关系模式一致，后续处理时分流处理

### 5. C语言映射索引文件

```typescript
// src/service/parser/core/normalization/mapping/c/index.ts

import { LIFECYCLE_MAPPINGS } from './lifecycle';
import { DEPENDENCY_MAPPINGS } from './dependency';
import { INHERITANCE_MAPPINGS } from './inheritance';

// 导出所有映射配置
export {
  LIFECYCLE_MAPPINGS,
  DEPENDENCY_MAPPINGS,
  INHERITANCE_MAPPINGS
};

// 映射配置注册表
export const C_MAPPINGS_REGISTRY = {
  lifecycle: LIFECYCLE_MAPPINGS,
  dependency: DEPENDENCY_MAPPINGS,
  inheritance: INHERITANCE_MAPPINGS
};

// 导出映射类型
export type CMappingType = keyof typeof C_MAPPINGS_REGISTRY;

// 获取指定类型的映射配置
export function getCMapping(mappingType: CMappingType) {
  return C_MAPPINGS_REGISTRY[mappingType];
}

// 获取所有可用的映射类型
export function getAvailableCMappingTypes(): CMappingType[] {
  return Object.keys(C_MAPPINGS_REGISTRY) as CMappingType[];
}

// 注释定义（由于捕获模式单一，直接在index.ts中定义）
export const C_MAPPING_COMMENTS = {
  lifecycle: 'C语言生命周期关系映射，处理内存、文件、线程等资源的生命周期管理',
  dependency: 'C语言依赖关系映射，处理头文件包含、宏定义、类型引用等依赖关系',
  inheritance: 'C语言继承关系映射，处理结构体嵌套、函数指针、类型别名等继承模拟关系'
};

export default C_MAPPINGS_REGISTRY;
```

### 6. 重构后的关系提取器

```typescript
// 修改：src/service/parser/core/normalization/adapters/c-utils/LifecycleRelationshipExtractor.ts

import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { CHelperMethods } from '.';
import { BaseRelationshipExtractor, RelationshipMetadata } from '../utils';
import { QueryMappingResolver } from '../../mapping/QueryMappingResolver';

/**
 * C语言生命周期关系提取器
 * 使用映射解析器替代硬编码逻辑
 */
export class LifecycleRelationshipExtractor extends BaseRelationshipExtractor {
  /**
   * 提取生命周期关系元数据 - 使用映射解析器
   */
  extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): RelationshipMetadata | null {
    const relationships = QueryMappingResolver.resolveRelationships(
      [result], 
      'lifecycle', 
      'c'
    );
    
    if (relationships.length > 0) {
      const rel = relationships[0];
      return {
        type: 'lifecycle',
        fromNodeId: rel.source,
        toNodeId: rel.target,
        lifecycleType: rel.type,
        lifecyclePhase: rel.metadata?.phase,
        resourceType: rel.metadata?.resourceType,
        location: rel.location
      };
    }
    
    return null;
  }

  /**
   * 提取生命周期关系数组 - 使用映射解析器
   */
  extractLifecycleRelationships(result: any): Array<any> {
    const relationships = QueryMappingResolver.resolveRelationships(
      [result], 
      'lifecycle', 
      'c'
    );
    
    return relationships.map(rel => ({
      type: 'lifecycle',
      fromNodeId: rel.source,
      toNodeId: rel.target,
      lifecycleType: rel.type,
      lifecyclePhase: rel.metadata?.phase,
      resourceType: rel.metadata?.resourceType,
      location: rel.location,
      metadata: rel.metadata
    }));
  }

  // 保留其他方法作为后备...
}
```

### 7. 映射解析器主入口

```typescript
// src/service/parser/core/normalization/mapping/index.ts

export * from './types';
export * from './QueryMappingResolver';

// 导出各语言的映射
export * from './c';
// export * from './cpp';
// export * from './java';
// export * from './python';

/**
 * 映射解析器工厂
 */
export class MappingResolverFactory {
  /**
   * 创建指定语言的映射解析器
   */
  static createResolver(language: string) {
    return {
      resolveRelationships: (queryResults: any[], queryType: string) => 
        QueryMappingResolver.resolveRelationships(queryResults, queryType, language),
      
      getAvailableMappings: () => {
        // 根据语言返回可用的映射类型
        switch (language) {
          case 'c':
            return ['lifecycle', 'dependency', 'inheritance'];
          case 'cpp':
            return ['lifecycle', 'dependency', 'inheritance', 'call', 'data-flow'];
          case 'java':
            return ['lifecycle', 'dependency', 'inheritance', 'call'];
          default:
            return [];
        }
      }
    };
  }
}

export default MappingResolverFactory;
```

## 实施计划

### 第1周：基础设施
1. 创建映射类型定义文件 (`types.ts`)
2. 实现通用映射解析器 (`QueryMappingResolver.ts`)
3. 创建C语言映射目录结构

### 第2周：C语言映射配置
1. 实现 entities 映射文件
2. 实现 relationships 映射文件
3. 实现 shared 映射文件
4. 创建C语言映射索引文件 (`index.ts`)

### 第3周：关系提取器重构
1. 重构 entities相关提取器 使用映射解析器
2. 重构 `DependencyRelationshipExtractor` 使用映射解析器
3. 重构 `InheritanceRelationshipExtractor` 使用映射解析器
4. 移除硬编码逻辑

### 第4周：扩展和优化(暂时不实现)
1. 扩展到其他语言 (C++, Java, Python)
2. 性能优化和缓存改进
3. 单元测试和集成测试
4. 文档更新

## 关键优势

1. **查询常量不变**: 完全不破坏现有查询文件
2. **映射集中管理**: 所有映射规则在专门目录中
3. **通用解析逻辑**: 所有语言共享相同的映射解析器
4. **易于扩展**: 新增关系类型只需添加映射配置
5. **类型安全**: 使用TypeScript类型系统确保配置正确性
6. **缓存优化**: 内置缓存机制提高性能

## 预期效果

- **代码减少70%**: 移除所有硬编码逻辑
- **维护性大幅提升**: 映射规则集中管理
- **一致性保证**: 所有语言使用相同解析逻辑
- **扩展性极佳**: 新增关系类型非常简单
- **调试友好**: 映射配置清晰可见，易于调试

## 使用示例

### 基本使用

```typescript
import { QueryMappingResolver } from './mapping/QueryMappingResolver';

// 配置映射解析器
QueryMappingResolver.configure({
  enableCache: true,
  debug: true
});

// 解析关系
const relationships = QueryMappingResolver.resolveRelationships(
  queryResults,
  'lifecycle',
  'c'
);

console.log('发现的关系:', relationships);
```

### 添加新的映射配置

```typescript
// 在 c/index.ts 中添加新的映射类型
import { NEW_MAPPINGS } from './new-mapping-type';

export const C_MAPPINGS_REGISTRY = {
  lifecycle: LIFECYCLE_MAPPINGS,
  dependency: DEPENDENCY_MAPPINGS,
  inheritance: INHERITANCE_MAPPINGS,
  newMappingType: NEW_MAPPINGS  // 新增映射
};
```

### 自定义映射配置

```typescript
// 创建自定义映射配置
const customMapping: QueryMapping = {
  queryPattern: '@custom.relationship.pattern',
  captures: {
    source: '@custom.source',
    target: '@custom.target'
  },
  relationship: {
    type: 'custom_relation',
    category: 'custom',
    metadata: {
      customProperty: 'custom_value'
    }
  }
};
```

这个解决方案真正实现了关注点分离，查询常量专注于查询定义，映射文件专注于关系转换，完美解决了当前问题。