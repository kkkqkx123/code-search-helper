结论：移除fileContent是正确的

✅ 分析结果

1. Tree-Sitter节点文本获取方式
当前正确的做法：

return parentClass.text || null;
不必要的旧做法：

return this.treeSitterService.getNodeText(parentClass, fileContent);

2. 为什么正确
Tree-Sitter SyntaxNode特性：

每个SyntaxNode都有内置的text属性
在解析时自动填充节点对应的源代码文本
不需要额外传递完整的文件内容
项目一致性：

所有关系提取器都使用node.text模式
例如：return child.text || null;
这是项目的标准做法
接口设计意图：

extractInheritanceRelationships故意不接收fileContent参数
继承关系提取只需要AST结构信息
避免不必要的内存开销

3. 当前节点内容获取方式
// 在extractParentClassName方法中
protected extractParentClassName(parentClass: Parser.SyntaxNode): string | null {
  if (parentClass.type === 'identifier') {
    return parentClass.text || null;  // ✅ 直接使用节点文本
  } else if (parentClass.type === 'attribute') {
    return parentClass.text || null;  // ✅ 直接使用节点文本
  }
  return null;
}
这种方式既高效又符合Tree-Sitter的最佳实践。移除fileContent参数是完全正确的设计决策。