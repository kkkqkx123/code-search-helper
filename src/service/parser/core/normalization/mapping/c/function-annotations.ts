import { MappingConfig, QueryPatternType, MappingPriority } from '../types';

/**
 * C语言函数注解共享映射配置
 * 基于实际的查询常量定义
 */
export const FUNCTION_ANNOTATIONS_MAPPINGS: MappingConfig = {
  language: 'c',
  queryType: 'function-annotations',
  mappings: [
    {
      queryPattern: '@function.definition.with.annotation',
      patternType: QueryPatternType.SHARED,
      captures: {
        source: '@function.name',
        target: '@annotation.name',
        entityType: '@function.name'
      },
      relationship: {
        type: 'annotated_with',
        category: 'annotation',
        metadata: {
          annotationType: 'attribute',
          hasArguments: true
        }
      },
      entity: {
        type: 'annotated_function',
        category: 'definition',
        metadata: {
          subtype: 'function_with_annotation',
          hasAttribute: true
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '带属性说明符的函数定义（共享模式）'
    },
    {
      queryPattern: '@function.inline.with.annotation',
      patternType: QueryPatternType.SHARED,
      captures: {
        source: '@inline.function',
        target: '@annotation.name',
        entityType: '@inline.function'
      },
      relationship: {
        type: 'annotated_with',
        category: 'annotation',
        metadata: {
          annotationType: 'attribute',
          storageClass: 'inline',
          hasArguments: true
        }
      },
      entity: {
        type: 'inline_annotated_function',
        category: 'definition',
        metadata: {
          subtype: 'inline_function_with_annotation',
          storageClass: 'inline',
          hasAttribute: true
        }
      },
      priority: MappingPriority.CRITICAL,
      description: '带属性说明符的内联函数定义（共享模式）'
    }
  ]
};

export default FUNCTION_ANNOTATIONS_MAPPINGS;