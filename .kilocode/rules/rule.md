# rule.md
执行命令时建议不要cd，统一从项目根目录出发

## mermaid rule
不要使用样式，例如颜色等。
仅在对话时使用mermaid，输出到文档时不要使用mermaid，使用三元组或使用箭头符号。

## ts rule
npm test禁止使用--testPathPattern，以免匹配失败，执行完整测试。必须使用npm test 相对路径