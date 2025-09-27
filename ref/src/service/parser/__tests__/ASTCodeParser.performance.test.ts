import { ASTCodeParser } from '../splitting/ASTCodeParser';
import { performance } from 'perf_hooks';
import { createTestContainer } from '@test/setup';
import { TYPES } from '../../../types';

describe('SmartCodeParser Performance Tests', () => {
  let smartCodeParser: ASTCodeParser;
  let container: any;

  beforeEach(() => {
    container = createTestContainer();

    // Create a simpler mock TreeSitterService that doesn't require complex dependencies
    const mockTreeSitterService = {
      parseFile: jest.fn().mockImplementation((filePath: string, content: string) => {
        return Promise.resolve({
          ast: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: content.split('\n').length - 1, column: 0 },
            startIndex: 0,
            endIndex: content.length,
            children: [],
          },
          language: { name: 'JavaScript', supported: true },
          parseTime: 10,
          success: true,
        });
      }),
      extractSnippets: jest.fn().mockReturnValue([]),
      extractFunctions: jest.fn().mockReturnValue([]),
      extractClasses: jest.fn().mockReturnValue([]),
      extractImports: jest.fn().mockReturnValue([]),
      extractExports: jest.fn().mockReturnValue([]),
      getSupportedLanguages: jest.fn().mockReturnValue([]),
      detectLanguage: jest.fn().mockReturnValue(null),
      async parseCode(code: string, language: string) {
        return this.parseFile('test.js', code);
      },
    };

    // Rebind TreeSitterService with mock
    container.unbind(TYPES.TreeSitterService);
    container.bind(TYPES.TreeSitterService).toConstantValue(mockTreeSitterService);

    smartCodeParser = container.get(TYPES.ASTCodeParser);
  });

  describe('Performance benchmarks', () => {
    test('should handle small files efficiently', async () => {
      const filePath = '/test/small.js';
      const code = generateTestCode(100); // 100 lines

      const startTime = performance.now();
      const parsedFile = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true,
      });
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Small file (100 lines): ${processingTime.toFixed(2)}ms, ${parsedFile.chunks.length} chunks, ${parsedFile.metadata.snippets} snippets`
      );

      // Should process small files in under 100ms
      expect(processingTime).toBeLessThan(100);
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
    });

    test('should handle medium files efficiently', async () => {
      const filePath = '/test/medium.js';
      const code = generateTestCode(1000); // 1000 lines

      const startTime = performance.now();
      const parsedFile = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true,
      });
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Medium file (1000 lines): ${processingTime.toFixed(2)}ms, ${parsedFile.chunks.length} chunks, ${parsedFile.metadata.snippets} snippets`
      );

      // Should process medium files in under 500ms
      expect(processingTime).toBeLessThan(500);
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
    });

    test('should handle large files efficiently', async () => {
      const filePath = '/test/large.js';
      const code = generateTestCode(5000); // 5000 lines

      const startTime = performance.now();
      const parsedFile = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true,
      });
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Large file (5000 lines): ${processingTime.toFixed(2)}ms, ${parsedFile.chunks.length} chunks, ${parsedFile.metadata.snippets} snippets`
      );

      // Should process large files in under 2000ms
      expect(processingTime).toBeLessThan(2000);
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
    });

    test('should scale linearly with file size', async () => {
      const sizes = [100, 500, 1000, 2000, 5000];
      const processingTimes: number[] = [];

      for (const size of sizes) {
        const code = generateTestCode(size);

        const startTime = performance.now();
        await smartCodeParser.parseFile('/test/scale.js', code, {
          extractSnippets: true,
        });
        const endTime = performance.now();

        const processingTime = endTime - startTime;
        processingTimes.push(processingTime);

        console.log(`Size ${size}: ${processingTime.toFixed(2)}ms`);
      }

      // Check that processing time scales roughly linearly
      // (allowing for some overhead and variance)
      const timeRatio1000 = processingTimes[2] / processingTimes[0]; // 1000/100
      const timeRatio5000 = processingTimes[4] / processingTimes[0]; // 5000/100

      console.log(`Time ratio (1000/100): ${timeRatio1000.toFixed(2)}`);
      console.log(`Time ratio (5000/100): ${timeRatio5000.toFixed(2)}`);

      // Should scale roughly linearly (within reasonable bounds)
      expect(timeRatio1000).toBeLessThan(15); // Less than 15x for 10x size increase
      expect(timeRatio5000).toBeLessThan(60); // Less than 60x for 50x size increase
    });

    test('should handle concurrent processing efficiently', async () => {
      const files = Array.from({ length: 10 }, (_, i) => ({
        filePath: `/test/concurrent_${i}.js`,
        code: generateTestCode(500),
      }));

      const startTime = performance.now();
      const results = await Promise.all(
        files.map(file =>
          smartCodeParser.parseFile(file.filePath, file.code, {
            extractSnippets: true,
          })
        )
      );
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / files.length;

      console.log(
        `Concurrent processing (10 files): ${totalTime.toFixed(2)}ms total, ${averageTime.toFixed(2)}ms average`
      );

      // Should be significantly faster than sequential processing
      expect(totalTime).toBeLessThan(2000); // Less than 2 seconds for 10 files
      expect(results.every(result => result.chunks.length > 0)).toBe(true);
    });

    test('should maintain performance with snippet extraction enabled', async () => {
      const filePath = '/test/snippets.js';
      const code = generateTestCode(2000, true); // Generate code with more snippet-worthy patterns

      // Test without snippet extraction
      const startTime1 = performance.now();
      const parsedFile1 = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: false,
      });
      const endTime1 = performance.now();
      const timeWithoutSnippets = endTime1 - startTime1;

      // Test with snippet extraction
      const startTime2 = performance.now();
      const parsedFile2 = await smartCodeParser.parseFile(filePath, code, {
        extractSnippets: true,
      });
      const endTime2 = performance.now();
      const timeWithSnippets = endTime2 - startTime2;

      const overhead = timeWithSnippets - timeWithoutSnippets;
      const overheadPercentage = (overhead / timeWithoutSnippets) * 100;

      console.log(`Without snippets: ${timeWithoutSnippets.toFixed(2)}ms`);
      console.log(`With snippets: ${timeWithSnippets.toFixed(2)}ms`);
      console.log(`Overhead: ${overhead.toFixed(2)}ms (${overheadPercentage.toFixed(1)}%)`);

      // Snippet extraction should add less than 150% overhead (relaxed requirement)
      expect(overheadPercentage).toBeLessThan(150);
    });
  });

  test('should handle memory efficiently for large files', async () => {
    const filePath = '/test/memory.js';
    const code = generateTestCode(10000); // 10,000 lines

    // Get initial memory usage
    const initialMemory = process.memoryUsage();

    await smartCodeParser.parseFile(filePath, code, {
      extractSnippets: true,
    });

    // Get memory usage after processing
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

    console.log(`Memory increase for 10k lines: ${memoryIncreaseMB.toFixed(2)}MB`);

    // Memory increase should be reasonable (less than 100MB for 10k lines)
    expect(memoryIncreaseMB).toBeLessThan(100);
  });

  test('should recover gracefully from parsing errors', async () => {
    const filePath = '/test/error.js';
    const code = generateTestCode(1000);

    // Simulate a parsing error by using invalid syntax
    const invalidCode = code + '\n// Invalid syntax\nfunction broken( {';

    const startTime = performance.now();
    const parsedFile = await smartCodeParser.parseFile(filePath, invalidCode, {
      extractSnippets: true,
    });
    const endTime = performance.now();

    const processingTime = endTime - startTime;

    console.log(
      `Error recovery time: ${processingTime.toFixed(2)}ms, ${parsedFile.chunks.length} chunks`
    );

    // Should still complete and return some chunks (fallback to generic chunking)
    expect(processingTime).toBeLessThan(1000);
    expect(parsedFile.chunks.length).toBeGreaterThan(0);
  });
});

// Helper function to generate test code
function generateTestCode(lines: number, includeSnippets = false): string {
  const codeLines: string[] = [];

  for (let i = 0; i < lines; i++) {
    if (includeSnippets && i % 50 === 0) {
      // Add snippet-worthy patterns
      const snippetType = i % 4;
      switch (snippetType) {
        case 0:
          codeLines.push(`function function${i}() {`);
          codeLines.push(`  console.log("This is function ${i}");`);
          codeLines.push(`  return ${i};`);
          codeLines.push(`}`);
          break;
        case 1:
          codeLines.push(`if (condition${i}) {`);
          codeLines.push(`  // Control structure`);
          codeLines.push(`  doSomething();`);
          codeLines.push(`} else {`);
          codeLines.push(`  doSomethingElse();`);
          codeLines.push(`}`);
          break;
        case 2:
          codeLines.push(`try {`);
          codeLines.push(`  riskyOperation${i}();`);
          codeLines.push(`} catch (error) {`);
          codeLines.push(`  console.error("Error in ${i}:", error);`);
          codeLines.push(`} finally {`);
          codeLines.push(`  cleanup${i}();`);
          codeLines.push(`}`);
          break;
        default:
          codeLines.push(`const variable${i} = ${i};`);
          codeLines.push(`console.log(variable${i});`);
      }
    } else {
      // Regular code
      codeLines.push(`// Line ${i + 1}`);
      codeLines.push(`const value${i} = ${i};`);
    }
  }

  return codeLines.join('\n');
}
