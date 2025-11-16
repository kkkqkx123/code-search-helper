/**
 * Python语言适配器常量定义
 * 包含节点类型映射、查询类型映射等常量
 */

export const PYTHON_NODE_TYPE_MAPPING: Record<string, string> = {
  // 函数相关
  'function_definition': 'functionDeclaration',
  'async_function_definition': 'functionDeclaration',
  'decorated_definition': 'functionDeclaration', // 默认为函数，后续会根据内容调整
  'method_definition': 'methodDeclaration',
  'lambda': 'lambdaExpression',
  
  // 类相关
  'class_definition': 'classDeclaration',
  'class_pattern': 'classDeclaration',
  
  // 导入相关
  'import_statement': 'importDeclaration',
  'import_from_statement': 'importDeclaration',
  'relative_import': 'importDeclaration',
  'wildcard_import': 'importDeclaration',
  'dotted_name': 'memberExpression',
  
  // 变量相关
  'assignment': 'variableDeclaration',
  'annotated_assignment': 'variableDeclaration',
  'augmented_assignment': 'variableDeclaration',
  'named_expression': 'expression',
  
  // 控制流相关
  'for_statement': 'controlFlow',
  'while_statement': 'controlFlow',
  'if_statement': 'controlFlow',
  'try_statement': 'controlFlow',
  'with_statement': 'controlFlow',
  'break_statement': 'controlFlow',
  'continue_statement': 'controlFlow',
  'return_statement': 'controlFlow',
  'raise_statement': 'controlFlow',
  'assert_statement': 'controlFlow',
  'expression_statement': 'controlFlow',
  'type_alias_statement': 'typeAnnotation',
  'global_statement': 'controlFlow',
  'nonlocal_statement': 'controlFlow',
  
  // 表达式相关
  'call': 'callExpression',
  'attribute': 'memberExpression',
  'subscript': 'memberExpression',
  'binary_operator': 'expression',
  'yield': 'expression',
  'type': 'typeAnnotation',
  'parameters': 'typeAnnotation',
  'default_parameter': 'typeAnnotation',
  'typed_parameter': 'typeAnnotation',
  'typed_default_parameter': 'typeAnnotation',
  'decorator': 'decorator',
  'comment': 'comment',
  'string': 'literal',
  'integer': 'literal',
  'float': 'literal',
  'true': 'literal',
  'false': 'literal',
  'none': 'literal',
  'ellipsis': 'literal',
  'list': 'variableDeclaration',
  'tuple': 'variableDeclaration',
  'set': 'variableDeclaration',
  'dictionary': 'variableDeclaration',
  'list_comprehension': 'expression',
  'dictionary_comprehension': 'expression',
  'set_comprehension': 'expression',
  'generator_expression': 'lambdaExpression',
  'parenthesized_expression': 'expression',
  'expression_list': 'expression',
  'slice': 'expression',
  'tuple_pattern': 'pattern',
  'list_pattern': 'pattern',
  'dict_pattern': 'pattern',
  'union_type': 'typeAnnotation',
  'generic_type': 'genericTypes',
  'argument_list': 'callExpression',
  
  // 其他
  'identifier': 'propertyIdentifier',
  'block': 'block'
};

export const PYTHON_QUERY_TYPE_MAPPING: Record<string, string> = {
  'functions': 'function',
  'classes': 'class',
  'variables': 'variable',
  'imports': 'import',
  'control-flow': 'control-flow',
  'data-structures': 'class', // Python的数据结构通常映射为类
  'comments': 'comment',
  'types-decorators': 'type',
  
  // 关系类型
  'calls': 'call',
  'data-flows': 'data-flow',
  'inheritance': 'inheritance',
  // ... 其他关系类型
  'concurrency-relationships': 'concurrency',
  'control-flow-relationships': 'control-flow',
  'lifecycle-relationships': 'lifecycle',
  'semantic-relationships': 'semantic'
};

export const PYTHON_SUPPORTED_QUERY_TYPES = [
  // Entity types
  'functions',
  'classes',
  'variables',
  'imports',
  'control-flow',
  'comments',
  'data-structures',
  'types-decorators',
  // Relationship types
  'calls',
  'data-flows',
  'inheritance',
  // Advanced relationship types
  'concurrency-relationships',
  'control-flow-relationships',
  'lifecycle-relationships',
  'semantic-relationships'
];

export const PYTHON_NAME_CAPTURES = [
  // 基础捕获
  'name.definition.function',
  'name.definition.class',
  'name.definition.variable',
  'name.definition.import',
  'name.definition.if',
  'name.definition.binary_operator',
  'name.definition.list_comprehension',
  'name.definition.type_annotation',
  
  // 函数相关
  'name.definition.async_function',
  'name.definition.method',
  'name.definition.async_method',
  'name.definition.lambda',
  'name.definition.generator',
  'name.definition.async_generator',
  'name.definition.typed_function',
  'name.definition.typed_async_function',
  'name.definition.test',
  'name.definition.dunder_method',
  'name.definition.private_method',
  
  // 类相关
  'name.definition.class',
  'name.definition.superclass',
  'name.definition.property',
  'name.definition.static_method',
  'name.definition.class_method',
  
  // 变量相关
  'name.definition.variable',
  'name.definition.constant',
  'name.definition.typed_variable',
  'name.definition.augmented_assignment',
  'name.definition.named_expression',
  'name.definition.pattern_variable',
  'name.definition.attribute_variable',
  'name.definition.subscript_variable',
  'name.definition.tuple_variable',
  'name.definition.list_variable',
  
  // 导入相关
  'name.definition.import',
  'name.definition.import_from',
  'name.definition.wildcard_import',
  'name.definition.relative_import',
  'name.definition.global',
  'name.definition.nonlocal',
  'name.definition.imported_module',
  'name.definition.imported_name',
  
  // 控制流相关
  'name.definition.if',
  'name.definition.for',
  'name.definition.while',
  'name.definition.break',
  'name.definition.continue',
  'name.definition.return',
  'name.definition.raise',
  'name.definition.assert',
  'name.definition.expression',
  
  // 表达式相关
  'name.definition.binary_operator',
  'name.definition.call',
  'name.definition.attribute',
  'name.definition.subscript',
  
  // 数据结构相关
  'name.definition.list_comprehension',
  'name.definition.dict_comprehension',
  'name.definition.set_comprehension',
  'name.definition.generator_expression',
  'name.definition.list',
  'name.definition.tuple',
  'name.definition.set',
  'name.definition.dictionary',
  'name.definition.class_pattern',
  'name.definition.tuple_pattern',
  'name.definition.list_pattern',
  'name.definition.dict_pattern',
  'name.definition.string',
  'name.definition.integer',
  'name.definition.float',
  'name.definition.true',
  'name.definition.false',
  'name.definition.none',
  'name.definition.ellipsis',
  'name.definition.slice',
  'name.definition.parenthesized_expression',
  'name.definition.expression_list',
  'name.definition.generic_type_name',
  
  // 类型相关
  'name.definition.type_annotation',
  'name.definition.type_hint',
  'name.definition.type_alias',
  'name.definition.parameters',
  'name.definition.default_parameter',
  'name.definition.typed_parameter',
  'name.definition.typed_default_parameter',
  'name.definition.decorator',
  'name.definition.union_type',
  'name.definition.comment',
  'name.definition.docstring'
];

export const PYTHON_BLOCK_NODE_TYPES = [
  'block', 'suite', 'function_definition', 'async_function_definition',
  'class_definition', 'if_statement', 'for_statement', 'while_statement',
  'try_statement', 'with_statement', 'decorated_definition'
];

export const PYTHON_MODIFIERS = [
  'async',
  'staticmethod',
  'classmethod',
  'property',
  'decorated',
  'generator',
  'abstract',
  'final',
  'override',
  'private',
  'protected',
  'public',
  'global',
  'nonlocal',
  'coroutine',
  'contextmanager',
  'dataclass',
  'type_hint'
];

export const PYTHON_COMPLEXITY_KEYWORDS = [
  { keyword: 'async', pattern: 'async', weight: 1 },
  { keyword: 'await', pattern: 'await', weight: 1 },
  { keyword: 'yield', pattern: 'yield', weight: 1 },
  { keyword: 'lambda', pattern: 'lambda', weight: 1 },
  { keyword: 'decorator', pattern: '@', weight: 1 },
  { keyword: 'comprehension', pattern: 'comprehension', weight: 1 },
  { keyword: 'generator', pattern: 'generator', weight: 1 },
  { keyword: 'context_manager', pattern: 'with|__enter__|__exit__', weight: 2 },
  { keyword: 'metaclass', pattern: 'metaclass', weight: 2 },
  { keyword: 'decorator_pattern', pattern: 'property|staticmethod|classmethod', weight: 1 },
  { keyword: 'abstract', pattern: 'abstractmethod|ABC', weight: 1 },
  { keyword: 'type_hint', pattern: ':|->', weight: 1 },
  { keyword: 'exception', pattern: 'try|except|finally|raise', weight: 1 },
  { keyword: 'class', pattern: 'class', weight: 2 },
  { keyword: 'function', pattern: 'def', weight: 1 },
  { keyword: 'data_flow', pattern: 'data-flow', weight: 2 },
  { keyword: 'semantic_relationship', pattern: 'semantic-relationship', weight: 3 },
  { keyword: 'lifecycle_relationship', pattern: 'lifecycle-relationship', weight: 3 },
  { keyword: 'concurrency_relationship', pattern: 'concurrency-relationship', weight: 3 }
];