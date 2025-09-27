import { SnippetExtractionRule } from './SnippetExtractionRule';
import { ControlStructureRule } from './core/ControlStructureRule';
import { ErrorHandlingRule } from './core/ErrorHandlingRule';
import { FunctionCallChainRule } from './core/FunctionCallChainRule';
import { CommentMarkedRule } from './core/CommentMarkedRule';
import { LogicBlockRule } from './core/LogicBlockRule';
import { ExpressionSequenceRule } from './core/ExpressionSequenceRule';
import { ObjectArrayLiteralRule } from './core/ObjectArrayLiteralRule';
import { ArithmeticLogicalRule } from './core/ArithmeticLogicalRule';
import { TemplateLiteralRule } from './TemplateLiteralRule';
import { DestructuringAssignmentRule } from './core/DestructuringAssignmentRule';

// Modern features rules
import { AsyncPatternRule } from './modern-features/AsyncPatternRule';
import { DecoratorPatternRule } from './modern-features/DecoratorPatternRule';
import { GenericPatternRule } from './modern-features/GenericPatternRule';
import { FunctionalProgrammingRule } from './modern-features/FunctionalProgrammingRule';

// Language-specific rules
import { PythonComprehensionRule } from './languages/python/PythonComprehensionRule';
import { JavaStreamRule } from './languages/java/JavaStreamRule';
import { JavaLambdaRule } from './languages/java/JavaLambdaRule';
import { GoGoroutineRule } from './languages/go/GoGoroutineRule';
import { GoInterfaceRule } from './languages/go/GoInterfaceRule';

// Framework rules
import { ReactRule } from './languages/ts/frameworks/ReactRule';
import { VueRule } from './languages/ts/frameworks/VueRule';
import { AngularRule } from './languages/ts/frameworks/AngularRule';
import { ExpressRule } from './languages/js/frameworks/ExpressRule';
import { DjangoRule } from './languages/python/frameworks/DjangoRule';
import { FastAPIRule } from './languages/python/frameworks/FastAPIRule';
import { PyTorchRule } from './languages/python/frameworks/PyTorchRule';
import { PandasNumpyRule } from './languages/python/frameworks/PandasNumpyRule';
import { PytestRule } from './languages/python/testing/PytestRule';
import { JUnitRule } from './languages/java/testing/JUnitRule';
import { SpringBootRule } from './languages/java/frameworks/SpringBootRule';
import { GoFrameworkRule } from './languages/go/GoFrameworkRule';

// Build and Tooling rules
import { JavaBuildSystemsRule } from './languages/java/build/JavaBuildSystemsRule';
import { NpmYarnPackageManagementRule } from './languages/js/package-management/NpmYarnPackageManagementRule';
import { DockerContainerizationRule } from './languages/docker/DockerContainerizationRule';
import { CICDConfigurationRule } from './languages/js/cicd/CICDConfigurationRule';

/**
 * Enhanced Rule Factory - Creates and manages snippet extraction rules
 * Provides different rule sets for various use cases
 */
export class EnhancedRuleFactory {
  /**
   * Create all available rules
   */
  static createAllRules(): SnippetExtractionRule[] {
    return [
      // Core language rules
      new ControlStructureRule(),
      new ErrorHandlingRule(),
      new FunctionCallChainRule(),
      new CommentMarkedRule(),
      new LogicBlockRule(),
      new ExpressionSequenceRule(),
      new ObjectArrayLiteralRule(),
      new ArithmeticLogicalRule(),
      new TemplateLiteralRule(),
      new DestructuringAssignmentRule(),

      // Modern features rules
      new AsyncPatternRule(),
      new DecoratorPatternRule(),
      new GenericPatternRule(),
      new FunctionalProgrammingRule(),

      // Language-specific rules
      new PythonComprehensionRule(),
      new JavaStreamRule(),
      new JavaLambdaRule(),
      new GoGoroutineRule(),
      new GoInterfaceRule(),

      // Framework rules
      new ReactRule(),
      new VueRule(),
      new AngularRule(),
      new ExpressRule(),
      new DjangoRule(),
      new FastAPIRule(),
      new PyTorchRule(),
      new PandasNumpyRule(),
      new PytestRule(),
      new JUnitRule(),
      new SpringBootRule(),
      new GoFrameworkRule(),

      // Build and Tooling rules
      new JavaBuildSystemsRule(),
      new NpmYarnPackageManagementRule(),
      new DockerContainerizationRule(),
      new CICDConfigurationRule(),
    ];
  }

  /**
   * Create comprehensive rules for detailed analysis
   */
  static createComprehensiveRules(): SnippetExtractionRule[] {
    return this.createAllRules();
  }

  /**
   * Create language-specific rules
   */
  static createLanguageSpecificRules(language: string): SnippetExtractionRule[] {
    const baseRules = [
      new ControlStructureRule(),
      new ErrorHandlingRule(),
      new FunctionCallChainRule(),
      new CommentMarkedRule(),
      new LogicBlockRule(),
      new ExpressionSequenceRule(),
      new ObjectArrayLiteralRule(),
      new ArithmeticLogicalRule(),
      new TemplateLiteralRule(),
      new DestructuringAssignmentRule(),
    ];

    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return [
          ...baseRules,
          new AsyncPatternRule(),
          new DecoratorPatternRule(),
          new GenericPatternRule(),
          new FunctionalProgrammingRule(),
          new ReactRule(),
          new VueRule(),
          new AngularRule(),
          new ExpressRule(),
          new NpmYarnPackageManagementRule(),
          new DockerContainerizationRule(),
          new CICDConfigurationRule(),
        ];

      case 'python':
        return [
          ...baseRules,
          new PythonComprehensionRule(),
          new DjangoRule(),
          new FastAPIRule(),
          new PyTorchRule(),
          new PandasNumpyRule(),
          new PytestRule(),
        ];

      case 'java':
        return [
          ...baseRules,
          new JavaStreamRule(),
          new JavaLambdaRule(),
          new SpringBootRule(),
          new JUnitRule(),
          new JavaBuildSystemsRule(),
        ];

      case 'go':
        return [...baseRules, new GoGoroutineRule(), new GoInterfaceRule(), new GoFrameworkRule()];

      default:
        return baseRules;
    }
  }

  /**
   * Create rules focused on specific aspects
   */
  static createFocusedRules(
    focus: 'performance' | 'architecture' | 'security' | 'testing'
  ): SnippetExtractionRule[] {
    const baseRules = [
      new ControlStructureRule(),
      new ErrorHandlingRule(),
      new FunctionCallChainRule(),
    ];

    switch (focus) {
      case 'performance':
        return [
          ...baseRules,
          new FunctionCallChainRule(),
          new AsyncPatternRule(),
          new JavaStreamRule(),
          new PythonComprehensionRule(),
          new ReactRule(),
          new VueRule(),
          new PyTorchRule(),
          new PandasNumpyRule(),
        ];

      case 'architecture':
        return [
          ...baseRules,
          new DecoratorPatternRule(),
          new GenericPatternRule(),
          new FunctionalProgrammingRule(),
          new GoInterfaceRule(),
          new GoFrameworkRule(),
          new ReactRule(),
          new VueRule(),
          new AngularRule(),
          new SpringBootRule(),
          new DjangoRule(),
          new FastAPIRule(),
          new ExpressRule(),
          new JavaBuildSystemsRule(),
          new NpmYarnPackageManagementRule(),
          new DockerContainerizationRule(),
          new CICDConfigurationRule(),
        ];

      case 'security':
        return [
          ...baseRules,
          new ErrorHandlingRule(),
          new FunctionCallChainRule(),
          new TemplateLiteralRule(),
          new ExpressRule(),
          new SpringBootRule(),
          new FastAPIRule(),
          new DjangoRule(),
          new DockerContainerizationRule(),
          new CICDConfigurationRule(),
        ];

      case 'testing':
        return [
          ...baseRules,
          new CommentMarkedRule(),
          new ErrorHandlingRule(),
          new FunctionCallChainRule(),
          new PytestRule(),
          new JUnitRule(),
        ];

      default:
        return baseRules;
    }
  }

  /**
   * Create framework-specific rules
   */
  static createFrameworkRules(framework: string): SnippetExtractionRule[] {
    switch (framework.toLowerCase()) {
      case 'react':
        return [new ReactRule()];
      case 'vue':
      case 'vuejs':
        return [new VueRule()];
      case 'angular':
        return [new AngularRule()];
      case 'express':
      case 'expressjs':
        return [new ExpressRule()];
      case 'django':
        return [new DjangoRule()];
      case 'fastapi':
        return [new FastAPIRule()];
      case 'spring':
      case 'springboot':
        return [new SpringBootRule()];
      case 'pytorch':
        return [new PyTorchRule()];
      case 'pandas':
      case 'numpy':
      case 'pandasnumpy':
        return [new PandasNumpyRule()];
      case 'gin':
      case 'echo':
      case 'goframework':
        return [new GoFrameworkRule()];
      case 'pytest':
        return [new PytestRule()];
      case 'junit':
      case 'junit5':
        return [new JUnitRule()];
      case 'maven':
      case 'gradle':
      case 'javabuild':
        return [new JavaBuildSystemsRule()];
      case 'npm':
      case 'yarn':
      case 'package':
        return [new NpmYarnPackageManagementRule()];
      case 'docker':
      case 'container':
        return [new DockerContainerizationRule()];
      case 'cicd':
      case 'ci':
      case 'cd':
        return [new CICDConfigurationRule()];
      default:
        return [];
    }
  }

  /**
   * Create minimal rules for quick analysis
   */
  static createMinimalRules(): SnippetExtractionRule[] {
    return [new ControlStructureRule(), new FunctionCallChainRule(), new ErrorHandlingRule()];
  }

  /**
   * Create modern JavaScript/TypeScript rules
   */
  static createModernJSTSRules(): SnippetExtractionRule[] {
    return [
      new AsyncPatternRule(),
      new DecoratorPatternRule(),
      new GenericPatternRule(),
      new FunctionalProgrammingRule(),
      new ReactRule(),
      new VueRule(),
      new ExpressRule(),
    ];
  }

  /**
   * Create data science and ML rules
   */
  static createDataScienceRules(): SnippetExtractionRule[] {
    return [
      new PythonComprehensionRule(),
      new DjangoRule(),
      new FastAPIRule(),
      new PyTorchRule(),
      new PandasNumpyRule(),
      new PytestRule(),
    ];
  }

  /**
   * Create enterprise Java rules
   */
  static createEnterpriseJavaRules(): SnippetExtractionRule[] {
    return [new JavaStreamRule(), new JavaLambdaRule(), new SpringBootRule(), new JUnitRule()];
  }

  /**
   * Create testing framework rules
   */
  static createTestingRules(): SnippetExtractionRule[] {
    return [new PytestRule(), new JUnitRule()];
  }

  /**
   * Create concurrent programming rules
   */
  static createConcurrentRules(): SnippetExtractionRule[] {
    return [new AsyncPatternRule(), new GoGoroutineRule(), new JavaStreamRule()];
  }

  /**
   * Get rule by name
   */
  static getRuleByName(name: string): SnippetExtractionRule | undefined {
    const allRules = this.createAllRules();
    return allRules.find(rule => rule.name === name);
  }

  /**
   * Get rules by type
   */
  static getRulesByType(type: string): SnippetExtractionRule[] {
    const allRules = this.createAllRules();
    return allRules.filter(rule => {
      if ('snippetType' in rule) {
        return (rule as any).snippetType === type;
      }
      return false;
    });
  }

  /**
   * Create custom rule set
   */
  static createCustomRuleSet(ruleNames: string[]): SnippetExtractionRule[] {
    const allRules = this.createAllRules();
    return ruleNames
      .map(name => this.getRuleByName(name))
      .filter(rule => rule !== undefined) as SnippetExtractionRule[];
  }

  /**
   * Get rule statistics
   */
  static getRuleStatistics() {
    const allRules = this.createAllRules();

    const categories = {
      control: 0,
      errorHandling: 0,
      function: 0,
      expression: 0,
      comment: 0,
      logic: 0,
      object: 0,
      arithmetic: 0,
      template: 0,
      destructuring: 0,
      modern: 0,
      language: 0,
      framework: 0,
    };

    const languageSupport: Record<string, number> = {};

    allRules.forEach(rule => {
      // Count by category
      if (rule.name.includes('Control')) categories.control++;
      else if (rule.name.includes('Error')) categories.errorHandling++;
      else if (rule.name.includes('Function')) categories.function++;
      else if (rule.name.includes('Expression')) categories.expression++;
      else if (rule.name.includes('Comment')) categories.comment++;
      else if (rule.name.includes('Logic')) categories.logic++;
      else if (rule.name.includes('Object')) categories.object++;
      else if (rule.name.includes('Arithmetic')) categories.arithmetic++;
      else if (rule.name.includes('Template')) categories.template++;
      else if (rule.name.includes('Destructuring')) categories.destructuring++;
      else if (
        rule.name.includes('Async') ||
        rule.name.includes('Decorator') ||
        rule.name.includes('Generic') ||
        rule.name.includes('Functional')
      )
        categories.modern++;
      else if (
        rule.name.includes('Python') ||
        rule.name.includes('Java') ||
        rule.name.includes('Go')
      )
        categories.language++;
      else if (
        rule.name.includes('React') ||
        rule.name.includes('Django') ||
        rule.name.includes('Spring') ||
        rule.name.includes('PyTorch')
      )
        categories.framework++;

      // Count language support from supportedNodeTypes
      rule.supportedNodeTypes.forEach(nodeType => {
        // This is a simplified approach - in reality you'd want to map node types to languages
        if (
          ['javascript', 'typescript', 'python', 'java', 'go'].some(lang =>
            rule.name.toLowerCase().includes(lang)
          )
        ) {
          const lang = rule.name.toLowerCase().includes('python')
            ? 'python'
            : rule.name.toLowerCase().includes('java')
              ? 'java'
              : rule.name.toLowerCase().includes('react') ||
                rule.name.toLowerCase().includes('typescript')
                ? 'typescript'
                : rule.name.toLowerCase().includes('go')
                  ? 'go'
                  : 'javascript';
          languageSupport[lang] = (languageSupport[lang] || 0) + 1;
        }
      });
    });

    return {
      totalRules: allRules.length,
      categories,
      languageSupport,
    };
  }
}

export default EnhancedRuleFactory;
