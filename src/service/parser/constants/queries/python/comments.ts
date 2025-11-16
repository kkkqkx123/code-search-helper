/*
Python Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; 基本注释查询 - 使用交替模式减少查询次数
[
  (comment) @comment
  (string) @comment.docstring
]

; Python注释查询
(comment) @comment.python

; 文档字符串查询 - 多种模式
[
  (expression_statement (string)) @comment.docstring.module
  (function_definition (string)) @comment.docstring.function
  (class_definition (string)) @comment.docstring.class
]

; TODO/FIXME注释查询 - 使用交替模式
[
  (comment) @comment.todo
] @comment.todo

; Python特性注释查询 - 使用交替模式
[
  (comment) @comment.python_features
  (comment) @comment.python_features.async
  (comment) @comment.python_features.decorator
  (comment) @comment.python_features.type_hint
]

; 测试和性能注释查询 - 使用交替模式
[
  (comment) @comment.test_performance
  (comment) @comment.test_performance.unittest
  (comment) @comment.test_performance.pytest
]

; 数据处理和机器学习注释查询 - 使用交替模式
[
  (comment) @comment.data_ml_web
  (comment) @comment.data_ml_web.pandas
  (comment) @comment.data_ml_web.numpy
  (comment) @comment.data_ml_web.tensorflow
  (comment) @comment.data_ml_web.pytorch
]

; 安全和配置注释查询 - 使用交替模式
[
  (comment) @comment.security_config
  (comment) @comment.security_config.auth
  (comment) @comment.security_config.validation
]

; 许可证头注释查询 - 使用交替模式
[
  (comment) @comment.license
  (comment) @comment.license.mit
  (comment) @comment.license.apache
]

; 导入和模块注释查询 - 使用交替模式
[
  (comment) @comment.import_module
  (comment) @comment.import_module.standard
  (comment) @comment.import_module.third_party
]

; 调试和日志注释查询 - 使用交替模式
[
  (comment) @comment.debug_logging
  (comment) @comment.debug_logging.print
  (comment) @comment.debug_logging.logging
]
`;