import { MappingConfig, QueryPatternType, MappingPriority } from '../types';

/**
 * C语言继承关系映射配置
 * 注意：C语言本身不支持继承，这里主要处理结构体嵌套、函数指针等模拟继承的模式
 */
export const INHERITANCE_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'inheritance',
  mappings: [
    {
      queryPattern: '@inheritance.relationship.struct.composition',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@parent.struct',
        target: '@child.field'
      },
      relationship: {
        type: 'contains',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'composition',
          compositionType: 'struct_field'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '结构体组合关系（通过字段包含其他结构体）'
    },
    {
      queryPattern: '@inheritance.relationship.struct.nesting',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@outer.struct',
        target: '@inner.struct'
      },
      relationship: {
        type: 'contains',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'nesting',
          nestingType: 'struct_nesting'
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '结构体嵌套关系'
    },
    {
      queryPattern: '@inheritance.relationship.function.pointer',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@struct.type',
        target: '@function.pointer'
      },
      relationship: {
        type: 'implements',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'interface_simulation',
          simulationType: 'function_pointer'
        }
      },
      priority: MappingPriority.HIGH,
      description: '函数指针接口模拟关系'
    },
    {
      queryPattern: '@inheritance.relationship.typedef.struct',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@typedef.name',
        target: '@original.struct'
      },
      relationship: {
        type: 'aliases',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'type_alias',
          aliasType: 'typedef_struct'
        }
      },
      priority: MappingPriority.HIGH,
      description: 'typedef结构体别名关系'
    },
    {
      queryPattern: '@inheritance.relationship.typedef.pointer',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@typedef.name',
        target: '@pointer.type'
      },
      relationship: {
        type: 'aliases',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'type_alias',
          aliasType: 'typedef_pointer'
        }
      },
      priority: MappingPriority.HIGH,
      description: 'typedef指针别名关系'
    },
    {
      queryPattern: '@inheritance.relationship.typedef.function',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@typedef.name',
        target: '@function.type'
      },
      relationship: {
        type: 'aliases',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'type_alias',
          aliasType: 'typedef_function'
        }
      },
      priority: MappingPriority.HIGH,
      description: 'typedef函数别名关系'
    },
    {
      queryPattern: '@inheritance.relationship.union.struct',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@union.type',
        target: '@struct.field'
      },
      relationship: {
        type: 'contains',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'union_composition',
          compositionType: 'union_struct_field'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '联合体包含结构体关系'
    },
    {
      queryPattern: '@inheritance.relationship.struct.array',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@struct.type',
        target: '@array.field'
      },
      relationship: {
        type: 'contains',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'array_composition',
          compositionType: 'struct_array_field'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '结构体包含数组字段关系'
    },
    {
      queryPattern: '@inheritance.relationship.pointer.struct',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@struct.type',
        target: '@pointer.field'
      },
      relationship: {
        type: 'references',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'pointer_reference',
          referenceType: 'struct_pointer_field'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '结构体包含指针字段关系'
    },
    {
      queryPattern: '@inheritance.relationship.callback.function',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@caller.function',
        target: '@callback.parameter'
      },
      relationship: {
        type: 'uses_callback',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'callback_pattern',
          callbackType: 'function_parameter'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '回调函数模式关系'
    },
    {
      queryPattern: '@inheritance.relationship.vtable.simulation',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@struct.type',
        target: '@vtable.pointer'
      },
      relationship: {
        type: 'simulates',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'vtable_simulation',
          simulationType: 'virtual_function_table'
        }
      },
      priority: MappingPriority.MEDIUM,
      description: '虚函数表模拟关系'
    },
    {
      queryPattern: '@inheritance.relationship.opaque.pointer',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@opaque.type',
        target: '@implementation.pointer'
      },
      relationship: {
        type: 'hides',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'opaque_pointer',
          hidingType: 'implementation_detail'
        }
      },
      priority: MappingPriority.LOW,
      description: '不透明指针隐藏实现关系'
    },
    {
      queryPattern: '@inheritance.relationship.forward.declaration',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@forward.declaration',
        target: '@actual.definition'
      },
      relationship: {
        type: 'declares_before',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'forward_declaration',
          declarationType: 'struct_forward_decl'
        }
      },
      priority: MappingPriority.LOW,
      description: '前向声明关系'
    },
    {
      queryPattern: '@inheritance.relationship.macro.polymorphism',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@macro.definition',
        target: '@polymorphic.usage'
      },
      relationship: {
        type: 'enables',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'macro_polymorphism',
          polymorphismType: 'macro_based'
        }
      },
      priority: MappingPriority.LOW,
      description: '宏多态模式关系'
    },
    {
      queryPattern: '@inheritance.relationship.generic.macro',
      patternType: QueryPatternType.RELATIONSHIP,
      captures: {
        source: '@generic.macro',
        target: '@type.parameter'
      },
      relationship: {
        type: 'generates',
        category: 'inheritance',
        metadata: {
          inheritanceType: 'generic_macro',
          genericType: 'macro_based_generic'
        }
      },
      priority: MappingPriority.LOW,
      description: '泛型宏模式关系'
    }
  ]
};

export default INHERITANCE_MAPPINGS;