为src\service\parser\constants\queries\c\control-flow.ts
src\service\parser\constants\queries\c\control-flow-relationships.ts创建测试用例，格式与src\service\parser\__tests__\c\concurrency\c-concurrency.json保持一致，每个测试文件放在单独目录中。

编写脚本用于向localhost的4001端口发送请求并把每个测试用例的响应结果分别写入新的json中(每个测试用例1个json)，分别放在各自的目录，然后根据测试结果修改src\service\parser\constants\queries目录中相应查询模式常量定义文件中的问题。api文档见src\service\parser\__tests__\api.md
测试脚本参考src\service\parser\__tests__\scripts\process-c-test-cases.js
过程中的测试脚本放在src\service\parser\__tests__\scripts目录中。