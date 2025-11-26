import { MappingConfig, QueryPatternType, MappingPriority } from '../../types';

/**
 * C语言函数实体映射配置
 */
export const FUNCTIONS_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'functions',
  mappings: [
    {
      queryPattern: '@definition.function',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@function.name'
      },
      entity: {
        type: 'function',
        category: 'definition',
        metadata: {
          subtype: 'function_definition'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '函数定义'
    },
    {
      queryPattern: '@definition.function.prototype',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@function.name'
      },
      entity: {
        type: 'function',
        category: 'declaration',
        metadata: {
          subtype: 'function_prototype'
        }
      },
      priority: MappingPriority.HIGH,
      description: '函数原型声明'
    },
    {
      queryPattern: '@definition.function.with_params',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@function.name'
      },
      entity: {
        type: 'function',
        category: 'definition',
        metadata: {
          subtype: 'function_with_parameters',
          hasParameters: true
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '带参数的函数定义'
    },
    {
      queryPattern: '@definition.function.pointer',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@function.pointer.name'
      },
      entity: {
        type: 'function_pointer',
        category: 'declaration',
        metadata: {
          subtype: 'function_pointer_declaration'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '函数指针声明'
    },
    {
      queryPattern: '@definition.inline.function',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@inline.function'
      },
      entity: {
        type: 'function',
        category: 'definition',
        metadata: {
          subtype: 'inline_function',
          isInline: true
        }
      },
      priority: MappingPriority.HIGH,
      description: '内联函数定义'
    }
  ]
};

export default FUNCTIONS_MAPPINGS;