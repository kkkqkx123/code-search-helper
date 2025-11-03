npx ts-node scripts/check-adapter-query-mapping-consistency.ts
检查特定语言：npx ts-node scripts/check-adapter-query-mapping-consistency.ts --language=javascript

适配器、查询规则和图映射一致性检查脚本

使用方法:
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts [选项]

选项:
  -l, --language=<语言名>    只检查指定语言的一致性
  -h, --help               显示帮助信息

示例:
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts --language=javascript
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts -l=typescript

支持的语言: javascript, typescript, python, java, go, rust, c, cpp, csharp, kotlin, html, css, vue