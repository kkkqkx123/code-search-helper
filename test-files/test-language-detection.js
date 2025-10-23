const fs = require('fs');
const path = require('path');

// 模拟测试语言检测功能
async function testLanguageDetection() {
  console.log('Testing enhanced language detection...');
  
  // 测试用例
  const testCases = [
    {
      name: 'JavaScript with extension',
      filePath: 'test.js',
      content: `function hello() {
  console.log("Hello World");
}
const greeting = "Welcome";`
    },
    {
      name: 'Python without extension',
      filePath: 'test',
      content: `def hello():
    print("Hello World")
    
class MyClass:
    def __init__(self):
        self.value = 42`
    },
    {
      name: 'Backup file',
      filePath: 'script.py.bak',
      content: `import os
def process_data():
    return "processed"`
    },
    {
      name: 'TypeScript without extension',
      filePath: 'component',
      content: `interface Props {
  name: string;
  age: number;
}

const Component: React.FC<Props> = ({ name, age }) => {
  return <div>{name} is {age} years old</div>;
};`
    }
  ];
  
  // 在实际项目中，我们会这样使用：
  /*
  const { LanguageDetector } = require('../src/service/parser/core/language-detection/LanguageDetector');
  const detector = new LanguageDetector();
  
  for (const testCase of testCases) {
    console.log(`\nTesting: ${testCase.name}`);
    console.log(`File: ${testCase.filePath}`);
    
    try {
      const result = await detector.detectLanguage(testCase.filePath, testCase.content);
      console.log(`Detected language: ${result.language}`);
      console.log(`Confidence: ${result.confidence}`);
      console.log(`Method: ${result.method}`);
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
  */
  
  console.log('\nTest cases prepared. In real implementation:');
  console.log('- JavaScript file should be detected as "javascript"');
  console.log('- Python without extension should be detected as "python"');
  console.log('- Backup file should infer original language as "python"');
  console.log('- TypeScript without extension should be detected as "typescript"');
  
  console.log('\nLanguage detection test completed.');
}

testLanguageDetection();