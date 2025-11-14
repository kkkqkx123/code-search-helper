/**
 * FileContentDetector 测试用例
 */

import { FileContentDetector, LineEndingType, IndentType } from '../FileContentDetector';

describe('FileContentDetector', () => {
  describe('detectBinaryContent', () => {
    test('应该检测包含null字节的内容为二进制', () => {
      const contentWithNull = 'Hello\0World';
      const result = FileContentDetector.detectBinaryContent(contentWithNull);

      expect(result.isBinary).toBe(true);
      expect(result.nullByteRatio).toBeGreaterThan(0);
    });

    test('应该检测包含不可打印字符的内容为二进制', () => {
      // 创建包含不可打印字符的Buffer
      const buffer = Buffer.from([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x1F, 0x57, 0x6F, 0x72, 0x6C, 0x64]);
      const result = FileContentDetector.detectBinaryContent(buffer);

      expect(result.isBinary).toBe(true);
      expect(result.nonPrintableRatio).toBeGreaterThan(0);
    });

    test('应该识别普通文本内容为非二进制', () => {
      const textContent = 'Hello World\nThis is a test file.\nWith multiple lines.';
      const result = FileContentDetector.detectBinaryContent(textContent);

      expect(result.isBinary).toBe(false);
      expect(result.nullByteRatio).toBe(0);
      expect(result.nonPrintableRatio).toBeLessThan(0.05);
    });

    test('应该处理包含控制字符的文本', () => {
      const textWithControls = 'Hello\tWorld\nTest\rContent';
      const result = FileContentDetector.detectBinaryContent(textWithControls);

      expect(result.isBinary).toBe(false);
      // TAB、LF、CR是允许的控制字符
    });

    test('应该限制检测的字节数', () => {
      // 创建一个大的二进制内容
      const largeBinary = Buffer.alloc(2048, 0);
      largeBinary[100] = 0; // 在中间位置添加null字节

      const result = FileContentDetector.detectBinaryContent(largeBinary, 1024);

      expect(result.bytesChecked).toBe(1024);
      expect(result.isBinary).toBe(true);
    });
  });

  describe('detectCodeContent', () => {
    test('应该检测JavaScript代码', () => {
      const jsCode = `
        function hello() {
          console.log('Hello World');
        }
        
        const test = () => {
          return 'test';
        };
      `;

      const result = FileContentDetector.detectCodeContent(jsCode);

      expect(result.isCode).toBe(true);
      expect(result.detectedLanguages).toContain('javascript');
      expect(result.matchedPatterns).toBeGreaterThan(0);
    });

    test('应该检测Python代码', () => {
      const pythonCode = `
def hello():
    print("Hello World")
    
class TestClass:
    def __init__(self):
        self.value = 42
      `;

      const result = FileContentDetector.detectCodeContent(pythonCode);

      expect(result.isCode).toBe(true);
      expect(result.detectedLanguages).toContain('python');
      expect(result.matchedPatterns).toBeGreaterThan(0);
    });

    test('应该检测TypeScript代码', () => {
      const tsCode = `
        interface TestInterface {
          name: string;
          value: number;
        }
        
        class TestClass implements TestInterface {
          constructor(public name: string, public value: number) {}
        }
      `;

      const result = FileContentDetector.detectCodeContent(tsCode);

      expect(result.isCode).toBe(true);
      expect(result.detectedLanguages).toContain('typescript');
    });

    test('应该识别非代码内容', () => {
      const plainText = `
        This is just a plain text file.
        It contains some sentences and paragraphs.
        No programming constructs here.
      `;

      const result = FileContentDetector.detectCodeContent(plainText);

      expect(result.isCode).toBe(false);
      expect(result.detectedLanguages).toHaveLength(0);
    });

    test('应该使用语言提示进行检测', () => {
      const code = 'def test(): pass';

      const resultWithoutHint = FileContentDetector.detectCodeContent(code);
      const resultWithHint = FileContentDetector.detectCodeContent(code, 'python');

      expect(resultWithHint.detectedLanguages).toContain('python');
      // 使用语言提示时应该至少匹配一个模式
      expect(resultWithHint.matchedPatterns).toBeGreaterThan(0);
    });
  });

  describe('detectLineEndingType', () => {
    test('应该检测CRLF换行符', () => {
      const content = 'Line 1\r\nLine 2\r\nLine 3';
      const result = FileContentDetector.detectLineEndingType(content);

      expect(result).toBe(LineEndingType.CRLF);
    });

    test('应该检测LF换行符', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const result = FileContentDetector.detectLineEndingType(content);

      expect(result).toBe(LineEndingType.LF);
    });

    test('应该检测CR换行符', () => {
      const content = 'Line 1\rLine 2\rLine 3';
      const result = FileContentDetector.detectLineEndingType(content);

      expect(result).toBe(LineEndingType.CR);
    });

    test('应该检测混合换行符', () => {
      const content = 'Line 1\nLine 2\r\nLine 3\rLine 4';
      const result = FileContentDetector.detectLineEndingType(content);

      expect(result).toBe(LineEndingType.MIXED);
    });
  });

  describe('detectIndentationType', () => {
    test('应该检测空格缩进', () => {
      const content = `
def function():
    print("Hello")
    if True:
        print("World")
      `;

      const result = FileContentDetector.detectIndentationType(content);

      expect(result.type).toBe(IndentType.SPACES);
      expect(result.size).toBeGreaterThanOrEqual(4); // 允许4或8，因为可能有不同的缩进模式
    });

    test('应该检测Tab缩进', () => {
      const content = `
def function():
\tprint("Hello")
\tif True:
\t\tprint("World")
      `;

      const result = FileContentDetector.detectIndentationType(content);

      expect(result.type).toBe(IndentType.TABS);
      expect(result.size).toBe(1);
    });

    test('应该检测混合缩进', () => {
      const content = `
def function():
    print("Hello")
\tprint("Mixed")
      `;

      const result = FileContentDetector.detectIndentationType(content);

      expect(result.type).toBe(IndentType.MIXED);
    });

    test('应该处理无缩进内容', () => {
      const content = 'Line 1\nLine 2\nLine 3';

      const result = FileContentDetector.detectIndentationType(content);

      expect(result.type).toBe(IndentType.NONE);
      expect(result.size).toBe(0);
    });

    test('应该检测缩进一致性', () => {
      const consistentContent = `
def function():
    print("Hello")
    if True:
        print("World")
        print("Test")
      `;

      const inconsistentContent = `
def function():
    print("Hello")
\tprint("Mixed")
        print("Inconsistent")
      `;

      const consistentResult = FileContentDetector.detectIndentationType(consistentContent);
      const inconsistentResult = FileContentDetector.detectIndentationType(inconsistentContent);

      expect(consistentResult.isConsistent).toBe(true);
      expect(inconsistentResult.isConsistent).toBe(false);
    });
  });

  describe('analyzeFileContent', () => {
    test('应该提供完整的文件内容分析', () => {
      const content = `
def hello():
    print("Hello World")

class TestClass:
    def __init__(self):
        self.value = 42
      `;

      const result = FileContentDetector.analyzeFileContent(content, 'python');

      expect(result.binaryDetection.isBinary).toBe(false);
      expect(result.codeDetection.isCode).toBe(true);
      expect(result.codeDetection.detectedLanguages).toContain('python');
      expect(result.lineEndingType).toBe(LineEndingType.LF);
      expect(result.indentDetection.type).toBe(IndentType.SPACES);
      expect(result.indentDetection.size).toBeGreaterThanOrEqual(4);
    });

    test('应该处理Buffer输入', () => {
      const buffer = Buffer.from('function test() { console.log("Hello"); }');

      const result = FileContentDetector.analyzeFileContent(buffer);

      expect(result.binaryDetection.isBinary).toBe(false);
      expect(result.codeDetection.isCode).toBe(true);
    });
  });

  describe('快速检测方法', () => {
    test('isBinaryContent应该返回布尔值', () => {
      expect(FileContentDetector.isBinaryContent('Hello\0World')).toBe(true);
      expect(FileContentDetector.isBinaryContent('Hello World')).toBe(false);
    });

    test('isCodeContent应该返回布尔值', () => {
      expect(FileContentDetector.isCodeContent('function test() {}')).toBe(true);
      expect(FileContentDetector.isCodeContent('Just plain text')).toBe(false);
    });
  });
});