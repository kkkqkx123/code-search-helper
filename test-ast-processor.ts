import { ASTProcessor } from './src/service/parser/core/normalization/mapping/ASTProcessor';
import { QueryPatternType, MappingPriority } from './src/service/parser/core/normalization/mapping/types';

// 创建AST处理器实例
const processor = new ASTProcessor();

// 模拟查询结果
const mockQueryResult = {
  captures: [
    {
      name: '@caller.function',
      node: {
        text: 'main',
        startPosition: { row: 5, column: 0 },
        endPosition: { row: 5, column: 10 },
        type: 'function_declarator'
      }
    },
    {
      name: '@callee.function',
      node: {
        text: 'printf',
        startPosition: { row: 6, column: 2 },
        endPosition: { row: 6, column: 8 },
        type: 'identifier'
      }
    }
  ]
};

// 模拟映射配置
const mockMapping = {
  queryPattern: '@call.expression',
  patternType: QueryPatternType.RELATIONSHIP,
  captures: {
    source: '@caller.function',
    target: '@callee.function'
  },
  relationship: {
    type: 'calls',
    category: 'call',
    metadata: {
      callType: 'direct'
    }
  },
  processorConfig: {
    extractCallContext: true
  },
  priority: MappingPriority.CRITICAL,
  description: '函数调用关系'
};

console.log('测试AST处理器...');

// 处理查询结果
const result = processor.process(mockQueryResult, mockMapping, 'c');

console.log('处理结果:', result);

if (result) {
  // 检查是否是关系结果
  if ('source' in result && 'target' in result) {
    console.log('✓ AST处理器正常工作（关系类型）');
    console.log('  - 源节点ID:', result.source);
    console.log('  - 目标节点ID:', result.target);
    console.log(' - 关系类型:', result.type);
    console.log('  - 关系类别:', result.category);
    console.log('  - 元数据:', result.metadata);
  } else if ('id' in result && 'type' in result) {
    console.log('✓ AST处理器正常工作（实体类型）');
    console.log('  - 实体ID:', result.id);
    console.log('  - 实体类型:', result.type);
    console.log('  - 实体类别:', result.category);
    console.log('  - 实体名称:', result.name);
  }
} else {
  console.log('✗ AST处理器未返回结果');
}

// 测试实体映射
const entityMapping = {
  queryPattern: '@function.definition',
  patternType: QueryPatternType.ENTITY,
  captures: {
    entityType: '@function.definition'
  },
  entity: {
    type: 'function',
    category: 'definition',
    metadata: {
      visibility: 'public'
    }
 },
  priority: MappingPriority.HIGH,
  description: '函数定义实体'
};

const entityResult = processor.process(mockQueryResult, entityMapping, 'c');

console.log('\n实体处理结果:', entityResult);

if (entityResult) {
  // 检查是否是实体结果
  if ('id' in entityResult && 'type' in entityResult) {
    console.log('✓ 实体处理正常工作');
    console.log('  - 实体ID:', entityResult.id);
    console.log('  - 实体类型:', entityResult.type);
    console.log(' - 实体类别:', entityResult.category);
    console.log(' - 实体名称:', entityResult.name);
  } else {
    console.log('✗ 实体处理未返回实体类型结果');
  }
} else {
  console.log('✗ 实体处理未返回结果');
}