为src\service\parser\constants\queries\c\data-flow.ts
src\service\parser\constants\queries\c\functions.ts创建测试用例，格式与src\service\parser\__tests__\c\concurrency\c-concurrency.json保持一致，每个测试文件放在单独目录中。

编写脚本用于向localhost的4001端口发送请求并把每个测试用例的响应结果分别写入新的json中(每个测试用例1个json)，分别放在各自的目录，然后根据测试结果修改测试用例中查询模式的问题，并同步修改src\service\parser\constants\queries目录中相应查询模式常量定义文件中的问题。api文档见src\service\parser\__tests__\api.md(主要使用api/parser和api/parser/batch端点)。注意：测试文件使用的是json测试用例文件。请保持测试用例与查询模式定义同步
测试脚本参考src\service\parser\__tests__\scripts\c\process-c-test-cases.js
如果出现Query executed successfully but found no matches，这代表该测试用例失败了，且返回内容为空。需要修改测试用例中查询模式的问题，并同步修改src\service\parser\constants\queries目录中相应查询模式常量定义文件中的问题。如果同类错误较多，建议先专注于一个问题(可以针对某个问题单独编写临时脚本)，找出共同问题后一起修改
你可以使用api/parse端点查询一个片段的解析结果，以理解解析的过程

过程中可以创建测试脚本来验证特定问题。临时测试脚本放在src\service\parser\__tests__\scripts目录的特定语言文件夹的temp目录中。
参考src\service\parser\__tests__\scripts\c\temp目录

注意：测试脚本使用的都是外部api，不需要启动主应用

修改：
=== 更新查询文件 ===

结构体查询文件 (src/service/parser/constants/queries/c/structs.ts) 可能需要更新:
- 问题 12: Query executed successfully but found no matches
- 问题 16: Query executed successfully but found no matches

这是测试用例src\service\parser\__tests__\c\structs\c-struct.json由node src\service\parser\__tests__\scripts\c\process-c-test-cases.js执行时的结果。分析测试用例中的问题并修复。完成验证后保持查询模式常量定义与测试用例同步

交替查询改造：
分析 @/src/service/parser/constants/queries/c/structs.ts 哪些查询模式语法相近的查询可以合并为一个交替查询以提高查询效率，并作出修改。然后参考src\service\parser\__tests__\scripts\c\temp\test_alternation_queries.js使用一个测试用例来验证修改后的交替查询(不需要运行完整测试)。
