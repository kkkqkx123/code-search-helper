src\service\parser\__tests__\c\structs\c-struct.json
src\service\parser\__tests__\c\concurrency\c-concurrency.json
这是C语言并发和结构体的测试用例。
编写脚本用于向localhost的4001端口发送请求并把每个测试用例的响应结果分别写入新的json中(每个测试用例1个json)，分别放在src\service\parser\__tests__\c\concurrency
src\service\parser\__tests__\c\structs目录，然后根据测试结果修改src\service\parser\constants\queries\c\concurrency-relationships.ts
src\service\parser\constants\queries\c\structs.ts中的问题。api文档见src\service\parser\__tests__\api.md