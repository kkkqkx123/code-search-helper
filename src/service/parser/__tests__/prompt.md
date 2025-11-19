为src\service\parser\constants\queries\c\control-flow.ts
src\service\parser\constants\queries\c\control-flow-relationships.ts创建测试用例，格式与src\service\parser\__tests__\c\concurrency\c-concurrency.json保持一致，每个测试文件放在单独目录中。

编写脚本用于向localhost的4001端口发送请求并把每个测试用例的响应结果分别写入新的json中(每个测试用例1个json)，分别放在各自的目录，然后根据测试结果修改测试用例中查询模式的问题，并同步修改src\service\parser\constants\queries目录中相应查询模式常量定义文件中的问题。api文档见src\service\parser\__tests__\api.md。注意：测试文件使用的是json测试用例文件。请保持测试用例与查询模式定义同步
测试脚本参考src\service\parser\__tests__\scripts\c\process-c-test-cases.js

过程中可以创建测试脚本来验证特定问题。测试脚本放在src\service\parser\__tests__\scripts目录的特定语言文件夹中。
参考src\service\parser\__tests__\scripts\c\analyze-pointer-ast.js
src\service\parser\__tests__\scripts\c\test-pointer-query.js
src\service\parser\__tests__\scripts\c\test-struct-fixes.js

修改：
=== 更新查询文件 ===

结构体查询文件 (src/service/parser/constants/queries/c/structs.ts) 可能需要更新:
- 问题 12: Query executed successfully but found no matches
- 问题 16: Query executed successfully but found no matches

这是测试用例src\service\parser\__tests__\c\structs\c-struct.json由node src\service\parser\__tests__\scripts\c\process-c-test-cases.js执行时的结果。分析测试用例中的问题并修复。完成验证后保持查询模式常量定义与测试用例同步