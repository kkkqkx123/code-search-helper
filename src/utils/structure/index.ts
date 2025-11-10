import { BracketCounter } from './BracketCounter';
import { PythonIndentChecker } from './PythonIndentChecker';

export { BracketCounter } from './BracketCounter';
export { PythonIndentChecker } from './PythonIndentChecker';

// 提供统一的代码结构分析接口
export class StructureAnalyzer {
  /**
   * 根据语言选择合适的结构分析工具
   */
  static analyzeStructure(content: string, language: string) {
    switch (language) {
      case 'python':
        return {
          brackets: BracketCounter.calculateMaxNestingDepth(content),
          indents: PythonIndentChecker.calculateIndentStructure(content)
        };
      default:
        return {
          brackets: BracketCounter.calculateMaxNestingDepth(content),
          indents: null
        };
    }
  }
}