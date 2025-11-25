import { MappingConfig, QueryPatternType, MappingPriority } from '../types';

/**
 * C语言结构体实体映射配置
 */
export const STRUCTS_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'structs',
  mappings: [
    {
      queryPattern: '@definition.struct',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@struct.name'
      },
      entity: {
        type: 'struct',
        category: 'definition',
        metadata: {
          subtype: 'struct_definition'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '结构体定义'
    },
    {
      queryPattern: '@definition.struct.typedef',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@typedef.name'
      },
      entity: {
        type: 'struct',
        category: 'definition',
        metadata: {
          subtype: 'typedef_struct'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: 'typedef结构体定义'
    },
    {
      queryPattern: '@definition.union',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@union.name'
      },
      entity: {
        type: 'union',
        category: 'definition',
        metadata: {
          subtype: 'union_definition'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '联合体定义'
    },
    {
      queryPattern: '@definition.enum',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@enum.name'
      },
      entity: {
        type: 'enum',
        category: 'definition',
        metadata: {
          subtype: 'enum_definition'
        }
      },
      priority: MappingPriority.HIGH,
      description: '枚举定义'
    },
    {
      queryPattern: '@definition.enum.constant',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@enum.constant'
      },
      entity: {
        type: 'enum_constant',
        category: 'definition',
        metadata: {
          subtype: 'enum_constant_definition'
        }
      },
      priority: MappingPriority.HIGH,
      description: '枚举常量定义'
    },
    {
      queryPattern: '@definition.struct.field',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@field.name'
      },
      entity: {
        type: 'field',
        category: 'definition',
        metadata: {
          subtype: 'struct_field_definition'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '结构体字段定义'
    },
    {
      queryPattern: '@definition.union.field',
      patternType: QueryPatternType.ENTITY,
      captures: {
        entityType: '@field.name'
      },
      entity: {
        type: 'field',
        category: 'definition',
        metadata: {
          subtype: 'union_field_definition'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '联合体字段定义'
    }
  ]
};

export default STRUCTS_MAPPINGS;