import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * JUnit 5 Framework Rule - Identifies JUnit 5 tests, annotations, and patterns
 */
export class JUnitRule extends AbstractSnippetRule {
  readonly name = 'JUnitRule';
  readonly supportedNodeTypes = new Set([
    // Test methods and classes
    'class_declaration',
    'method_declaration',
    'field_declaration',

    // Annotations
    'annotation',
    'marker_annotation',
    'single_member_annotation',

    // Import statements
    'import_declaration',

    // Method and test patterns
    'block',
    'expression_statement',
    'assert_statement',
    'try_statement',
    'catch_clause',
  ]);

  protected readonly snippetType = 'junit_test' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check if this is JUnit 5-related code
    return this.isJUnitCode(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const junitMetadata = this.extractJUnitMetadata(node, content, sourceCode);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractJUnitImports(node, sourceCode),
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateJUnitComplexity(content),
        isStandalone: this.isStandaloneJUnitTest(node, content),
        hasSideEffects: this.hasSideEffects(content),
        junitInfo: junitMetadata,
      },
    };
  }

  private isJUnitCode(content: string): boolean {
    const junitPatterns = [
      // JUnit 5 imports
      /import\s+org\.junit\.jupiter\./,
      /import\s+org\.junit\.jupiter\.api\./,
      /import\s+org\.junit\.jupiter\.params\./,
      /import\s+org\.junit\.jupiter\.extensions\./,

      // JUnit 5 annotations
      /@Test/,
      /@BeforeEach/,
      /@AfterEach/,
      /@BeforeAll/,
      /@AfterAll/,
      /@DisplayName/,
      /@RepeatedTest/,
      /@ParameterizedTest/,
      /@TestFactory/,
      /@TestTemplate/,
      /@Timeout/,
      /@Disabled/,
      /@Tag/,
      /@ExtendWith/,

      // JUnit 5 assertions
      /Assertions\./,
      /assertThrows\(/,
      /assertAll\(/,
      /assertThat\s*\(/,

      // JUnit 5 parameterized tests
      /@ValueSource/,
      /@EnumSource/,
      /@MethodSource/,
      /@CsvSource/,
      /@CsvFileSource/,
      /@ArgumentsSource/,

      // JUnit 5 extensions
      /@ExtendWith/,
      /ParameterResolver/,
      /TestInstancePostProcessor/,
      /TestExecutionExceptionHandler/,

      // Test lifecycle patterns
      /@BeforeEach\s+\w+\s*\(\)/,
      /@AfterEach\s+\w+\s*\(\)/,
      /@BeforeAll\s+static\s+\w+\s*\(\)/,
      /@AfterAll\s+static\s+\w+\s*\(\)/,

      // Dynamic tests
      /@TestFactory/,
      /DynamicTest/,
      /dynamicTest\s*\(/,

      // Conditional test execution
      /@EnabledIf/,
      /@DisabledIf/,
      /@EnabledOnOs/,
      /@EnabledOnJre/,
      /@EnabledForJreRange/,

      // Test instance lifecycle
      /@TestInstance/,

      // Parameter injection
      /TestInfo/,
      /TestReporter/,
      /TestInfo\s+\w+/,
      /TestReporter\s+\w+/,

      // Mocking integration (Mockito with JUnit 5)
      /@Mock/,
      /@InjectMocks/,
      /@ExtendWith\s*\(\s*MockitoExtension\.class\s*\)/,
      /Mockito\./,

      // AssertJ integration
      /Assertions\.assertThat/,
      /assertThat\s*\(/,
      /\.isNotNull\(\)/,
      /\.isEqualTo\(\)/,
    ];

    return junitPatterns.some(pattern => pattern.test(content));
  }

  private extractJUnitMetadata(node: Parser.SyntaxNode, content: string, sourceCode: string) {
    return {
      testStructure: this.extractTestStructure(content),
      annotations: this.extractAnnotationsInfo(content),
      assertions: this.extractAssertionsInfo(content),
      lifecycle: this.extractLifecycleInfo(content),
      parameterization: this.extractParameterizationInfo(content),
      extensions: this.extractExtensionsInfo(content),
      performance: this.extractPerformanceInfo(content),
    };
  }

  private extractTestStructure(content: string) {
    const testClasses = (content.match(/class\s+[A-Z][a-zA-Z0-9_]*\s*Test/g) || []).length;
    const testMethods = (content.match(/@Test\s*\n\s+public\s+void\s+test[a-zA-Z0-9_]+/g) || [])
      .length;
    const parameterizedTests = (content.match(/@ParameterizedTest/g) || []).length;
    const nestedTests = (content.match(/@Nested\s+class/g) || []).length;

    return {
      testClasses,
      testMethods,
      parameterizedTests,
      nestedTests,
    };
  }

  private extractAnnotationsInfo(content: string) {
    const usesTest = /@Test/.test(content);
    const usesBeforeEach = /@BeforeEach/.test(content);
    const usesAfterEach = /@AfterEach/.test(content);
    const usesBeforeAll = /@BeforeAll/.test(content);
    const usesAfterAll = /@AfterAll/.test(content);
    const usesParameterizedTest = /@ParameterizedTest/.test(content);
    const usesRepeatedTest = /@RepeatedTest/.test(content);
    const usesTimeout = /@Timeout/.test(content);
    const usesDisabled = /@Disabled/.test(content);

    return {
      usesTest,
      usesBeforeEach,
      usesAfterEach,
      usesBeforeAll,
      usesAfterAll,
      usesParameterizedTest,
      usesRepeatedTest,
      usesTimeout,
      usesDisabled,
    };
  }

  private extractAssertionsInfo(content: string) {
    const assertCount = (content.match(/assert\w+\s*\(/g) || []).length;
    const customAssertions = /assertThat\s*\(/.test(content);
    const assertEqualsCount = (content.match(/assertEquals\s*\(/g) || []).length;
    const assertTrueCount = (content.match(/assertTrue\s*\(/g) || []).length;
    const assertNullCount = (content.match(/assertNull\s*\(/g) || []).length;

    return {
      assertCount,
      customAssertions,
      assertEqualsCount,
      assertTrueCount,
      assertNullCount,
    };
  }

  private extractLifecycleInfo(content: string) {
    const beforeEachCount = (content.match(/@BeforeEach/g) || []).length;
    const afterEachCount = (content.match(/@AfterEach/g) || []).length;
    const beforeAllCount = (content.match(/@BeforeAll/g) || []).length;
    const afterAllCount = (content.match(/@AfterAll/g) || []).length;

    return {
      beforeEachCount,
      afterEachCount,
      beforeAllCount,
      afterAllCount,
    };
  }

  private extractParameterizationInfo(content: string) {
    const valueSources = this.extractPatternMatches(content, [
      /@ValueSource\s*\(\s*strings\s*=\s*{([^}]+)}/g,
      /@ValueSource\s*\(\s*ints\s*=\s*{([^}]+)}/g,
      /@ValueSource\s*\(\s*longs\s*=\s*{([^}]+)}/g,
      /@ValueSource\s*\(\s*doubles\s*=\s*{([^}]+)}/g,
    ]);

    const methodSources = this.extractPatternMatches(content, [
      /@MethodSource\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
    ]);

    const csvSources = this.extractPatternMatches(content, [
      /@CsvSource\s*\(\s*value\s*=\s*{([^}]+)}/g,
    ]);

    const enumSources = this.extractPatternMatches(content, [
      /@EnumSource\s*\(\s*value\s*=\s*([^)]+)\)/g,
    ]);

    return {
      valueSources,
      methodSources,
      csvSources,
      enumSources,
    };
  }

  private extractExtensionsInfo(content: string) {
    const customExtensions = this.extractPatternMatches(content, [
      /@ExtendWith\s*\(\s*([a-zA-Z0-9_]+)\.class\s*\)/g,
    ]);

    const usesMockito = /@Mock|@InjectMocks|MockitoExtension/.test(content);
    const usesAssertJ = /assertThat|Assertions\.assertThat/.test(content);
    const usesHamcrest = /org\.hamcrest|MatcherAssert|assertThat/.test(content);

    return {
      customExtensions,
      usesMockito,
      usesAssertJ,
      usesHamcrest,
    };
  }

  private extractPerformanceInfo(content: string) {
    const timeoutUsage = /@Timeout|Timeout\.millis/.test(content);
    const parallelExecution = /parallel|ParallelExecution/.test(content);
    const repeatedTests = (content.match(/@RepeatedTest\s*\(\s*(\d+)\s*\)/g) || []).length;

    return {
      timeoutUsage,
      parallelExecution,
      repeatedTests,
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

  private extractJUnitImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_declaration') {
        const importText = this.getNodeText(n, sourceCode);
        if (
          importText.includes('org.junit.jupiter') ||
          importText.includes('org.junit.jupiter.api') ||
          importText.includes('org.junit.jupiter.params') ||
          importText.includes('org.junit.jupiter.extensions') ||
          importText.includes('org.junit.jupiter.api.extension') ||
          importText.includes('org.junit.jupiter.api.condition') ||
          importText.includes('org.junit.jupiter.api.parallel') ||
          importText.includes('org.junit.jupiter.api.function') ||
          importText.includes('org.junit.jupiter.params.provider') ||
          importText.includes('org.junit.jupiter.params.converter') ||
          importText.includes('org.junit.jupiter.params.aggregator') ||
          importText.includes('org.mockito') ||
          importText.includes('org.assertj') ||
          importText.includes('org.hamcrest')
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

  private isStandaloneJUnitTest(node: Parser.SyntaxNode, content: string): boolean {
    const testPatterns = [
      /@Test/,
      /@BeforeEach/,
      /@AfterEach/,
      /@BeforeAll/,
      /@AfterAll/,
      /@ParameterizedTest/,
      /@RepeatedTest/,
      /@TestFactory/,
      /class\s+[A-Z][a-zA-Z0-9_]*\s*Test/,
    ];

    return (
      (node.type === 'class_declaration' ||
        node.type === 'method_declaration' ||
        node.type === 'annotation') &&
      testPatterns.some(pattern => pattern.test(content))
    );
  }

  private calculateJUnitComplexity(content: string): number {
    let complexity = 0;

    // Base test structure complexity
    complexity += (content.match(/class\s+[A-Z][a-zA-Z0-9_]*\s*Test/g) || []).length * 5;
    complexity += (content.match(/@Test/g) || []).length * 3;

    // Lifecycle method complexity
    complexity += (content.match(/@BeforeEach/g) || []).length * 2;
    complexity += (content.match(/@AfterEach/g) || []).length * 2;
    complexity += (content.match(/@BeforeAll/g) || []).length * 3;
    complexity += (content.match(/@AfterAll/g) || []).length * 3;

    // Parameterized test complexity
    complexity += (content.match(/@ParameterizedTest/g) || []).length * 5;
    complexity += (content.match(/@ValueSource/g) || []).length * 3;
    complexity += (content.match(/@MethodSource/g) || []).length * 4;
    complexity += (content.match(/@CsvSource/g) || []).length * 4;

    // Assertion complexity
    complexity += (content.match(/assert\w+\s*\(/g) || []).length * 2;
    complexity += (content.match(/Assertions\./g) || []).length * 2;
    complexity += (content.match(/assertThat\s*\(/g) || []).length * 2;

    // Exception testing complexity
    complexity += (content.match(/assertThrows\s*\(/g) || []).length * 3;

    // Mocking complexity
    complexity += (content.match(/@Mock/g) || []).length * 3;
    complexity += (content.match(/@InjectMocks/g) || []).length * 3;
    complexity += (content.match(/Mockito\./g) || []).length * 2;

    // Dynamic test complexity
    complexity += (content.match(/@TestFactory/g) || []).length * 5;
    complexity += (content.match(/DynamicTest/g) || []).length * 4;

    // Nested test complexity
    complexity += (content.match(/@Nested/g) || []).length * 4;

    // Repeated test complexity
    complexity += (content.match(/@RepeatedTest/g) || []).length * 3;

    // Conditional execution complexity
    complexity +=
      (content.match(/@EnabledIf|@DisabledIf|@EnabledOnOs|@EnabledOnJre/g) || []).length * 3;

    // Extension complexity
    complexity += (content.match(/@ExtendWith/g) || []).length * 3;

    // Timeout and performance testing
    complexity += (content.match(/@Timeout/g) || []).length * 2;

    // Disabled tests
    complexity += (content.match(/@Disabled/g) || []).length * 1;

    // Test infrastructure
    complexity += (content.match(/@TestInstance/g) || []).length * 2;

    return Math.max(1, complexity);
  }
}
