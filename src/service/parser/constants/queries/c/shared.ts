export default `
; 1. 用户包含 -> definition.include。关系处理时把当前文件路径、被包含文件路径(使用相对路径解析)作为关系实体
(preproc_include
  path: (string_literal)@name.included )@name.definition.include
`;