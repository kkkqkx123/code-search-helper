import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * pytest Framework Rule - Identifies pytest test files, fixtures, and patterns
 */
export class PytestRule extends AbstractSnippetRule {
  readonly name = 'PytestRule';
  readonly supportedNodeTypes = new Set([
    // Test functions
    'function_definition',
    'decorated_definition',

    // Decorators
    'decorator',
    'argument_list',

    // Class definitions
    'class_definition',

    // Import statements
    'import_statement',
    'import_from_statement',

    // Assignment and expressions
    'assignment',
    'call_expression',
    'expression_statement',
    'assert_statement',
  ]);

  protected readonly snippetType = 'pytest_test' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check if this is pytest-related code
    return this.isPytestCode(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const pytestMetadata = this.extractPytestMetadata(node, content, sourceCode);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractPytestImports(node, sourceCode),
      exports: this.extractPytestExports(node, sourceCode),
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculatePytestComplexity(content),
        isStandalone: this.isStandalonePytestTest(node, content),
        hasSideEffects: this.hasSideEffects(content),
        pytestInfo: pytestMetadata,
      },
    };
  }

  private isPytestCode(content: string): boolean {
    const pytestPatterns = [
      // pytest imports
      /import\s+pytest/,
      /from\s+pytest\s+import/,
      /import\s+.*\bpytest\b/,

      // pytest decorators
      /@pytest\.fixture/,
      /@pytest\.mark\.(\w+)/,
      /@pytest\.raises/,
      /@pytest\.parametrize/,

      // Test function patterns
      /def\s+test_/,
      /class\s+Test/,
      /def\s+setup_method/,
      /def\s+teardown_method/,

      // pytest fixtures and parameters
      /fixture\s*\(/,
      /parametrize\s*\(/,
      /yield\s+fixture/,

      // Pytest assertions and utilities
      /assert\s+/,
      /pytest\.assert/,
      /pytest\.approx/,
      /pytest\.warns/,
      /pytest\.fail/,

      // Pytest configuration
      /conftest\.py/,
      /pytest\.ini/,
      /pyproject\.toml/,
      /setup\.cfg/,

      // Pytest markers
      /@pytest\.mark\.slow/,
      /@pytest\.mark\.unit/,
      /@pytest\.mark\.integration/,
      /@pytest\.mark\.smoke/,

      // Pytest plugins and utilities
      /pytest-mock/,
      /pytest-cov/,
      /pytest-asyncio/,
      /pytest-xdist/,

      // Common testing patterns
      /monkeypatch/,
      /tmp_path/,
      /capsys/,
      /capfd/,
      /caplog/,
      /recwarn/,

      // Async test patterns
      /@pytest\.mark\.asyncio/,
      /async\s+def\s+test_/,
    ];

    return pytestPatterns.some(pattern => pattern.test(content));
  }

  private extractPytestMetadata(node: Parser.SyntaxNode, content: string, sourceCode: string) {
    return {
      testStructure: this.extractTestStructure(content),
      patterns: this.extractPytestPatterns(content),
      mocking: this.extractMockingInfo(content),
      configuration: this.extractConfigurationInfo(content),
      assertions: this.extractAssertionsInfo(content),
      fixtures: this.extractFixturesInfo(content),
    };
  }

  private extractTestStructure(content: string) {
    const fixtures = this.extractPatternMatches(content, [
      /@pytest\.fixture\s*\(\s*([^)]*)\s*\)\s*\ndef\s+(\w+)/g,
      /def\s+(\w+)\s*\([^)]*fixture[^)]*\)/g,
    ]);

    const parametrizedTests = (content.match(/@pytest\.mark\.parametrize/g) || []).length;
    const testCases = (content.match(/def\s+test_\w+/g) || []).length;
    const testModules = (content.match(/class\s+Test\w+/g) || []).length;

    return {
      fixtures,
      parametrizedTests,
      testCases,
      testModules,
    };
  }

  private extractPytestPatterns(content: string) {
    const usesPytestFixtures = /@pytest\.fixture|fixture\s*\(/.test(content);
    const usesMarkers = /@pytest\.mark\./.test(content);
    const usesMocking = /mock|patch|Mock|Mocker/.test(content);
    const usesAsserts = /assert\s+/.test(content);
    const usesFixturesScope = /scope\s*=\s*['"]\w+['"]/.test(content);

    return {
      usesPytestFixtures,
      usesMarkers,
      usesMocking,
      usesAsserts,
      usesFixturesScope,
    };
  }

  private extractMockingInfo(content: string) {
    const mockObjects = this.extractPatternMatches(content, [
      /mock\.Mock\s*\(\s*\)/g,
      /Mock\s*\(\s*\)/g,
      /MagicMock\s*\(\s*\)/g,
    ]);

    const patchCalls = this.extractPatternMatches(content, [
      /patch\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /monkeypatch\.setattr\s*\(/g,
      /monkeypatch\.setattr\s*\(/g,
    ]);

    const spyUsage = /spy|Spy/.test(content);
    const sideEffects = /side_effect|return_value/.test(content);

    return {
      mockObjects,
      patchCalls,
      spyUsage,
      sideEffects,
    };
  }

  private extractConfigurationInfo(content: string) {
    const customConfig = /pytest\.ini|pyproject\.toml|setup\.cfg/.test(content);
    const commandLineArgs = this.extractPatternMatches(content, [
      /pytest\s+([^'\n]+)\s*--/g,
      /--(\w+)=?(\w*)/g,
    ]);

    const environmentVariables = this.extractPatternMatches(content, [
      /os\.environ\.get\s*\(\s*['"`](\w+)['"`]\s*\)/g,
      /environ\[['"`](\w+)['"`]\]/g,
    ]);

    const conftestPyUsed = /conftest\.py|def\s+(conftest|pytest_)/.test(content);

    return {
      customConfig,
      commandLineArgs,
      environmentVariables,
      conftestPyUsed,
    };
  }

  private extractAssertionsInfo(content: string) {
    const assertCount = (content.match(/assert\s+/g) || []).length;
    const customAssertions = /def\s+assert_\w+/.test(content);
    const exceptionTesting = /with\s+pytest\.raises|raises\s*\(/.test(content);
    const warningTesting = /with\s+pytest\.warns|warns\s*\(/.test(content);

    return {
      assertCount,
      customAssertions,
      exceptionTesting,
      warningTesting,
    };
  }

  private extractFixturesInfo(content: string) {
    const autouseFixtures = this.extractPatternMatches(content, [
      /@pytest\.fixture\s*\([^)]*autouse[^)]*\)\s*def\s+(\w+)/g,
    ]);

    const sessionFixtures = this.extractPatternMatches(content, [
      /@pytest\.fixture\s*\([^)]*scope\s*=\s*['"`]session['"`][^)]*\)\s*def\s+(\w+)/g,
    ]);

    const moduleFixtures = this.extractPatternMatches(content, [
      /@pytest\.fixture\s*\([^)]*scope\s*=\s*['"`]module['"`][^)]*\)\s*def\s+(\w+)/g,
    ]);

    const classFixtures = this.extractPatternMatches(content, [
      /@pytest\.fixture\s*\([^)]*scope\s*=\s*['"`]class['"`][^)]*\)\s*def\s+(\w+)/g,
    ]);

    const functionFixtures = this.extractPatternMatches(content, [
      /@pytest\.fixture\s*\([^)]*scope\s*=\s*['"`]function['"`][^)]*\)\s*def\s+(\w+)/g,
      /@pytest\.fixture\s*\(\s*\)\s*def\s+(\w+)/g,
    ]);

    return {
      autouseFixtures,
      sessionFixtures,
      moduleFixtures,
      classFixtures,
      functionFixtures,
    };
  }

  private extractPatternMatches(content: string, patterns: RegExp[]): string[] {
    const matches: string[] = [];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          matches.push(match[1]);
        }
      }
    });

    return [...new Set(matches)];
  }

  private extractPytestImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement' || n.type === 'import_from_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (
          importText.includes('pytest') ||
          importText.includes('unittest.mock') ||
          importText.includes('mock') ||
          importText.includes('fixtures') ||
          importText.includes('assertions')
        ) {
          imports.push(importText);
        }
      }

      if (n.children) {
        n.children.forEach(traverse);
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return imports;
  }

  private extractPytestExports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const exports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'function_definition' || n.type === 'decorated_definition') {
        const funcText = this.getNodeText(n, sourceCode);
        if (
          funcText.includes('def test_') ||
          funcText.includes('def pytest_') ||
          funcText.includes('@pytest.fixture')
        ) {
          exports.push(funcText.split('\n')[0]); // First line only
        }
      }
    };

    let root = node.parent;
    while (root && root.parent) {
      root = root.parent;
    }

    if (root) {
      traverse(root);
    }

    return exports;
  }

  private isStandalonePytestTest(node: Parser.SyntaxNode, content: string): boolean {
    const testPatterns = [/def\s+test_/, /@pytest\.fixture/, /class\s+Test/, /def\s+pytest_/];

    return (
      (node.type === 'function_definition' ||
        node.type === 'decorated_definition' ||
        node.type === 'class_definition') &&
      testPatterns.some(pattern => pattern.test(content))
    );
  }

  private calculatePytestComplexity(content: string): number {
    let complexity = 0;

    // Base test complexity
    complexity += (content.match(/def\s+test_/g) || []).length * 3;
    complexity += (content.match(/class\s+Test/g) || []).length * 5;

    // Fixture complexity
    complexity += (content.match(/@pytest\.fixture/g) || []).length * 4;
    complexity += (content.match(/def\s+\w+fixture/g) || []).length * 3;

    // Parametrization complexity
    complexity += (content.match(/@pytest\.mark\.parametrize/g) || []).length * 5;

    // Assertion complexity
    complexity += (content.match(/assert\s+/g) || []).length * 2;
    complexity += (content.match(/with\s+pytest\.raises/g) || []).length * 3;

    // Mocking complexity
    complexity += (content.match(/mock|Mock|patch/g) || []).length * 3;
    complexity += (content.match(/monkeypatch/g) || []).length * 4;

    // Test data and setup complexity
    complexity += (content.match(/@pytest\.fixture\s*\([^)]*autouse[^)]*\)/g) || []).length * 2;
    complexity += (content.match(/@pytest\.fixture\s*\([^)]*scope[^)]*\)/g) || []).length * 3;

    // Async test complexity
    complexity += (content.match(/@pytest\.mark\.asyncio/g) || []).length * 3;
    complexity += (content.match(/async\s+def\s+test_/g) || []).length * 4;

    // Markers and test categorization
    complexity += (content.match(/@pytest\.mark\./g) || []).length * 2;

    // Configuration complexity
    complexity += content.includes('conftest.py') ? 5 : 0;

    // Test utilities and helpers
    complexity += (content.match(/tmp_path|capsys|capfd|caplog/g) || []).length * 2;

    // Test data complexity
    complexity += (content.match(/@pytest\.fixture\s*\([^)]*params[^)]*\)/g) || []).length * 3;

    return Math.max(1, complexity);
  }
}
