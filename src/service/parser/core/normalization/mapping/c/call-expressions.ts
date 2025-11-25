import { MappingConfig, QueryPatternType, MappingPriority } from '../types';

/**
 * C语言调用表达式共享映射配置
 * 基于实际的查询常量定义
 */
export const CALL_EXPRESSIONS_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'call-expressions',
  mappings: [
    {
      queryPattern: '@call.expression',
      patternType: QueryPatternType.SHARED,
      captures: {
        source: '@call.function',
        entityType: '@call.function'
      },
      relationship: {
        type: 'calls',
        category: 'call',
        metadata: {
          callType: 'function_call',
          expressionType: 'call_expression'
        }
      },
      entity: {
        type: 'function_call',
        category: 'expression',
        metadata: {
          expressionType: 'call_expression',
          callType: 'function_call'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '基础函数调用表达式（共享模式）'
    },
    {
      queryPattern: '@call.expression.pointer',
      patternType: QueryPatternType.SHARED,
      captures: {
        source: '@call.function.pointer',
        entityType: '@call.function.pointer'
      },
      relationship: {
        type: 'calls_via_pointer',
        category: 'call',
        metadata: {
          callType: 'function_pointer_call',
          expressionType: 'pointer_call_expression'
        }
      },
      entity: {
        type: 'function_pointer_call',
        category: 'expression',
        metadata: {
          expressionType: 'pointer_call_expression',
          callType: 'function_pointer_call'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '函数指针调用表达式（共享模式）'
    },
    {
      queryPattern: '@call.expression.method',
      patternType: QueryPatternType.SHARED,
      captures: {
        source: '@call.object',
        target: '@call.method',
        entityType: '@call.method'
      },
      relationship: {
        type: 'calls_method',
        category: 'call',
        metadata: {
          callType: 'method_call',
          expressionType: 'method_call_expression',
          objectName: '@call.object'
        }
      },
      entity: {
        type: 'method_call',
        category: 'expression',
        metadata: {
          expressionType: 'method_call_expression',
          callType: 'method_call',
          objectName: '@call.object'
        }
      },
      priority: MappingPriority.HIGH,
      description: '结构体方法调用表达式（共享模式）'
    },
    {
      queryPattern: '@call.expression.recursive',
      patternType: QueryPatternType.SHARED,
      captures: {
        source: '@recursive.call',
        entityType: '@recursive.call'
      },
      relationship: {
        type: 'calls_recursive',
        category: 'call',
        metadata: {
          callType: 'recursive_call',
          expressionType: 'recursive_call_expression'
        }
      },
      entity: {
        type: 'recursive_call',
        category: 'expression',
        metadata: {
          expressionType: 'recursive_call_expression',
          callType: 'recursive_call'
        }
      },
      priority: MappingPriority.HIGH,
      description: '递归调用表达式（共享模式）'
    },
    {
      queryPattern: '@call.expression.chained',
      patternType: QueryPatternType.SHARED,
      captures: {
        source: '@chained.call.function',
        target: '@chained.call.method',
        entityType: '@chained.call.method'
      },
      relationship: {
        type: 'calls_chained',
        category: 'call',
        metadata: {
          callType: 'chained_call',
          expressionType: 'chained_call_expression',
          previousFunction: '@chained.call.function'
        }
      },
      entity: {
        type: 'chained_call',
        category: 'expression',
        metadata: {
          expressionType: 'chained_call_expression',
          callType: 'chained_call',
          previousFunction: '@chained.call.function'
        }
      },
      priority: MappingPriority.HIGH,
      description: '链式调用表达式（共享模式）'
    }
  ]
};

export default CALL_EXPRESSIONS_MAPPINGS;