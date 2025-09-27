import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * Django Framework Rule - Identifies Django models, views, and patterns
 */
export class DjangoRule extends AbstractSnippetRule {
  readonly name = 'DjangoRule';
  readonly supportedNodeTypes = new Set([
    // Model definitions
    'class_definition',
    'expression_statement',

    // View definitions
    'function_definition',
    'decorated_definition',

    // Django-specific patterns
    'import_statement',
    'call_expression',
    'attribute',

    // ORM patterns
    'assignment',
    'binary_operator',
    'comparison_operator',
  ]);

  protected readonly snippetType = 'django_model' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check if this is Django-related code
    return this.isDjangoCode(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const djangoType = this.determineDjangoType(node, content);

    // Use the appropriate snippet type based on Django component
    const snippetType =
      djangoType === 'view' ? ('django_view' as const) : ('django_model' as const);
    const djangoMetadata = this.extractDjangoMetadata(node, content, sourceCode, djangoType);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractDjangoImports(node, sourceCode),
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateDjangoComplexity(content, djangoType),
        isStandalone: this.isStandaloneDjangoComponent(node, djangoType),
        hasSideEffects: this.hasSideEffects(content),
        djangoInfo: djangoMetadata,
      },
    };
  }

  private isDjangoCode(content: string): boolean {
    const djangoPatterns = [
      // Django imports
      /from\s+django\.db\s+import\s+models/,
      /from\s+django\.views\s+import/,
      /from\s+django\.http\s+import/,
      /from\s+django\.contrib\s+import/,
      /from\s+django\.forms\s+import/,
      /from\s+django\.shortcuts\s+import/,

      // Model patterns
      /class\s+\w+\s*\(\s*models\.Model\s*\)/,
      /models\.CharField\(/,
      /models\.IntegerField\(/,
      /models\.TextField\(/,
      /models\.DateField\(/,
      /models\.DateTimeField\(/,
      /models\.ForeignKey\(/,
      /models\.ManyToManyField\(/,
      /models\.OneToOneField\(/,

      // View patterns
      /def\s+\w+\s*\(\s*request\b/,
      /@login_required/,
      /@api_view\(/,
      /@permission_required\(/,
      /render\(/,
      /JsonResponse\(/,
      /HttpResponse\(/,
      /HttpResponseRedirect\(/,

      // ORM patterns
      /objects\.filter\(/,
      /objects\.all\(/,
      /objects\.get\(/,
      /objects\.create\(/,
      /\.select_related\(/,
      /\.prefetch_related\(/,
      /\.annotate\(/,
      /\.aggregate\(/,

      // URL patterns
      /path\(/,
      /re_path\(/,
      /url\(/,

      // Form patterns
      /class\s+\w+Form\(/,
      /class\s+\w+ModelForm\(/,

      // Admin patterns
      /class\s+\w+Admin\(/,
      /admin\.site\.register/,
    ];

    return djangoPatterns.some(pattern => pattern.test(content));
  }

  private determineDjangoType(
    node: Parser.SyntaxNode,
    content: string
  ): 'model' | 'view' | 'other' {
    if (content.includes('models.Model') && node.type === 'class_definition') {
      return 'model';
    }

    if (
      (node.type === 'function_definition' || node.type === 'decorated_definition') &&
      (content.includes('request') ||
        content.includes('render') ||
        content.includes('HttpResponse'))
    ) {
      return 'view';
    }

    return 'other';
  }

  private extractDjangoMetadata(
    node: Parser.SyntaxNode,
    content: string,
    sourceCode: string,
    djangoType: 'model' | 'view' | 'other'
  ) {
    if (djangoType === 'model') {
      return {
        models: this.extractModels(content),
        views: [],
        orm: this.extractORMInfo(content),
        patterns: this.extractDjangoPatterns(content),
      };
    } else if (djangoType === 'view') {
      return {
        models: [],
        views: this.extractViews(content),
        orm: this.extractORMInfo(content),
        patterns: this.extractDjangoPatterns(content),
      };
    } else {
      return {
        models: [],
        views: [],
        orm: this.extractORMInfo(content),
        patterns: this.extractDjangoPatterns(content),
      };
    }
  }

  private extractModels(content: string) {
    const modelPattern = /class\s+([A-Z][a-zA-Z0-9_]*)\s*\(\s*models\.Model\s*\)\s*:/;
    const modelMatch = content.match(modelPattern);

    if (!modelMatch) return [];

    const modelName = modelMatch[1];
    const fields = this.extractModelFields(content);
    const meta = this.extractModelMeta(content);

    return [
      {
        modelName,
        fields,
        meta,
      },
    ];
  }

  private extractModelFields(content: string) {
    const fieldPatterns = [
      { type: 'CharField', pattern: /(\w+)\s*=\s*models\.CharField\s*\([^)]*\)/g },
      { type: 'IntegerField', pattern: /(\w+)\s*=\s*models\.IntegerField\s*\([^)]*\)/g },
      { type: 'TextField', pattern: /(\w+)\s*=\s*models\.TextField\s*\([^)]*\)/g },
      { type: 'DateField', pattern: /(\w+)\s*=\s*models\.DateField\s*\([^)]*\)/g },
      { type: 'DateTimeField', pattern: /(\w+)\s*=\s*models\.DateTimeField\s*\([^)]*\)/g },
      { type: 'BooleanField', pattern: /(\w+)\s*=\s*models\.BooleanField\s*\([^)]*\)/g },
      { type: 'EmailField', pattern: /(\w+)\s*=\s*models\.EmailField\s*\([^)]*\)/g },
      { type: 'URLField', pattern: /(\w+)\s*=\s*models\.URLField\s*\([^)]*\)/g },
      { type: 'SlugField', pattern: /(\w+)\s*=\s*models\.SlugField\s*\([^)]*\)/g },
      { type: 'FileField', pattern: /(\w+)\s*=\s*models\.FileField\s*\([^)]*\)/g },
      { type: 'ImageField', pattern: /(\w+)\s*=\s*models\.ImageField\s*\([^)]*\)/g },
      {
        type: 'ForeignKey',
        pattern: /(\w+)\s*=\s*models\.ForeignKey\s*\(\s*['"]([^'"]+)['"][^)]*\)/g,
      },
      {
        type: 'ManyToManyField',
        pattern: /(\w+)\s*=\s*models\.ManyToManyField\s*\(\s*['"]([^'"]+)['"][^)]*\)/g,
      },
      {
        type: 'OneToOneField',
        pattern: /(\w+)\s*=\s*models\.OneToOneField\s*\(\s*['"]([^'"]+)['"][^)]*\)/g,
      },
    ];

    const fields: any[] = [];

    fieldPatterns.forEach(({ type, pattern }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const fieldName = match[1];
        const constraints = this.extractFieldConstraints(match[0]);
        const relationships: any[] = [];

        if (type === 'ForeignKey' || type === 'ManyToManyField' || type === 'OneToOneField') {
          relationships.push({
            type,
            relatedModel: match[2],
          });
        }

        fields.push({
          name: fieldName,
          type,
          constraints,
          relationships,
        });
      }
    });

    return fields;
  }

  private extractFieldConstraints(fieldDefinition: string): string[] {
    const constraints: string[] = [];

    if (fieldDefinition.includes('unique=True')) constraints.push('unique');
    if (fieldDefinition.includes('null=True')) constraints.push('nullable');
    if (fieldDefinition.includes('blank=True')) constraints.push('blank');
    if (fieldDefinition.includes('default=')) constraints.push('has_default');
    if (fieldDefinition.includes('max_length=')) constraints.push('max_length');
    if (fieldDefinition.includes('choices=')) constraints.push('choices');

    return constraints;
  }

  private extractModelMeta(content: string) {
    const metaPattern = /class\s+Meta\s*:\s*([^}]+)}/s;
    const metaMatch = content.match(metaPattern);

    if (!metaMatch) return {};

    const metaContent = metaMatch[1];
    const dbTableMatch = metaContent.match(/db_table\s*=\s*['"]([^'"]+)['"]/);
    const orderingMatch = metaContent.match(/ordering\s*=\s*\[([^\]]+)\]/);
    const verboseNameMatch = metaContent.match(/verbose_name\s*=\s*['"]([^'"]+)['"]/);

    return {
      dbTable: dbTableMatch ? dbTableMatch[1] : undefined,
      ordering: orderingMatch
        ? orderingMatch[1].split(',').map(item => item.trim().replace(/['"]/g, ''))
        : undefined,
      verboseName: verboseNameMatch ? verboseNameMatch[1] : undefined,
    };
  }

  private extractViews(content: string) {
    const viewPattern = /def\s+([a-z][a-zA-Z0-9_]*)\s*\(\s*request[^)]*\)/g;
    const classViewPattern = /class\s+([A-Z][a-zA-Z0-9_]*)\s*\(\s*([A-Z][a-zA-Z0-9_]*)\s*\)/g;

    const views: any[] = [];

    // Function-based views
    let match;
    while ((match = viewPattern.exec(content)) !== null) {
      const viewName = match[1];
      const viewContent = content.slice(match.index);
      const method = this.extractViewMethod(viewContent);
      const authentication = this.extractViewAuthentication(viewContent);
      const permissions = this.extractViewPermissions(viewContent);
      const template = this.extractViewTemplate(viewContent);

      views.push({
        name: viewName,
        type: 'function',
        method,
        authentication,
        permissions,
        template,
      });
    }

    // Class-based views
    while ((match = classViewPattern.exec(content)) !== null) {
      const className = match[1];
      const baseClass = match[2];
      const method = this.extractClassViewMethod(baseClass);
      const authentication = this.extractViewAuthentication(content.slice(match.index));
      const permissions = this.extractViewPermissions(content.slice(match.index));

      views.push({
        name: className,
        type: 'class',
        method,
        authentication,
        permissions,
      });
    }

    return views;
  }

  private extractViewMethod(viewContent: string): 'GET' | 'POST' | 'PUT' | 'DELETE' {
    if (viewContent.includes('request.method') && viewContent.includes('POST')) return 'POST';
    if (viewContent.includes('request.method') && viewContent.includes('PUT')) return 'PUT';
    if (viewContent.includes('request.method') && viewContent.includes('DELETE')) return 'DELETE';
    return 'GET';
  }

  private extractClassViewMethod(baseClass: string): 'GET' | 'POST' | 'PUT' | 'DELETE' {
    if (baseClass.includes('CreateView') || baseClass.includes('UpdateView')) return 'POST';
    if (baseClass.includes('DeleteView')) return 'DELETE';
    return 'GET';
  }

  private extractViewAuthentication(viewContent: string): boolean {
    return (
      viewContent.includes('@login_required') ||
      viewContent.includes('@permission_required') ||
      viewContent.includes('login_required') ||
      viewContent.includes('permission_required')
    );
  }

  private extractViewPermissions(viewContent: string): string[] {
    const permissions: string[] = [];
    const permPattern = /@permission_required\(\s*['"]([^'"]+)['"]\s*\)/g;
    let match;

    while ((match = permPattern.exec(viewContent)) !== null) {
      permissions.push(match[1]);
    }

    return permissions;
  }

  private extractViewTemplate(viewContent: string): string | undefined {
    const templatePattern = /return\s+render\s*\(\s*request,\s*['"]([^'"]+)['"]/;
    const match = viewContent.match(templatePattern);
    return match ? match[1] : undefined;
  }

  private extractORMInfo(content: string) {
    const queryComplexity = this.calculateQueryComplexity(content);
    const relationships = this.extractORMRelationships(content);
    const optimizedQueries = this.hasOptimizedQueries(content);
    const nPlusOneIssues = this.hasNPlusOneIssues(content);

    return {
      queryComplexity,
      relationships,
      optimizedQueries,
      nPlusOneIssues,
    };
  }

  private calculateQueryComplexity(content: string): number {
    let complexity = 0;

    // Count ORM operations
    complexity += (content.match(/\.filter\(/g) || []).length * 2;
    complexity += (content.match(/\.exclude\(/g) || []).length * 2;
    complexity += (content.match(/\.annotate\(/g) || []).length * 3;
    complexity += (content.match(/\.aggregate\(/g) || []).length * 3;
    complexity += (content.match(/\.order_by\(/g) || []).length * 1;
    complexity += (content.match(/\.distinct\(/g) || []).length * 2;

    // Count joins and relationships
    complexity += (content.match(/\.select_related\(/g) || []).length * 2;
    complexity += (content.match(/\.prefetch_related\(/g) || []).length * 2;
    complexity += (content.match(/ForeignKey\(/g) || []).length * 3;
    complexity += (content.match(/ManyToManyField\(/g) || []).length * 4;

    return Math.max(1, complexity);
  }

  private extractORMRelationships(content: string): string[] {
    const relationships: string[] = [];

    const relationshipPattern =
      /(\w+)\s*=\s*models\.(ForeignKey|ManyToManyField|OneToOneField)\s*\(\s*['"]([^'"]+)['"]/g;
    let match;

    while ((match = relationshipPattern.exec(content)) !== null) {
      relationships.push(`${match[1]} -> ${match[3]}`);
    }

    return relationships;
  }

  private hasOptimizedQueries(content: string): boolean {
    return (
      content.includes('select_related') ||
      content.includes('prefetch_related') ||
      content.includes('only') ||
      content.includes('defer')
    );
  }

  private hasNPlusOneIssues(content: string): boolean {
    const hasLoops = content.includes('for ') && content.includes('.all()');
    const hasRelationships = content.includes('ForeignKey') || content.includes('ManyToManyField');
    const noOptimization =
      !content.includes('select_related') && !content.includes('prefetch_related');

    return hasLoops && hasRelationships && noOptimization;
  }

  private extractDjangoPatterns(content: string) {
    return {
      usesSignals:
        content.includes('Signal') ||
        content.includes('post_save') ||
        content.includes('pre_delete'),
      usesMiddleware: content.includes('MIDDLEWARE') || content.includes('middleware'),
      usesDecorators: /@\w+/.test(content),
      usesGenericViews:
        content.includes('ListView') ||
        content.includes('DetailView') ||
        content.includes('CreateView'),
    };
  }

  private extractDjangoImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_statement' || n.type === 'import_from_statement') {
        const importText = this.getNodeText(n, sourceCode);
        if (importText.includes('django')) {
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

  private isStandaloneDjangoComponent(
    node: Parser.SyntaxNode,
    djangoType: 'model' | 'view' | 'other'
  ): boolean {
    if (djangoType === 'model') {
      return node.type === 'class_definition';
    }
    if (djangoType === 'view') {
      return node.type === 'function_definition' || node.type === 'decorated_definition';
    }
    return false;
  }

  private calculateDjangoComplexity(
    content: string,
    djangoType: 'model' | 'view' | 'other'
  ): number {
    let complexity = 0;

    if (djangoType === 'model') {
      // Base model complexity
      complexity += content.match(/class\s+\w+\s*\(\s*models\.Model\s*\)/g)?.length || 0;

      // Field complexity
      complexity += (content.match(/models\.\w+Field\(/g) || []).length;

      // Relationship complexity
      complexity += (content.match(/models\.ForeignKey\(/g) || []).length * 3;
      complexity += (content.match(/models\.ManyToManyField\(/g) || []).length * 4;
      complexity += (content.match(/models\.OneToOneField\(/g) || []).length * 2;

      // Meta class complexity
      complexity += content.includes('class Meta:') ? 2 : 0;
    } else if (djangoType === 'view') {
      // Base view complexity
      complexity += content.match(/def\s+\w+\s*\(\s*request\b/g)?.length || 0;

      // HTTP method handling
      complexity += (content.match(/request\.method/g) || []).length * 2;

      // Response types
      complexity += (content.match(/render\(/g) || []).length * 2;
      complexity += (content.match(/JsonResponse\(/g) || []).length * 2;
      complexity += (content.match(/HttpResponse\(/g) || []).length * 2;

      // Query complexity
      complexity += this.calculateQueryComplexity(content);

      // Authentication and authorization
      complexity += content.includes('@login_required') ? 2 : 0;
      complexity += (content.match(/@permission_required/g) || []).length * 2;
    }

    return Math.max(1, complexity);
  }
}
