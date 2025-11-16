/*
Java Language Comment-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Based on tree-sitter best practices
*/
export default `
; 基本注释查询
[
  (line_comment)
  (block_comment)
] @comment

; 单行注释查询
(line_comment) @comment.single

; 多行注释查询
(block_comment) @comment.multi

; Javadoc文档注释查询
(block_comment) @comment.javadoc

; TODO/FIXME注释查询
[
  (line_comment) @comment.todo
  (block_comment) @comment.todo
] @comment.todo

; Java特性注释查询
[
  (line_comment) @comment.java_features
  (block_comment) @comment.java_features
] @comment.java_features

; 许可证头注释查询
(block_comment) @comment.license

; Javadoc标签注释查询
(block_comment) @comment.javadoc_tags
`;