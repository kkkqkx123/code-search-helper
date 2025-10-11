分析当前tree-sitter的集成情况，并分析是否有必要把tree-sitter分别为索引和查询服务。

例如：为查询提供服务时需要分析complexity、nestingLevel等内容，但索引时不需要。部分AST的特征可以仅在查询相关
src\service\parser\types.ts