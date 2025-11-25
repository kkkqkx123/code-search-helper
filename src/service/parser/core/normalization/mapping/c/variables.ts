import { MappingConfig, QueryPatternType, MappingPriority } from '../types';

/**
 * C语言变量实体映射配置
 */
export const VARIABLES_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'variables',
  mappings: [
    {
      queryPattern: '@definition.variable',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@variable.name'
      },
      entity: {
        type: 'variable',
        category: 'definition',
        metadata: {
          subtype: 'variable_definition'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '变量定义'
    },
    {
      queryPattern: '@definition.global.variable',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@global.variable.name'
      },
      entity: {
        type: 'variable',
        category: 'definition',
        metadata: {
          subtype: 'global_variable',
          scope: 'global'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '全局变量定义'
    },
    {
      queryPattern: '@definition.local.variable',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@local.variable.name'
      },
      entity: {
        type: 'variable',
        category: 'definition',
        metadata: {
          subtype: 'local_variable',
          scope: 'local'
        }
      },
      priority: MappingPriority.HIGH,
      description: '局部变量定义'
    },
    {
      queryPattern: '@definition.static.variable',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@static.variable.name'
      },
      entity: {
        type: 'variable',
        category: 'definition',
        metadata: {
          subtype: 'static_variable',
          storageClass: 'static'
        }
      },
      priority: MappingPriority.HIGH,
      description: '静态变量定义'
    },
    {
      queryPattern: '@definition.extern.variable',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@extern.variable'
      },
      entity: {
        type: 'variable',
        category: 'declaration',
        metadata: {
          subtype: 'extern_variable',
          storageClass: 'extern'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '外部变量声明'
    },
    {
      queryPattern: '@definition.constant',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@constant.name'
      },
      entity: {
        type: 'constant',
        category: 'definition',
        metadata: {
          subtype: 'constant_definition'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '常量定义'
    }
  ]
};

export default VARIABLES_MAPPINGS;