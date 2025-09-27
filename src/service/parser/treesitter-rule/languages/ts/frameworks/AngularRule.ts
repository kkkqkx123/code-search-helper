import * as Parser from 'tree-sitter';
import { SnippetChunk, SnippetMetadata } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * Angular Framework Rule - Extracts Angular component, module, and service patterns
 */
export class AngularRule extends AbstractSnippetRule {
  readonly name = 'AngularRule';
  readonly supportedNodeTypes = new Set([
    'import_statement',
    'class_declaration',
    'decorator',
    'method_definition',
    'property_identifier',
    'call_expression',
    'assignment',
    'interface_declaration',
    'type_annotation',
    'generic_type',
  ]);

  protected snippetType = 'angular_component' as const;

  // Angular-specific patterns
  private readonly angularPatterns = [
    '@Component\\(',
    '@NgModule\\(',
    '@Injectable\\(',
    '@Directive\\(',
    '@Pipe\\(',
    '@Input\\(',
    '@Output\\(',
    '@ViewChild\\(',
    '@ViewChildren\\(',
    '@ContentChild\\(',
    '@ContentChildren\\(',
    '@HostBinding\\(',
    '@HostListener\\(',
    '@Inject\\(',
    '@Optional\\(',
    '@Self\\(',
    '@SkipSelf\\(',
    '@Host\\(',
    'ngOnInit\\(',
    'ngOnChanges\\(',
    'ngDoCheck\\(',
    'ngAfterContentInit\\(',
    'ngAfterContentChecked\\(',
    'ngAfterViewInit\\(',
    'ngAfterViewChecked\\(',
    'ngOnDestroy\\(',
    'HttpClient\\.',
    'Router\\.',
    'ActivatedRoute\\.',
    'FormGroup\\.',
    'FormControl\\.',
    'FormBuilder\\.',
    'ReactiveFormsModule',
    'CommonModule',
    'BrowserModule',
    'RouterModule\\.',
    'Store\\.',
    'EffectsModule\\.',
    'Actions\\.',
    'createEffect\\(',
    'createSelector\\(',
  ];

  protected isValidNodeType(node: Parser.SyntaxNode, sourceCode: string): boolean {
    const nodeText = this.getNodeText(node, sourceCode);
    return this.isAngularPattern(nodeText);
  }

  private isAngularPattern(text: string): boolean {
    return this.angularPatterns.some(pattern => new RegExp(pattern, 'i').test(text));
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);

    if (
      !this.validateSnippet({
        id: '',
        content,
        startLine: location.startLine,
        endLine: location.endLine,
        startByte: node.startIndex,
        endByte: node.endIndex,
        type: 'snippet',
        imports: [],
        exports: [],
        metadata: {},
        snippetMetadata: {} as SnippetMetadata,
      })
    ) {
      return null;
    }

    // Extract Angular-specific information
    const angularInfo = this.extractAngularInfo(content);
    const complexity = this.calculateAngularComplexity(content);

    const metadata: SnippetMetadata = {
      snippetType: this.snippetType,
      contextInfo,
      languageFeatures: this.analyzeLanguageFeatures(content),
      complexity,
      isStandalone: true,
      hasSideEffects: this.hasSideEffects(content),
    };

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: [],
      exports: [],
      metadata: {},
      snippetMetadata: metadata,
    };
  }

  private extractAngularInfo(text: string): {
    patterns: string[];
    features: string[];
  } {
    const patterns: string[] = [];
    const features: string[] = [];

    // Component patterns
    if (text.includes('@Component(')) {
      patterns.push('component-decorator');
      features.push('component');
    }

    // Module patterns
    if (text.includes('@NgModule(')) {
      patterns.push('module-decorator');
      features.push('module');
    }

    // Service patterns
    if (text.includes('@Injectable(')) {
      patterns.push('service-decorator');
      features.push('service');
    }

    // Directive patterns
    if (text.includes('@Directive(')) {
      patterns.push('directive-decorator');
      features.push('directive');
    }

    // Pipe patterns
    if (text.includes('@Pipe(')) {
      patterns.push('pipe-decorator');
      features.push('pipe');
    }

    // Template patterns
    if (text.includes('template:') || text.includes('templateUrl:')) {
      patterns.push('template-configuration');
    }

    // Style patterns
    if (text.includes('styleUrls:') || text.includes('styles:')) {
      patterns.push('style-configuration');
    }

    // Form patterns
    if (text.includes('FormGroup') || text.includes('FormControl')) {
      patterns.push('reactive-forms');
      features.push('forms');
    }

    // HTTP patterns
    if (text.includes('HttpClient') || text.includes('HttpHeaders')) {
      patterns.push('http-client');
      features.push('http');
    }

    // Routing patterns
    if (text.includes('Router') || text.includes('ActivatedRoute')) {
      patterns.push('routing');
      features.push('routing');
    }

    // State management patterns
    if (text.includes('Store') || text.includes('Actions') || text.includes('createEffect')) {
      patterns.push('state-management');
      features.push('ngrx');
    }

    return { patterns, features };
  }

  private calculateAngularComplexity(text: string): number {
    let complexity = 1;

    // Base complexity for Angular patterns
    complexity += text.split('\n').length * 0.5;

    // Increase complexity for decorators
    const decoratorCount = (text.match(/@\w+\(/g) || []).length;
    complexity += decoratorCount * 2;

    // Increase complexity for lifecycle hooks
    const lifecycleHooks = [
      'ngOnInit',
      'ngOnChanges',
      'ngDoCheck',
      'ngAfterContentInit',
      'ngAfterContentChecked',
      'ngAfterViewInit',
      'ngAfterViewChecked',
      'ngOnDestroy',
    ];
    const lifecycleCount = lifecycleHooks.filter(hook => text.includes(hook)).length;
    complexity += lifecycleCount * 1.5;

    // Increase complexity for dependency injection
    const injectionPatterns = ['@Inject(', '@Optional(', 'constructor(', 'private '];
    const injectionCount = injectionPatterns.reduce((count, pattern) => {
      return count + (text.match(new RegExp(pattern, 'g')) || []).length;
    }, 0);
    complexity += injectionCount * 1.5;

    // Increase complexity for template complexity
    if (text.includes('*ngFor') || text.includes('*ngIf') || text.includes('[ngClass]')) {
      complexity += 1;
    }

    // Increase complexity for form handling
    if (
      text.includes('FormGroup') ||
      text.includes('FormControl') ||
      text.includes('FormBuilder')
    ) {
      complexity += 2;
    }

    // Increase complexity for HTTP operations
    if (text.includes('HttpClient') || text.includes('subscribe(')) {
      complexity += 2;
    }

    return Math.min(complexity, 100);
  }

  private generateAngularTags(text: string): string[] {
    const tags: string[] = ['angular', 'typescript'];

    // Component type tags
    if (text.includes('@Component(')) tags.push('component');
    if (text.includes('@NgModule(')) tags.push('module');
    if (text.includes('@Injectable(')) tags.push('service');
    if (text.includes('@Directive(')) tags.push('directive');
    if (text.includes('@Pipe(')) tags.push('pipe');

    // Feature tags
    if (text.includes('HttpClient')) tags.push('http');
    if (text.includes('Router')) tags.push('routing');
    if (text.includes('FormGroup') || text.includes('FormControl')) tags.push('forms');
    if (text.includes('Store') || text.includes('ngrx')) tags.push('state-management');
    if (text.includes('RxJS') || text.includes('Observable')) tags.push('rxjs');
    if (text.includes('async')) tags.push('async');

    // Template tags
    if (text.includes('*ngFor')) tags.push('ngfor');
    if (text.includes('*ngIf')) tags.push('ngif');
    if (text.includes('[(ngModel)]')) tags.push('twoway-binding');

    // Architecture tags
    if (text.includes('singleton')) tags.push('singleton');
    if (text.includes(' providedIn:')) tags.push('dependency-injection');

    return tags;
  }

  private determineComponentType(text: string): string {
    if (text.includes('@Component(')) return 'component';
    if (text.includes('@NgModule(')) return 'module';
    if (text.includes('@Injectable(')) return 'service';
    if (text.includes('@Directive(')) return 'directive';
    if (text.includes('@Pipe(')) return 'pipe';
    if (text.includes('interface') && text.includes('canActivate')) return 'guard';
    if (text.includes('resolve')) return 'resolver';
    if (text.includes('Interceptor')) return 'interceptor';
    return 'unknown';
  }

  private extractDependencies(text: string): string[] {
    const dependencies: string[] = [];

    // Extract constructor dependencies
    const constructorMatch = text.match(/constructor\(([^)]+)\)/);
    if (constructorMatch) {
      const constructorParams = constructorMatch[1];
      const paramMatches = constructorParams.match(/private\s+(\w+)/g) || [];
      paramMatches.forEach(param => {
        const dependency = param.replace('private ', '').trim();
        dependencies.push(dependency);
      });
    }

    // Extract injected dependencies
    const injectMatches = text.match(/@Inject\(([^)]+)\)/g) || [];
    injectMatches.forEach(inject => {
      const dependency = inject.match(/@Inject\(([^)]+)\)/)?.[1]?.replace(/['"]/g, '');
      if (dependency) dependencies.push(dependency);
    });

    return dependencies;
  }

  private extractLifecycleHooks(text: string): string[] {
    const lifecycleHooks: string[] = [];

    const hookPatterns = [
      'ngOnInit',
      'ngOnChanges',
      'ngDoCheck',
      'ngAfterContentInit',
      'ngAfterContentChecked',
      'ngAfterViewInit',
      'ngAfterViewChecked',
      'ngOnDestroy',
    ];

    hookPatterns.forEach(hook => {
      if (text.includes(hook)) {
        lifecycleHooks.push(hook);
      }
    });

    return lifecycleHooks;
  }

  protected getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    const lines = sourceCode.split('\n');
    const startLine = node.startPosition.row;
    const endLine = node.endPosition.row;

    return lines.slice(startLine, endLine + 1).join('\n');
  }

  // Remove duplicate generateSnippetId - use base class implementation
}
