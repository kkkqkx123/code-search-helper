/**
 * 查询配置文件
 * 包含查询类型定义、关键词映射和复合查询配置
 */

import { languageMappingManager } from '../../config/LanguageMappingManager';

// 常见查询类型
export const COMMON_QUERY_TYPES = [
  'functions', 'classes', 'methods', 'imports', 'exports', 'variables', 'types', 'interfaces'
] as const;

// 复合查询类型配置
export const COMPOUND_QUERY_TYPES = [
  { file: 'functions-types', queries: ['functions', 'classes'] },
  { file: 'classes-functions', queries: ['classes', 'functions'] },
  { file: 'methods-variables', queries: ['methods', 'variables'] },
  { file: 'constructors-properties', queries: ['methods', 'properties'] },
  { file: 'control-flow-patterns', queries: ['controlFlow'] },
  { file: 'expressions-control-flow', queries: ['expression', 'controlFlow'] },
  { file: 'types-decorators', queries: ['types', 'decorator'] },
  { file: 'variables-imports', queries: ['variables', 'imports'] }
] as const;

// 查询类型关键词映射
export const QUERY_PATTERNS: Record<string, string[]> = {
  functions: [
    'function_definition', 'function_declaration', 'function_declarator',
    'method_definition', 'method_declaration', 'func_literal',
    'local_function_definition', 'function_declaration'
  ],
  classes: [
    'class_declaration', 'class_definition', 'struct_specifier',
    'struct_item', 'union_specifier', 'enum_specifier',
    'interface_type', 'struct_type', 'interface_declaration',
    'type_declaration', 'type_definition'
  ],
  variables: [
    'variable_declaration', 'var_declaration', 'let_declaration',
    'assignment_expression', 'local_variable_declaration',
    'variable_assignment', 'declaration'
  ],
  imports: [
    'import_statement', 'import_declaration', 'use_declaration',
    'preproc_include', 'import_declaration'
  ],
  exports: [
    'export_statement', 'export_declaration', 'export_default_declaration'
  ],
  types: [
    'type_declaration', 'type_definition', 'type_alias_declaration',
    'type_definition', 'typedef'
  ],
  interfaces: [
    'interface_declaration', 'interface_definition', 'trait_item',
    'interface_type'
  ],
  methods: [
    'method_definition', 'method_declaration', 'method_spec',
    'function_definition_statement'
  ],
  properties: [
    'field_declaration', 'property_definition', 'public_field_definition',
    'field_declaration'
  ]
};

// 基本查询类型（确保至少存在）
export const BASIC_QUERY_TYPES = ['functions', 'classes'] as const;

// 默认查询类型
export const DEFAULT_QUERY_TYPES = ['functions', 'classes', 'methods', 'imports', 'variables'] as const;

// 常用语言列表 - 使用统一映射管理器
export const COMMON_LANGUAGES = [
  ...languageMappingManager.getCommonLanguages()
] as const;