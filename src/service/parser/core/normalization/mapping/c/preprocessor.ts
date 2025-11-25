import { MappingConfig, QueryPatternType, MappingPriority } from '../types';

/**
 * C语言预处理器实体映射配置
 */
export const PREPROCESSOR_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'preprocessor',
  mappings: [
    {
      queryPattern: '@definition.macro',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@macro.name'
      },
      entity: {
        type: 'macro',
        category: 'definition',
        metadata: {
          subtype: 'macro_definition'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '宏定义'
    },
    {
      queryPattern: '@definition.macro.function',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@macro.function.name'
      },
      entity: {
        type: 'macro_function',
        category: 'definition',
        metadata: {
          subtype: 'macro_function_definition'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '宏函数定义'
    },
    {
      queryPattern: '@definition.include',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@include.path'
      },
      entity: {
        type: 'include',
        category: 'directive',
        metadata: {
          subtype: 'include_directive'
        }
      },
      priority: MappingPriority.HIGH,
      description: '包含指令'
    },
    {
      queryPattern: '@definition.conditional',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@conditional.symbol'
      },
      entity: {
        type: 'conditional',
        category: 'directive',
        metadata: {
          subtype: 'conditional_compilation'
        }
      },
      priority: MappingPriority.HIGH,
      description: '条件编译指令'
    },
    {
      queryPattern: '@definition.ifdef',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@ifdef.symbol'
      },
      entity: {
        type: 'conditional',
        category: 'directive',
        metadata: {
          subtype: 'ifdef_directive'
        }
      },
      priority: MappingPriority.HIGH,
      description: 'ifdef指令'
    },
    {
      queryPattern: '@definition.elif',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@elif.symbol'
      },
      entity: {
        type: 'conditional',
        category: 'directive',
        metadata: {
          subtype: 'elif_directive'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: 'elif指令'
    }
  ]
};

export default PREPROCESSOR_MAPPINGS;