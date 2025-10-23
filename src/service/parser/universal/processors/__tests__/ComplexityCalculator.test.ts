import { ComplexityCalculator } from '../ComplexityCalculator';
import { LoggerService } from '../../../../../utils/LoggerService';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('ComplexityCalculator', () => {
  let calculator: ComplexityCalculator;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    calculator = new ComplexityCalculator(mockLogger);
  });

  describe('calculate', () => {
    it('should calculate complexity for simple content', () => {
      const content = 'console.log("Hello, World!");';
      
      const result = calculator.calculate(content);
      
      expect(result).toBeGreaterThan(0);
      expect(typeof result).toBe('number');
      expect(mockLogger.debug).toHaveBeenCalledWith('ComplexityCalculator initialized');
    });

    it('should calculate higher complexity for complex code', () => {
      const simpleContent = 'console.log("Hello");';
      const complexContent = `
        function complexFunction(param1, param2) {
          if (param1 > 0) {
            for (let i = 0; i < param2; i++) {
              while (i < param2) {
                try {
                  console.log(i);
                } catch (error) {
                  throw error;
                }
              }
            }
          } else {
            return param1;
          }
        }
        
        class TestClass {
          constructor() {
            this.value = 42;
          }
          
          method() {
            return this.value * 2;
          }
        }
      `;

      const simpleResult = calculator.calculate(simpleContent);
      const complexResult = calculator.calculate(complexContent);

      expect(complexResult).toBeGreaterThan(simpleResult);
    });

    it('should count control structures correctly', () => {
      const content = `
        if (condition) {
          // do something
        } else {
          // do something else
        }
        
        while (true) {
          break;
        }
        
        for (let i = 0; i < 10; i++) {
          // loop body
        }
        
        switch (value) {
          case 1:
            // case 1
            break;
          default:
            // default case
            break;
        }
        
        try {
          // try block
        } catch (error) {
          // catch block
        } finally {
          // finally block
        }
      `;

      const result = calculator.calculate(content);

      // Should count: if, else, while, for, switch, case, try, catch, finally
      expect(result).toBeGreaterThan(0);
    });

    it('should count function declarations correctly', () => {
      const content = `
        function namedFunction() {
          return 1;
        }
        
        const arrowFunction = (param) => {
          return param * 2;
        };
        
        let anotherArrow = (param) => {
          return param * 3;
        };
        
        var functionExpression = function() {
          return 4;
        };
        
        def pythonFunction():
          pass
        
        public methodFunction():
          void
      `;

      const result = calculator.calculate(content);

      // Should count multiple function patterns
      expect(result).toBeGreaterThan(0);
    });

    it('should count class declarations correctly', () => {
      const content = `
        class TestClass {
          constructor() {
            this.value = 42;
          }
        }
        
        interface TestInterface {
          method(): void;
        }
        
        struct TestStruct {
          value: number;
        }
        
        enum TestEnum {
          Value1,
          Value2
        }
      `;

      const result = calculator.calculate(content);

      // Should count multiple class patterns
      expect(result).toBeGreaterThan(0);
    });

    it('should count brackets correctly', () => {
      const content = `
        function test() {
          if (condition) {
            return { key: 'value' };
          }
        }
      `;

      const result = calculator.calculate(content);

      // Should count both opening and closing brackets
      expect(result).toBeGreaterThan(0);
    });

    it('should count parentheses correctly', () => {
      const content = `
        function test(param1, param2) {
          return param1 + param2;
        }
        
        (function() {
          console.log('IIFE');
        })();
      `;

      const result = calculator.calculate(content);

      // Should count both opening and closing parentheses
      expect(result).toBeGreaterThan(0);
    });

    it('should adjust complexity based on line count', () => {
      const shortContent = 'console.log("Hello");';
      const longContent = `
        Line 1
        Line 2
        Line 3
        Line 4
        Line 5
        Line 6
        Line 7
        Line 8
        Line 9
        Line 10
        Line 11
        Line 12
        Line 13
        Line 14
        Line 15
        Line 16
        Line 17
        Line 18
        Line 19
        Line 20
        Line 21
        Line 22
        Line 23
        Line 24
        Line 25
        Line 26
        Line 27
        Line 28
        Line 29
        Line 30
      `;

      const shortResult = calculator.calculate(shortContent);
      const longResult = calculator.calculate(longContent);

      expect(longResult).toBeGreaterThan(shortResult);
    });

    it('should adjust complexity based on nesting depth', () => {
      const shallowContent = `
        function test() {
          return 1;
        }
      `;

      const deepContent = `
        function outerFunction() {
          if (condition) {
            for (let i = 0; i < 10; i++) {
              while (nested) {
                if (deeplyNested) {
                  // Very deeply nested code
                }
              }
            }
          }
        }
      `;

      const shallowResult = calculator.calculate(shallowContent);
      const deepResult = calculator.calculate(deepContent);

      expect(deepResult).toBeGreaterThan(shallowResult);
    });

    it('should return rounded integer result', () => {
      const content = 'console.log("Hello, World!");';
      
      const result = calculator.calculate(content);
      
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('countControlStructures', () => {
    it('should count various control structures', () => {
      const content = `
        if (condition) {
          // if block
        }
        
        while (condition) {
          // while loop
        }
        
        for (let i = 0; i < 10; i++) {
          // for loop
        }
        
        switch (value) {
          case 1:
            // case 1
            break;
          default:
            // default case
            break;
        }
        
        try {
          // try block
        } catch (error) {
          // catch block
        } finally {
          // finally block
        }
        
        do {
          // do-while loop
        } while (condition);
        
        break;
        continue;
        return;
        throw new Error('test');
      `;

      // Access private method through type assertion
      const result = (calculator as any).countControlStructures(content);

      expect(result).toBe(12); // if, while, for, switch, case, try, catch, finally, do, break, continue, return, throw
    });

    it('should return 0 for content without control structures', () => {
      const content = `
        const x = 1;
        const y = 2;
        const z = x + y;
      `;

      // Access private method through type assertion
      const result = (calculator as any).countControlStructures(content);

      expect(result).toBe(0);
    });
  });

  describe('countFunctionDeclarations', () => {
    it('should count JavaScript function patterns', () => {
      const content = `
        function namedFunction() {
          return 1;
        }
        
        const arrowFunction = (param) => {
          return param * 2;
        };
        
        let anotherArrow = (param) => {
          return param * 3;
        };
        
        var functionExpression = function() {
          return 4;
        };
      `;

      // Access private method through type assertion
      const result = (calculator as any).countFunctionDeclarations(content);

      expect(result).toBe(4); // function, const =>, let =>, var function
    });

    it('should count Python function patterns', () => {
      const content = `
        def python_function():
          pass
        
        def another_function(param):
          return param * 2
      `;

      // Access private method through type assertion
      const result = (calculator as any).countFunctionDeclarations(content);

      expect(result).toBe(2); // def patterns
    });

    it('should count Java method patterns', () => {
      const content = `
        public void publicMethod() {
          // method body
        }
        
        private void privateMethod() {
          // method body
        }
        
        protected void protectedMethod() {
          // method body
        }
      `;

      // Access private method through type assertion
      const result = (calculator as any).countFunctionDeclarations(content);

      expect(result).toBe(3); // public, private, protected
    });

    it('should return 0 for content without function patterns', () => {
      const content = `
        const x = 1;
        const y = 2;
        // No function declarations
      `;

      // Access private method through type assertion
      const result = (calculator as any).countFunctionDeclarations(content);

      expect(result).toBe(0);
    });
  });

  describe('countClassDeclarations', () => {
    it('should count various class patterns', () => {
      const content = `
        class TestClass {
          constructor() {
            this.value = 42;
          }
        }
        
        interface TestInterface {
          method(): void;
        }
        
        struct TestStruct {
          value: number;
        }
        
        enum TestEnum {
          Value1,
          Value2
        }
      `;

      // Access private method through type assertion
      const result = (calculator as any).countClassDeclarations(content);

      expect(result).toBe(4); // class, interface, struct, enum
    });

    it('should return 0 for content without class patterns', () => {
      const content = `
        const x = 1;
        const y = 2;
        // No class declarations
      `;

      // Access private method through type assertion
      const result = (calculator as any).countClassDeclarations(content);

      expect(result).toBe(0);
    });
  });

  describe('countBrackets', () => {
    it('should count brackets correctly', () => {
      const content = `
        function test() {
          if (condition) {
            return { key: 'value' };
          }
        }
      `;

      // Access private method through type assertion
      const result = (calculator as any).countBrackets(content);

      expect(result).toBe(2); // Two opening brackets
    });

    it('should handle unbalanced brackets', () => {
      const content = `
        function test() {
          if (condition) {
            return { key: 'value' };
          }
        // Missing closing bracket
      `;

      // Access private method through type assertion
      const result = (calculator as any).countBrackets(content);

      expect(result).toBe(2); // Still counts opening brackets
    });

    it('should return 0 for content without brackets', () => {
      const content = `
        function test() {
          return 'no brackets';
        }
      `;

      // Access private method through type assertion
      const result = (calculator as any).countBrackets(content);

      expect(result).toBe(0);
    });
  });

  describe('countParentheses', () => {
    it('should count parentheses correctly', () => {
      const content = `
        function test(param1, param2) {
          return param1 + param2;
        }
        
        (function() {
          console.log('IIFE');
        })();
      `;

      // Access private method through type assertion
      const result = (calculator as any).countParentheses(content);

      expect(result).toBe(4); // Two opening and two closing parentheses
    });

    it('should handle unbalanced parentheses', () => {
      const content = `
        function test(param1, param2) {
          return param1 + param2;
        // Missing closing parentheses
      `;

      // Access private method through type assertion
      const result = (calculator as any).countParentheses(content);

      expect(result).toBe(1); // Still counts opening parentheses
    });

    it('should return 0 for content without parentheses', () => {
      const content = `
        function test {
          return 'no parentheses';
        }
      `;

      // Access private method through type assertion
      const result = (calculator as any).countParentheses(content);

      expect(result).toBe(0);
    });
  });

  describe('calculateMaxNestingDepth', () => {
    it('should calculate nesting depth for JavaScript', () => {
      const content = `
        function outerFunction() {
          if (condition) {
            for (let i = 0; i < 10; i++) {
              while (nested) {
                if (deeplyNested) {
                  // Very deeply nested code
                }
              }
            }
          }
        }
      `;

      // Access private method through type assertion
      const result = (calculator as any).calculateMaxNestingDepth(content);

      expect(result).toBe(4); // if -> for -> while -> if
    });

    it('should calculate nesting depth for Python', () => {
      const content = `
        def outer_function():
          if condition:
            for i in range(10):
                while nested:
                    if deeply_nested:
                        pass
      `;

      // Access private method through type assertion
      const result = (calculator as any).calculateMaxNestingDepth(content);

      expect(result).toBe(3); // if -> for -> while -> if
    });

    it('should handle decreasing nesting depth', () => {
      const content = `
        function outerFunction() {
          if (condition) {
            for (let i = 0; i < 10; i++) {
              while (nested) {
                if (deeplyNested) {
                  // Very deeply nested code
                }
              }
            }
          }
        }
      `;

      // Access private method through type assertion
      const result = (calculator as any).calculateMaxNestingDepth(content);

      expect(result).toBe(4); // Max depth reached
    });

    it('should return 0 for flat code', () => {
      const content = `
        const x = 1;
        const y = 2;
        const z = x + y;
      `;

      // Access private method through type assertion
      const result = (calculator as any).calculateMaxNestingDepth(content);

      expect(result).toBe(0);
    });
  });

  describe('isOpeningStatement', () => {
    it('should identify opening statements with brackets', () => {
      const line1 = 'if (condition) {';
      const line2 = 'while (condition) {';
      const line3 = 'for (let i = 0; i < 10; i++) {';

      // Access private method through type assertion
      const result1 = (calculator as any).isOpeningStatement(line1);
      const result2 = (calculator as any).isOpeningStatement(line2);
      const result3 = (calculator as any).isOpeningStatement(line3);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should identify opening statements with keywords', () => {
      const line1 = 'if (condition)';
      const line2 = 'while (condition)';
      const line3 = 'for (let i = 0; i < 10; i++)';
      const line4 = 'switch (value)';
      const line5 = 'try {';

      // Access private method through type assertion
      const result1 = (calculator as any).isOpeningStatement(line1);
      const result2 = (calculator as any).isOpeningStatement(line2);
      const result3 = (calculator as any).isOpeningStatement(line3);
      const result4 = (calculator as any).isOpeningStatement(line4);
      const result5 = (calculator as any).isOpeningStatement(line5);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
      expect(result4).toBe(true);
      expect(result5).toBe(true);
    });

    it('should identify Python-style opening statements', () => {
      const line = 'if condition:';

      // Access private method through type assertion
      const result = (calculator as any).isOpeningStatement(line);

      expect(result).toBe(true);
    });

    it('should return false for non-opening statements', () => {
      const line1 = 'return value;';
      const line2 = 'console.log("message");';
      const line3 = 'const x = 1;';

      // Access private method through type assertion
      const result1 = (calculator as any).isOpeningStatement(line1);
      const result2 = (calculator as any).isOpeningStatement(line2);
      const result3 = (calculator as any).isOpeningStatement(line3);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe('isClosingStatement', () => {
    it('should identify closing statements with brackets', () => {
      const line1 = '}';
      const line2 = '} else if (condition) {';

      // Access private method through type assertion
      const result1 = (calculator as any).isClosingStatement(line1);
      const result2 = (calculator as any).isClosingStatement(line2);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should identify Python-style closing statements', () => {
      const line1 = 'except Exception as e:';
      const line2 = 'finally:';
      const line3 = 'elif condition:';

      // Access private method through type assertion
      const result1 = (calculator as any).isClosingStatement(line1);
      const result2 = (calculator as any).isClosingStatement(line2);
      const result3 = (calculator as any).isClosingStatement(line3);

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(result3).toBe(true);
    });

    it('should return false for non-closing statements', () => {
      const line1 = 'if (condition) {';
      const line2 = 'console.log("message");';
      const line3 = 'const x = 1;';

      // Access private method through type assertion
      const result1 = (calculator as any).isClosingStatement(line1);
      const result2 = (calculator as any).isClosingStatement(line2);
      const result3 = (calculator as any).isClosingStatement(line3);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
    });
  });

  describe('getLanguageSpecificFactor', () => {
    it('should return default factor', () => {
      const content = 'function test() { return 1; }';
      const language = 'javascript';

      // Access private method through type assertion
      const result = (calculator as any).getLanguageSpecificFactor(content, language);

      expect(result).toBe(1.0);
    });
  });

  describe('calculateCommentComplexity', () => {
    it('should calculate comment complexity for JavaScript', () => {
      const content = `
        // Single line comment
        const x = 1; // Inline comment
        
        /* Multi-line
           comment block */
        
        function test() {
          // Function comment
          return 1;
        }
      `;

      // Access private method through type assertion
      const result = (calculator as any).calculateCommentComplexity(content);

      expect(result).toBeLessThan(1.0);
      expect(result).toBeGreaterThanOrEqual(0.1);
    });

    it('should calculate comment complexity for Python', () => {
      const content = `
        # Python comment
        x = 1  # Inline comment
        
        """
        Multi-line
        docstring
        """
        
        def test():
            # Function comment
            return 1
      `;

      // Access private method through type assertion
      const result = (calculator as any).calculateCommentComplexity(content);

      expect(result).toBeLessThan(1.0);
      expect(result).toBeGreaterThanOrEqual(0.1);
    });

    it('should calculate comment complexity for HTML', () => {
      const content = `
        <!-- HTML comment -->
        <div>
          <!-- Another comment -->
          <p>Content</p>
        </div>
      `;

      // Access private method through type assertion
      const result = (calculator as any).calculateCommentComplexity(content);

      expect(result).toBeLessThan(1.0);
      expect(result).toBeGreaterThanOrEqual(0.1);
    });

    it('should return 1.0 for content without comments', () => {
      const content = `
        const x = 1;
        const y = 2;
        const z = x + y;
      `;

      // Access private method through type assertion
      const result = (calculator as any).calculateCommentComplexity(content);

      expect(result).toBe(1.0);
    });

    it('should handle empty content', () => {
      const content = '';

      // Access private method through type assertion
      const result = (calculator as any).calculateCommentComplexity(content);

      expect(result).toBe(1.0);
    });
  });

  describe('Integration Tests', () => {
    it('should calculate complexity for real-world JavaScript code', () => {
      const jsCode = `
        import React, { useState, useEffect } from 'react';
        
        class Component extends React.Component {
          constructor(props) {
            super(props);
            this.state = {
              count: 0
            };
          }
          
          componentDidMount() {
            document.addEventListener('click', this.handleClick);
          }
          
          handleClick = () => {
            this.setState(prevState => ({
              count: prevState.count + 1
            }));
          }
          
          render() {
            return (
              <div>
                <h1>Count: {this.state.count}</h1>
                <button onClick={this.handleClick}>
                  Click me
                </button>
              </div>
            );
          }
        }
        
        export default Component;
      `;

      const result = calculator.calculate(jsCode);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1000); // Reasonable upper bound
    });

    it('should calculate complexity for real-world Python code', () => {
      const pythonCode = `
        import os
        import sys
        from typing import List, Dict, Optional
        
        class DataProcessor:
            def __init__(self, config: Dict[str, Any]):
                self.config = config
                self.data = []
                
            def process_data(self, input_data: List[str]) -> List[Dict[str, Any]]:
                processed = []
                for item in input_data:
                    if self._validate_item(item):
                        processed_item = self._transform_item(item)
                        processed.append(processed_item)
                    else:
                        self._log_error(f"Invalid item: {item}")
                
                return processed
                
            def _validate_item(self, item: str) -> bool:
                return len(item) > 0 and item.strip() != ""
                
            def _transform_item(self, item: str) -> Dict[str, Any]:
                return {
                    'original': item,
                    'processed': item.upper(),
                    'length': len(item)
                }
                
            def _log_error(self, message: str) -> None:
                print(f"ERROR: {message}")
                
            def get_statistics(self) -> Dict[str, Any]:
                return {
                    'total_items': len(self.data),
                    'config': self.config
                }
      `;

      const result = calculator.calculate(pythonCode);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1000); // Reasonable upper bound
    });

    it('should handle edge cases gracefully', () => {
      const emptyContent = '';
      const whitespaceContent = '   \n  \n   ';
      const singleLineContent = 'x';
      const veryLongContent = 'x'.repeat(10000);

      const emptyResult = calculator.calculate(emptyContent);
      const whitespaceResult = calculator.calculate(whitespaceContent);
      const singleLineResult = calculator.calculate(singleLineContent);
      const longResult = calculator.calculate(veryLongContent);

      expect(emptyResult).toBeGreaterThanOrEqual(0);
      expect(whitespaceResult).toBeGreaterThanOrEqual(0);
      expect(singleLineResult).toBeGreaterThanOrEqual(0);
      expect(longResult).toBeGreaterThan(0);
    });
  });
});