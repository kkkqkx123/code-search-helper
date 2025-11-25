// 导入实体映射配置
import { FUNCTIONS_MAPPINGS } from './functions';
import { VARIABLES_MAPPINGS } from './variables';
import { STRUCTS_MAPPINGS } from './structs';
import { PREPROCESSOR_MAPPINGS } from './preprocessor';

// 导入关系映射配置
import { LIFECYCLE_MAPPINGS } from './lifecycle';
import { DEPENDENCY_MAPPINGS } from './dependency';
import { INHERITANCE_MAPPINGS } from './inheritance';

// 导入共享映射配置
import { CALL_EXPRESSIONS_MAPPINGS } from './call-expressions';
import { FUNCTION_ANNOTATIONS_MAPPINGS } from './function-annotations';

// 导出所有映射配置
export {
  FUNCTIONS_MAPPINGS,
  VARIABLES_MAPPINGS,
  STRUCTS_MAPPINGS,
  PREPROCESSOR_MAPPINGS,
  LIFECYCLE_MAPPINGS,
  DEPENDENCY_MAPPINGS,
  INHERITANCE_MAPPINGS,
  CALL_EXPRESSIONS_MAPPINGS,
  FUNCTION_ANNOTATIONS_MAPPINGS
};

// 映射配置注册表
export const C_MAPPINGS_REGISTRY = {
  // 实体映射
  functions: FUNCTIONS_MAPPINGS,
  variables: VARIABLES_MAPPINGS,
  structs: STRUCTS_MAPPINGS,
  preprocessor: PREPROCESSOR_MAPPINGS,
  
  // 关系映射
  lifecycle: LIFECYCLE_MAPPINGS,
  dependency: DEPENDENCY_MAPPINGS,
  inheritance: INHERITANCE_MAPPINGS,
  
  // 共享映射
  'call-expressions': CALL_EXPRESSIONS_MAPPINGS,
  'function-annotations': FUNCTION_ANNOTATIONS_MAPPINGS
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

// 获取实体映射类型
export function getEntityMappingTypes(): CMappingType[] {
  return ['functions', 'variables', 'structs', 'preprocessor'];
}

// 获取关系映射类型
export function getRelationshipMappingTypes(): CMappingType[] {
  return ['lifecycle', 'dependency', 'inheritance'];
}

// 获取共享映射类型
export function getSharedMappingTypes(): CMappingType[] {
  return ['call-expressions', 'function-annotations'];
}

// 检查映射类型是否存在
export function hasCMapping(mappingType: string): mappingType is CMappingType {
  return mappingType in C_MAPPINGS_REGISTRY;
}

// 获取映射配置的统计信息
export function getCMappingStats() {
  const allMappings = Object.values(C_MAPPINGS_REGISTRY);
  const totalMappings = allMappings.reduce((sum, config) => sum + config.mappings.length, 0);
  
  const entityCount = getEntityMappingTypes().reduce(
    (sum, type) => sum + C_MAPPINGS_REGISTRY[type].mappings.length, 0
  );
  
  const relationshipCount = getRelationshipMappingTypes().reduce(
    (sum, type) => sum + C_MAPPINGS_REGISTRY[type].mappings.length, 0
  );
  
  const sharedCount = getSharedMappingTypes().reduce(
    (sum, type) => sum + C_MAPPINGS_REGISTRY[type].mappings.length, 0
  );
  
  return {
    totalMappings,
    entityCount,
    relationshipCount,
    sharedCount,
    mappingTypes: Object.keys(C_MAPPINGS_REGISTRY).length
  };
}

// 映射类型注释定义
export const C_MAPPING_COMMENTS = {
  // 实体映射注释
  functions: 'C语言函数实体映射，处理函数定义、函数原型、函数指针等函数相关实体',
  variables: 'C语言变量实体映射，处理全局变量、局部变量、静态变量、常量等变量相关实体',
  structs: 'C语言结构体实体映射，处理结构体、联合体、枚举等复合类型实体',
  preprocessor: 'C语言预处理器实体映射，处理宏定义、包含指令、条件编译等预处理器实体',
  
  // 关系映射注释
  lifecycle: 'C语言生命周期关系映射，处理内存、文件、线程等资源的生命周期管理关系',
  dependency: 'C语言依赖关系映射，处理头文件包含、宏定义、类型引用等依赖关系',
  inheritance: 'C语言继承关系映射，处理结构体嵌套、函数指针、类型别名等继承模拟关系',
  
  // 共享映射注释
  'call-expressions': 'C语言调用表达式共享映射，同时生成实体和关系结果，处理各种函数调用模式',
  'function-annotations': 'C语言函数注解共享映射，同时生成实体和关系结果，处理函数属性和注解'
};

// 获取映射类型的描述
export function getCMappingDescription(mappingType: CMappingType): string {
  return C_MAPPING_COMMENTS[mappingType] || '未知映射类型';
}

// 验证映射配置的完整性
export function validateCMappingRegistry(): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 检查所有必需的映射类型是否存在
  const requiredTypes = [...getEntityMappingTypes(), ...getRelationshipMappingTypes(), ...getSharedMappingTypes()];
  
  for (const type of requiredTypes) {
    if (!C_MAPPINGS_REGISTRY[type]) {
      errors.push(`缺少必需的映射类型: ${type}`);
    } else {
      const config = C_MAPPINGS_REGISTRY[type];
      if (!config.mappings || config.mappings.length === 0) {
        errors.push(`映射类型 ${type} 没有定义任何映射规则`);
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export default C_MAPPINGS_REGISTRY;