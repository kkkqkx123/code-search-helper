src\__tests__\integration\parser\parser-splitting-integration.test.ts是完整工作流的测试，是用于发现问题的。
如果判定工作流有问题，需要修改原代码。该测试文件只用于验证最终结果，调试请创建单独的测试文件并输出到别的路径，例如test-data\parser-debug