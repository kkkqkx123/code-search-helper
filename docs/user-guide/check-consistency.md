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

提示词：
使用scripts/check-adapter-query-mapping-consistency.ts脚本逐个验证所有语言的一致性
类似 `适配器支持的查询类型 'functions' 在查询规则中未找到` 的问题必须解决，其他问题视情况决定
缺少查询规则的使用context7 mcp分析如何正确添加相应的查询规则，图映射中未定义的分析是否有必要添加图映射的定义(图映射应当关注节点间关系，不涉及节点间关系的一律不需要创建映射的定义)



使用scripts/check-adapter-query-mapping-consistency.ts脚本逐个验证所有语言的一致性
类似 `适配器支持的查询类型 'functions' 在查询规则中未找到` 的问题必须解决，其他问题视情况决定
缺少查询规则的使用context7 mcp分析如何正确添加相应的查询规则，图映射中未定义的分析是否有必要添加图映射的定义(图映射应当关注节点间关系，不涉及节点间关系的一律不需要创建映射的定义)

脚本使用方法：
使用方法:
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts [选项]

选项:
  -l, --language=<语言名>    只检查指定语言的一致性
  -h, --help               显示帮助信息

示例:
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts --language=javascript
  npx ts-node scripts/check-adapter-query-mapping-consistency.ts -l=typescript

支持的语言: javascript, typescript, python, java, go, rust, c, cpp, csharp, kotlin, html, css, vue(vue,css,html的规则尚不完善，可以先跳过)

JAVA语言: 132个警告 - 主要是查询类型不匹配和缺少图映射定义
JAVASCRIPT语言: 77个警告 - 主要是节点类型映射问题
TYPESCRIPT语言: 65个警告 - 主要是节点类型映射问题
PYTHON语言: 待检查
C语言: 待检查
CPP语言: 待检查
CSHARP语言: 待检查
KOTLIN语言: 待检查
其余语言已通过检查
