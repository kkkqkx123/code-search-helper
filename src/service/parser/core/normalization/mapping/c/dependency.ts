import { MappingConfig, QueryPatternType, MappingPriority } from '../types';

/**
 * C语言依赖关系映射配置
 */
export const DEPENDENCY_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'dependency',
  mappings: [
    {
      queryPattern: '@dependency.relationship.include',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.include.path'
      },
      relationship: {
        type: 'includes',
        category: 'dependency',
        metadata: {
          dependencyType: 'include',
          includeType: 'user'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '用户头文件包含依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.system',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.system.path'
      },
      relationship: {
        type: 'includes',
        category: 'dependency',
        metadata: {
          dependencyType: 'include',
          includeType: 'system'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '系统头文件包含依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.macro',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.macro.name',
        target: '@dependency.macro.value'
      },
      relationship: {
        type: 'defines',
        category: 'dependency',
        metadata: {
          dependencyType: 'macro',
          macroType: 'constant'
        }
      },
      priority: MappingPriority.HIGH,
      description: '宏定义依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.macro.function',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.macro.function.name',
        target: '@dependency.macro.parameter'
      },
      relationship: {
        type: 'defines',
        category: 'dependency',
        metadata: {
          dependencyType: 'macro',
          macroType: 'function'
        }
      },
      priority: MappingPriority.HIGH,
      description: '宏函数定义依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.conditional',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.condition.symbol'
      },
      relationship: {
        type: 'depends_on',
        category: 'dependency',
        metadata: {
          dependencyType: 'conditional',
          conditionalType: 'if'
        }
      },
      priority: MappingPriority.HIGH,
      description: '条件编译依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.ifdef',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.ifdef.symbol'
      },
      relationship: {
        type: 'depends_on',
        category: 'dependency',
        metadata: {
          dependencyType: 'conditional',
          conditionalType: 'ifdef'
        }
      },
      priority: MappingPriority.HIGH,
      description: 'ifdef条件编译依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.elif',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.elif.symbol'
      },
      relationship: {
        type: 'depends_on',
        category: 'dependency',
        metadata: {
          dependencyType: 'conditional',
          conditionalType: 'elif'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: 'elif条件编译依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.type',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.variable.name',
        target: '@dependency.type.reference'
      },
      relationship: {
        type: 'uses_type',
        category: 'dependency',
        metadata: {
          dependencyType: 'type',
          usageType: 'variable_declaration'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '类型引用依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.struct',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.field.name',
        target: '@dependency.struct.reference'
      },
      relationship: {
        type: 'uses_type',
        category: 'dependency',
        metadata: {
          dependencyType: 'type',
          usageType: 'field_declaration'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '结构体引用依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.function',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.function.name',
        target: '@dependency.parameter.type'
      },
      relationship: {
        type: 'uses_type',
        category: 'dependency',
        metadata: {
          dependencyType: 'type',
          usageType: 'function_declaration'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '函数声明依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.call',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.call.function',
        target: '@dependency.call.argument'
      },
      relationship: {
        type: 'calls',
        category: 'dependency',
        metadata: {
          dependencyType: 'function',
          callType: 'function_call'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '函数调用依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.type_specifier',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.variable.name',
        target: '@dependency.enum.name'
      },
      relationship: {
        type: 'uses_type',
        category: 'dependency',
        metadata: {
          dependencyType: 'type',
          usageType: 'enum_declaration'
        }
      },
      priority: MappingPriority.LOW,
      description: '枚举类型依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.type_specifier',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.variable.name',
        target: '@dependency.union.name'
      },
      relationship: {
        type: 'uses_type',
        category: 'dependency',
        metadata: {
          dependencyType: 'type',
          usageType: 'union_declaration'
        }
      },
      priority: MappingPriority.LOW,
      description: '联合体类型依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.extern',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.extern.variable'
      },
      relationship: {
        type: 'declares_extern',
        category: 'dependency',
        metadata: {
          dependencyType: 'storage_class',
          storageType: 'extern'
        }
      },
      priority: MappingPriority.LOW,
      description: '外部变量依赖关系'
    },
    {
      queryPattern: '@dependency.relationship.static',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@dependency.static.variable'
      },
      relationship: {
        type: 'declares_static',
        category: 'dependency',
        metadata: {
          dependencyType: 'storage_class',
          storageType: 'static'
        }
      },
      priority: MappingPriority.LOW,
      description: '静态变量依赖关系'
    }
  ]
};

export default DEPENDENCY_MAPPINGS;