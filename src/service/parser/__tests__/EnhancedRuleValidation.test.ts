import { ControlStructureRule } from '../treesitter-rule/core/ControlStructureRule';
import { ErrorHandlingRule } from '../treesitter-rule/core/ErrorHandlingRule';
import { SnippetValidationService } from '../analysis/SnippetValidationService';

// Mock tree-sitter node
const createMockNode = (type: string, text: string, startLine = 1, endLine = 1) => ({
  type,
  text,
  startPosition: { row: startLine - 1, column: 0 },
  endPosition: { row: endLine - 1, column: text.length },
  startIndex: 0,
  endIndex: text.length,
  children: [],
  parent: null,
  childForFieldName: jest.fn(),
});

describe('Enhanced Rule Validation', () => {
  describe('ControlStructureRule with Enhanced Validation', () => {
    let rule: ControlStructureRule;

    beforeEach(() => {
      rule = new ControlStructureRule();
    });

    it('should filter overly simple if statements', () => {
      const simpleIf = createMockNode('if_statement', `if (true) console.log('hello');`);
      const sourceCode = `if (true) console.log('hello');`;

      // Temporarily set environment to production to test strict validation
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        // Check if the simple if statement would be rejected
        const isValid = SnippetValidationService.enhancedIsValidSnippet(
          sourceCode,
          'control_structure'
        );
        expect(isValid).toBe(false);
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should retain meaningful control structures', () => {
      const meaningfulIf = `if (user.isAuthenticated && user.hasPermission('read')) {
        const data = await fetchUserData(user.id);
        return processData(data);
      }`;

      const isValid = SnippetValidationService.enhancedIsValidSnippet(
        meaningfulIf,
        'control_structure'
      );
      expect(isValid).toBe(true);
    });

    it('should reject control structures with only comments', () => {
      const commentedIf = `if (condition) {
        /* comment */
        // another comment
      }`;

      const isValid = SnippetValidationService.enhancedIsValidSnippet(
        commentedIf,
        'control_structure'
      );
      expect(isValid).toBe(false);
    });

    it('should validate nested control structures', () => {
      const nestedControl = `if (condition1) {
        if (condition2) {
          while (condition3) {
            console.log('nested');
          }
        }
      }`;

      const isValid = SnippetValidationService.enhancedIsValidSnippet(
        nestedControl,
        'control_structure'
      );
      expect(isValid).toBe(true);
    });
  });

  describe('ErrorHandlingRule with Enhanced Validation', () => {
    let rule: ErrorHandlingRule;

    beforeEach(() => {
      rule = new ErrorHandlingRule();
    });

    it('should filter overly simple try-catch blocks', () => {
      const simpleTryCatch = `try {} catch (e) {}`;

      // Temporarily set environment to production to test strict validation
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const isValid = SnippetValidationService.enhancedIsValidSnippet(
          simpleTryCatch,
          'error_handling'
        );
        expect(isValid).toBe(false);
      } finally {
        // Restore original environment
        process.env.NODE_ENV = originalNodeEnv;
      }
    });

    it('should retain meaningful error handling', () => {
      const meaningfulErrorHandling = `try {
        const result = await fetchData();
        if (!result.success) {
          throw new Error('Operation failed');
        }
        return result.data;
      } catch (error) {
        logger.error('Failed to fetch data:', error);
        throw new CustomError('Data fetch failed', error);
      }`;

      const isValid = SnippetValidationService.enhancedIsValidSnippet(
        meaningfulErrorHandling,
        'error_handling'
      );
      expect(isValid).toBe(true);
    });

    it('should validate throw statements with context', () => {
      const throwWithDetails = `if (!user.isAuthenticated) {
        throw new AuthenticationError('User not authenticated', {
          userId: user.id,
          timestamp: new Date()
        });
      }`;

      const isValid = SnippetValidationService.enhancedIsValidSnippet(
        throwWithDetails,
        'error_handling'
      );
      expect(isValid).toBe(true);
    });
  });

  describe('Language-Specific Validation', () => {
    it('should validate TypeScript-specific features', () => {
      const tsCode = `interface User {
        id: string;
        name: string;
      }
      
      function getUserById(id: string): Promise<User> {
        return database.query<User>('SELECT * FROM users WHERE id = ?', [id]);
      }`;

      const isValid = SnippetValidationService.enhancedIsValidSnippet(
        tsCode,
        'logic_block',
        'typescript'
      );
      expect(isValid).toBe(true);
    });

    it('should validate Python-specific features', () => {
      const pythonCode = `def process_data(data: List[Dict[str, Any]]) -> Dict[str, Any]:
        result = {}
        for item in data:
            key = item.get('key')
            if key and isinstance(key, str):
                result[key] = item.get('value')
        return result`;

      const isValid = SnippetValidationService.hasMeaningfulLogic(pythonCode, 'python');
      expect(isValid).toBe(true);
    });

    it('should validate Java-specific features', () => {
      const javaCode = `public class DataProcessor {
        private final Logger logger = LoggerFactory.getLogger(DataProcessor.class);
        
        public Optional<Data> processData(Optional<Input> input) {
            return input.flatMap(this::validateInput)
                       .map(this::transformData)
                       .peek(data -> logger.info("Processed data: {}", data));
        }
      }`;

      const isValid = SnippetValidationService.hasMeaningfulLogic(javaCode, 'java');
      expect(isValid).toBe(true);
    });
  });

  describe('Complexity Threshold Validation', () => {
    it('should reject code that is too simple', () => {
      const tooSimple = `x = 5;`;

      const meetsThreshold = SnippetValidationService.meetsComplexityThreshold(tooSimple, 3, 30);
      expect(meetsThreshold).toBe(false);
    });

    it('should accept code that meets complexity requirements', () => {
      const sufficientComplexity = `function calculateSum(numbers) {
        let sum = 0;
        for (let i = 0; i < numbers.length; i++) {
          sum += numbers[i];
        }
        return sum;
      }`;

      const meetsThreshold =
        SnippetValidationService.meetsComplexityThreshold(sufficientComplexity);
      expect(meetsThreshold).toBe(true);
    });

    it('should calculate complexity correctly for nested structures', () => {
      const nestedCode = `if (condition1) {
        if (condition2) {
          for (let i = 0; i < 10; i++) {
            while (condition3) {
              console.log(i);
            }
          }
        }
      }`;

      const complexity = SnippetValidationService.calculateComplexity(nestedCode);
      expect(complexity).toBeGreaterThan(5);
    });
  });

  describe('Code Diversity Validation', () => {
    it('should reject repetitive code patterns', () => {
      const repetitiveCode = `test test test test test test`;

      const hasDiversity = SnippetValidationService.hasCodeDiversity(repetitiveCode);
      expect(hasDiversity).toBe(false);
    });

    it('should accept diverse code patterns', () => {
      const diverseCode = `const result = data.map(item => ({
        id: item.id,
        value: item.value * 2,
        processed: true
      })).filter(item => item.value > 0);`;

      const hasDiversity = SnippetValidationService.hasCodeDiversity(diverseCode);
      expect(hasDiversity).toBe(true);
    });
  });

  describe('Language Feature Detection', () => {
    it('should detect async/await usage', () => {
      const asyncCode = `async function fetchData() {
        const response = await fetch('/api/data');
        return response.json();
      }`;

      const features = SnippetValidationService.analyzeLanguageFeatures(asyncCode);
      expect(features.usesAsync).toBe(true);
    });

    it('should detect destructuring patterns', () => {
      const destructuringCode = `const { data, error } = await fetchData();
      const [first, second, ...rest] = items;`;

      const features = SnippetValidationService.analyzeLanguageFeatures(destructuringCode);
      expect(features.usesDestructuring).toBe(true);
    });

    it('should detect template literals', () => {
      const templateCode = `const message = \`Hello \${name}, you have \${count} messages\`;`;

      const features = SnippetValidationService.analyzeLanguageFeatures(templateCode);
      expect(features.usesTemplateLiterals).toBe(true);
    });

    it('should detect spread operator usage', () => {
      const spreadCode = `const combined = [...firstArray, ...secondArray];
      const cloned = { ...originalObject };`;

      const features = SnippetValidationService.analyzeLanguageFeatures(spreadCode);
      expect(features.usesSpread).toBe(true);
    });
  });

  describe('Standalone Snippet Detection', () => {
    it('should identify standalone control structures', () => {
      const standaloneControl = `if (user.isAdmin) {
        return adminView();
      } else {
        return userView();
      }`;

      const isStandalone = SnippetValidationService.isStandaloneSnippet(
        standaloneControl,
        'control_structure'
      );
      expect(isStandalone).toBe(true);
    });

    it('should identify incomplete control structures', () => {
      const incompleteControl = `if (condition)`;

      const isStandalone = SnippetValidationService.isStandaloneSnippet(
        incompleteControl,
        'control_structure'
      );
      expect(isStandalone).toBe(false);
    });
  });

  describe('Side Effect Detection', () => {
    it('should detect assignment operations', () => {
      const assignmentCode = `x = 5;
      obj.property = 'value';`;

      const hasSideEffects = SnippetValidationService.hasSideEffects(assignmentCode);
      expect(hasSideEffects).toBe(true);
    });

    it('should detect increment/decrement operations', () => {
      const incrementCode = `counter++;
      --count;`;

      const hasSideEffects = SnippetValidationService.hasSideEffects(incrementCode);
      expect(hasSideEffects).toBe(true);
    });

    it('should detect method calls with side effects', () => {
      const sideEffectCode = `console.log('test');
      process.exit(0);`;

      const hasSideEffects = SnippetValidationService.hasSideEffects(sideEffectCode);
      expect(hasSideEffects).toBe(true);
    });

    it('should not detect pure expressions as side effects', () => {
      const pureCode = `Math.max(1, 2);
      const result = array.map(x => x * 2);`;

      const hasSideEffects = SnippetValidationService.hasSideEffects(pureCode);
      expect(hasSideEffects).toBe(false);
    });
  });
});
