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

      const result = FileContentDetector.detectBinaryContent(largeBinary, undefined, 1024);

      expect(result.bytesChecked).toBe(1024);
      expect(result.isBinary).toBe(true);
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


  describe('analyzeFileContent', () => {
    test('应该提供完整的文件内容分析', () => {
      const content = `
def hello():
    print("Hello World")

class TestClass:
    def __init__(self):
        self.value = 42
      `;

      const result = FileContentDetector.analyzeFileContent(content);

      expect(result.binaryDetection.isBinary).toBe(false);
      expect(result.lineEndingType).toBe(LineEndingType.LF);
    });

    test('应该处理Buffer输入', () => {
      const buffer = Buffer.from('function test() { console.log("Hello"); }');

      const result = FileContentDetector.analyzeFileContent(buffer);

      expect(result.binaryDetection.isBinary).toBe(false);
    });
  });

  describe('快速检测方法', () => {
    test('isBinaryContent应该返回布尔值', () => {
      expect(FileContentDetector.isBinaryContent('Hello\0World')).toBe(true);
      expect(FileContentDetector.isBinaryContent('Hello World')).toBe(false);
    });
  });
});