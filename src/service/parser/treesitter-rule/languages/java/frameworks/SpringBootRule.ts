import * as Parser from 'tree-sitter';
import { SnippetChunk } from '../../../../types';
import { AbstractSnippetRule } from '../../../AbstractSnippetRule';

/**
 * Spring Boot Framework Rule - Identifies Spring Boot components, annotations, and patterns
 */
export class SpringBootRule extends AbstractSnippetRule {
  readonly name = 'SpringBootRule';
  readonly supportedNodeTypes = new Set([
    // Application components
    'class_declaration',
    'interface_declaration',
    'enum_declaration',

    // Method and field declarations
    'method_declaration',
    'field_declaration',
    'constructor_declaration',

    // Annotations
    'annotation',
    'marker_annotation',
    'single_member_annotation',

    // Import statements
    'import_declaration',
  ]);

  protected readonly snippetType = 'spring_boot_controller' as const;

  protected shouldProcessNode(node: Parser.SyntaxNode, sourceCode: string): boolean {
    if (!super.shouldProcessNode(node, sourceCode)) return false;

    const content = this.getNodeText(node, sourceCode);

    // Check if this is Spring Boot-related code
    return this.isSpringBootCode(content);
  }

  protected createSnippet(
    node: Parser.SyntaxNode,
    sourceCode: string,
    nestingLevel: number
  ): SnippetChunk | null {
    const content = this.getNodeText(node, sourceCode);
    const location = this.getNodeLocation(node);
    const contextInfo = this.extractContextInfo(node, sourceCode, nestingLevel);
    const springBootMetadata = this.extractSpringBootMetadata(node, content, sourceCode);

    return {
      id: this.generateSnippetId(content, location.startLine),
      content,
      startLine: location.startLine,
      endLine: location.endLine,
      startByte: node.startIndex,
      endByte: node.endIndex,
      type: 'snippet',
      imports: this.extractSpringBootImports(node, sourceCode),
      exports: [],
      metadata: {},
      snippetMetadata: {
        snippetType: this.snippetType,
        contextInfo,
        languageFeatures: this.analyzeLanguageFeatures(content),
        complexity: this.calculateSpringBootComplexity(content),
        isStandalone: this.isStandaloneSpringComponent(node, content),
        hasSideEffects: this.hasSideEffects(content),
        springBootInfo: springBootMetadata,
      },
    };
  }

  private isSpringBootCode(content: string): boolean {
    const springBootPatterns = [
      // Spring Boot application annotations
      /@SpringBootApplication/,
      /@SpringBootConfiguration/,
      /@EnableAutoConfiguration/,
      /@ComponentScan/,

      // Stereotype annotations
      /@RestController/,
      /@Controller/,
      /@Service/,
      /@Repository/,
      /@Component/,
      /@Configuration/,

      // Web annotations
      /@RequestMapping/,
      /@GetMapping/,
      /@PostMapping/,
      /@PutMapping/,
      /@DeleteMapping/,
      /@PatchMapping/,
      /@RequestBody/,
      /@ResponseBody/,
      /@PathVariable/,
      /@RequestParam/,
      /@RequestHeader/,

      // Dependency injection
      /@Autowired/,
      /@Inject/,
      /@Qualifier/,
      /@Value/,

      // Data annotations
      /@Entity/,
      /@Table/,
      /@Id/,
      /@GeneratedValue/,
      /@Column/,
      /@OneToMany/,
      /@ManyToOne/,
      /@ManyToMany/,
      /@OneToOne/,
      /@JoinColumn/,
      /@JoinTable/,

      // Transaction annotations
      /@Transactional/,
      /@Transactional\(.*readOnly.*\)/,

      // Validation annotations
      /@Valid/,
      /@NotNull/,
      /@NotEmpty/,
      /@NotBlank/,
      /@Size/,
      /@Min/,
      /@Max/,
      /@Email/,
      /@Pattern/,

      // JPA annotations
      /@PersistenceContext/,
      /@PersistenceUnit/,
      /@Query/,
      /@NamedQuery/,
      /@NamedNativeQuery/,

      // Security annotations
      /@PreAuthorize/,
      /@PostAuthorize/,
      /@Secured/,
      /@RolesAllowed/,

      // AOP annotations
      /@Aspect/,
      /@Before/,
      /@After/,
      /@Around/,
      /@AfterReturning/,
      /@AfterThrowing/,

      // Spring Boot specific imports
      /import\s+org\.springframework\./,
      /import\s+org\.springframework\.boot\./,
      /import\s+org\.springframework\.web\./,
      /import\s+org\.springframework\.data\./,
      /import\s+org\.springframework\.transaction\./,
      /import\s+javax\.persistence\./,
      /import\s+jakarta\.persistence\./,

      // Spring Boot starter patterns
      /spring-boot-starter-/,
      /@SpringBootTest/,
      /@TestConfiguration/,
    ];

    return springBootPatterns.some(pattern => pattern.test(content));
  }

  private extractSpringBootMetadata(node: Parser.SyntaxNode, content: string, sourceCode: string) {
    return {
      application: this.extractApplicationInfo(content),
      controllers: this.extractControllers(content),
      dependencyInjection: this.extractDependencyInjection(content),
      data: this.extractDataInfo(content),
      transactions: this.extractTransactionInfo(content),
      performance: this.extractPerformanceInfo(content),
    };
  }

  private extractApplicationInfo(content: string) {
    const mainClassPattern = /@SpringBootApplication\s*\b\s*public\s+class\s+(\w+)/;
    const mainClassMatch = content.match(mainClassPattern);

    const packages = this.extractPackages(content);
    const autoConfigurations = this.extractAutoConfigurations(content);

    return {
      mainClass: mainClassMatch ? mainClassMatch[1] : undefined,
      packages,
      autoConfigurations,
    };
  }

  private extractPackages(content: string): string[] {
    const packages: string[] = [];

    const packagePattern = /@ComponentScan\s*\(\s*basePackages\s*=\s*\{\s*([^}]+)\s*\}/g;
    let match;

    while ((match = packagePattern.exec(content)) !== null) {
      const packageList = match[1].split(',').map(pkg => pkg.trim().replace(/['"]/g, ''));
      packages.push(...packageList);
    }

    return packages;
  }

  private extractAutoConfigurations(content: string): string[] {
    const configurations: string[] = [];

    const autoConfigPattern = /@EnableAutoConfiguration\s*\(\s*exclude\s*=\s*\{\s*([^}]+)\s*\}/g;
    let match;

    while ((match = autoConfigPattern.exec(content)) !== null) {
      const configList = match[1].split(',').map(config => config.trim().replace(/['"]/g, ''));
      configurations.push(...configList);
    }

    return configurations;
  }

  private extractControllers(content: string) {
    const controllers: any[] = [];

    const controllerPattern = /@(RestController|Controller)\s*\b\s*public\s+class\s+(\w+)/g;
    let match;

    while ((match = controllerPattern.exec(content)) !== null) {
      const controllerType = match[1];
      const className = match[2];
      const controllerContent = content.slice(match.index);

      const endpoints = this.extractEndpoints(controllerContent);
      const requestMappings = this.extractRequestMappings(controllerContent);

      controllers.push({
        className,
        type: controllerType === 'RestController' ? 'RestController' : 'Controller',
        endpoints,
        requestMappings,
      });
    }

    return controllers;
  }

  private extractEndpoints(controllerContent: string) {
    const endpoints: any[] = [];

    const mappingPatterns = [
      {
        method: 'GET',
        pattern:
          /@(GetMapping|RequestMapping\s*\(\s*method\s*=\s*RequestMethod\.GET\s*\))\s*\b\s*public\s+\w+\s+(\w+)\s*\(([^)]*)\)/g,
      },
      {
        method: 'POST',
        pattern:
          /@(PostMapping|RequestMapping\s*\(\s*method\s*=\s*RequestMethod\.POST\s*\))\s*\b\s*public\s+\w+\s+(\w+)\s*\(([^)]*)\)/g,
      },
      {
        method: 'PUT',
        pattern:
          /@(PutMapping|RequestMapping\s*\(\s*method\s*=\s*RequestMethod\.PUT\s*\))\s*\b\s*public\s+\w+\s+(\w+)\s*\(([^)]*)\)/g,
      },
      {
        method: 'DELETE',
        pattern:
          /@(DeleteMapping|RequestMapping\s*\(\s*method\s*=\s*RequestMethod\.DELETE\s*\))\s*\b\s*public\s+\w+\s+(\w+)\s*\(([^)]*)\)/g,
      },
    ];

    mappingPatterns.forEach(({ method, pattern }) => {
      let match;
      while ((match = pattern.exec(controllerContent)) !== null) {
        const methodName = match[2];
        const parameters = this.extractMethodParameters(match[3]);
        const returnTypes = this.extractReturnTypes(controllerContent.slice(match.index));

        endpoints.push({
          path: this.extractMappingPath(controllerContent.slice(match.index)),
          method,
          parameters,
          returnTypes,
        });
      }
    });

    return endpoints;
  }

  private extractMethodParameters(parametersStr: string): string[] {
    return parametersStr
      .split(',')
      .map(param => param.trim())
      .filter(param => param.length > 0);
  }

  private extractReturnTypes(methodContent: string): string {
    const returnPattern = /public\s+\w+\s+(\w+)\s*\(/;
    const match = methodContent.match(returnPattern);
    return match ? match[1] : 'void';
  }

  private extractMappingPath(methodContent: string): string {
    const pathPattern =
      /@(GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping)\s*\(\s*["']([^"']+)["']/;
    const match = methodContent.match(pathPattern);
    return match ? match[2] : '/';
  }

  private extractRequestMappings(controllerContent: string): string[] {
    const mappings: string[] = [];

    const mappingPattern = /@RequestMapping\s*\(\s*["']([^"']+)["']/g;
    let match;

    while ((match = mappingPattern.exec(controllerContent)) !== null) {
      mappings.push(match[1]);
    }

    return mappings;
  }

  private extractDependencyInjection(content: string) {
    const beans = this.extractBeans(content);
    const injections = this.extractInjections(content);
    const circularDependencies = this.detectCircularDependencies(content);

    return {
      beans,
      injections,
      circularDependencies,
    };
  }

  private extractBeans(content: string): string[] {
    const beans: string[] = [];

    const beanPatterns = [
      /@Component\s*\b\s*public\s+class\s+(\w+)/,
      /@Service\s*\b\s*public\s+class\s+(\w+)/,
      /@Repository\s*\b\s*public\s+class\s+(\w+)/,
      /@Controller\s*\b\s*public\s+class\s+(\w+)/,
      /@RestController\s*\b\s*public\s+class\s+(\w+)/,
      /@Configuration\s*\b\s*public\s+class\s+(\w+)/,
      /@Bean\s*\b\s*public\s+(\w+)\s+\w+\s*\(/,
      /@Bean\s*\b\s*public\s+(\w+)\s+\w+\s*\(/,
    ];

    beanPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        beans.push(match[1]);
      }
    });

    return [...new Set(beans)]; // Remove duplicates
  }

  private extractInjections(content: string) {
    const injections: any[] = [];

    const autowiredPattern = /@Autowired\s*\b\s*(private|public|protected)?\s*(\w+)\s+(\w+)/g;
    let match;

    while ((match = autowiredPattern.exec(content)) !== null) {
      const field = match[3];
      const type = match[2];

      injections.push({
        field,
        type,
      });
    }

    // Also check for constructor injection
    const constructorPattern = /@Autowired\s*\b\s*public\s+\w+\s*\(([^)]*)\)/g;
    while ((match = constructorPattern.exec(content)) !== null) {
      const params = match[1].split(',').map(param => param.trim());
      params.forEach(param => {
        const parts = param.split(' ');
        if (parts.length >= 2) {
          injections.push({
            field: parts[parts.length - 1],
            type: parts[parts.length - 2],
            qualifier: undefined,
          });
        }
      });
    }

    return injections;
  }

  private detectCircularDependencies(content: string): boolean {
    // Simple heuristic: if there are many @Autowired annotations and complex class relationships
    const autowiredCount = (content.match(/@Autowired/g) || []).length;
    const beanCount = (
      content.match(/@(Component|Service|Repository|Controller|RestController)/g) || []
    ).length;

    return autowiredCount > 5 && beanCount > 3;
  }

  private extractDataInfo(content: string) {
    const entities = this.extractEntities(content);
    const repositories = this.extractRepositories(content);
    const queries = this.extractQueries(content);

    return {
      entities,
      repositories,
      queries,
    };
  }

  private extractEntities(content: string) {
    const entities: any[] = [];

    const entityPattern = /@Entity\s*\b\s*public\s+class\s+(\w+)/g;
    let match;

    while ((match = entityPattern.exec(content)) !== null) {
      const className = match[1];
      const entityContent = content.slice(match.index);

      const table = this.extractTableInfo(entityContent);
      const fields = this.extractEntityFields(entityContent);
      const relationships = this.extractEntityRelationships(entityContent);

      entities.push({
        name: className,
        table,
        fields,
        relationships,
      });
    }

    return entities;
  }

  private extractTableInfo(entityContent: string): string {
    const tablePattern = /@Table\s*\(\s*name\s*=\s*["']([^"']+)["']/;
    const match = entityContent.match(tablePattern);
    return match ? match[1] : '';
  }

  private extractEntityFields(entityContent: string) {
    const fields: any[] = [];

    const fieldPatterns = [
      { type: 'String', pattern: /@Column\s*\([^)]*\)\s*\b\s*private\s+String\s+(\w+)/g },
      { type: 'Integer', pattern: /@Column\s*\([^)]*\)\s*\b\s*private\s+Integer\s+(\w+)/g },
      { type: 'Long', pattern: /@Column\s*\([^)]*\)\s*\b\s*private\s+Long\s+(\w+)/g },
      { type: 'Double', pattern: /@Column\s*\([^)]*\)\s*\b\s*private\s+Double\s+(\w+)/g },
      { type: 'Boolean', pattern: /@Column\s*\([^)]*\)\s*\b\s*private\s+Boolean\s+(\w+)/g },
      { type: 'Date', pattern: /@Column\s*\([^)]*\)\s*\b\s*private\s+Date\s+(\w+)/g },
    ];

    fieldPatterns.forEach(({ type, pattern }) => {
      let match;
      while ((match = pattern.exec(entityContent)) !== null) {
        const fieldName = match[1];
        const columnPattern = /@Column\s*\(\s*name\s*=\s*["']([^"']+)["']/;
        const columnMatch = entityContent.slice(match.index).match(columnPattern);

        const constraints = this.extractFieldConstraints(entityContent.slice(match.index));

        fields.push({
          name: fieldName,
          type,
          column: columnMatch ? columnMatch[1] : fieldName.toLowerCase(),
          constraints,
        });
      }
    });

    return fields;
  }

  private extractFieldConstraints(fieldContent: string): string[] {
    const constraints: string[] = [];

    if (fieldContent.includes('nullable = false')) constraints.push('not_null');
    if (fieldContent.includes('unique = true')) constraints.push('unique');
    if (fieldContent.includes('length =')) constraints.push('length_constraint');
    if (fieldContent.includes('precision =')) constraints.push('precision');
    if (fieldContent.includes('scale =')) constraints.push('scale');

    return constraints;
  }

  private extractEntityRelationships(entityContent: string) {
    const relationships: any[] = [];

    const relationshipPatterns = [
      { type: 'OneToMany', pattern: /@OneToMany\s*\([^)]*\)\s*\b\s*private\s+(\w+)\s+(\w+)/g },
      { type: 'ManyToOne', pattern: /@ManyToOne\s*\([^)]*\)\s*\b\s*private\s+(\w+)\s+(\w+)/g },
      { type: 'ManyToMany', pattern: /@ManyToMany\s*\([^)]*\)\s*\b\s*private\s+(\w+)\s+(\w+)/g },
      { type: 'OneToOne', pattern: /@OneToOne\s*\([^)]*\)\s*\b\s*private\s+(\w+)\s+(\w+)/g },
    ];

    relationshipPatterns.forEach(({ type, pattern }) => {
      let match;
      while ((match = pattern.exec(entityContent)) !== null) {
        const field = match[2];
        const targetEntity = match[1];
        const cascade = this.extractCascadeInfo(entityContent.slice(match.index));

        relationships.push({
          field,
          targetEntity,
          type,
          cascade,
        });
      }
    });

    return relationships;
  }

  private extractCascadeInfo(relationshipContent: string): string[] {
    const cascadePattern = /cascade\s*=\s*\{\s*([^}]+)\s*\}/;
    const match = relationshipContent.match(cascadePattern);

    if (!match) return [];

    return match[1]
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);
  }

  private extractRepositories(content: string): string[] {
    const repositories: string[] = [];

    const repositoryPattern =
      /@(Repository|JpaRepository|CrudRepository|PagingAndSortingRepository)\s*\b\s*public\s+interface\s+(\w+)/g;
    let match;

    while ((match = repositoryPattern.exec(content)) !== null) {
      repositories.push(match[2]);
    }

    return repositories;
  }

  private extractQueries(content: string): string[] {
    const queries: string[] = [];

    const queryPattern = /@Query\s*\(\s*value\s*=\s*["']([^"']+)["']/g;
    let match;

    while ((match = queryPattern.exec(content)) !== null) {
      queries.push(match[1]);
    }

    return queries;
  }

  private extractTransactionInfo(content: string) {
    const transactionalMethods = this.extractTransactionalMethods(content);
    const rollbackRules = this.extractRollbackRules(content);
    const isolationLevels = this.extractIsolationLevels(content);

    return {
      transactionalMethods,
      rollbackRules,
      isolationLevels,
    };
  }

  private extractTransactionalMethods(content: string): string[] {
    const methods: string[] = [];

    const transactionalPattern = /@Transactional\s*\b\s*public\s+(\w+)\s+(\w+)\s*\(/g;
    let match;

    while ((match = transactionalPattern.exec(content)) !== null) {
      const returnType = match[1];
      const methodName = match[2];
      methods.push(`${returnType} ${methodName}`);
    }

    return methods;
  }

  private extractRollbackRules(content: string): string[] {
    const rollbackPattern = /@Transactional\s*\(\s*rollbackFor\s*=\s*\{\s*([^}]+)\s*\}/g;
    const matches = content.match(rollbackPattern) || [];

    return matches
      .map(match => {
        const innerMatch = match.match(/rollbackFor\s*=\s*\{\s*([^}]+)\s*\}/);
        return innerMatch ? innerMatch[1] : '';
      })
      .filter(rule => rule.length > 0);
  }

  private extractIsolationLevels(content: string): string[] {
    const isolationPattern = /@Transactional\s*\(\s*isolation\s*=\s*Isolation\.(\w+)/g;
    const matches = content.match(isolationPattern) || [];

    return matches
      .map(match => {
        const isolationMatch = match.match(/isolation\s*=\s*Isolation\.(\w+)/);
        return isolationMatch ? isolationMatch[1] : '';
      })
      .filter(level => level.length > 0);
  }

  private extractPerformanceInfo(content: string) {
    const lazyLoading = content.includes('@Lazy') || content.includes('fetch = FetchType.LAZY');
    const cachingEnabled =
      content.includes('@Cacheable') ||
      content.includes('@CacheEvict') ||
      content.includes('@CachePut');
    const connectionPooling =
      content.includes('@EnableTransactionManagement') || content.includes('HikariCP');

    return {
      lazyLoading,
      cachingEnabled,
      connectionPooling,
    };
  }

  private extractSpringBootImports(node: Parser.SyntaxNode, sourceCode: string): string[] {
    const imports: string[] = [];

    const traverse = (n: Parser.SyntaxNode) => {
      if (n.type === 'import_declaration') {
        const importText = this.getNodeText(n, sourceCode);
        if (
          importText.includes('org.springframework') ||
          importText.includes('javax.persistence') ||
          importText.includes('jakarta.persistence')
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

  private isStandaloneSpringComponent(node: Parser.SyntaxNode, content: string): boolean {
    const componentAnnotations = [
      '@SpringBootApplication',
      '@RestController',
      '@Controller',
      '@Service',
      '@Repository',
      '@Component',
      '@Configuration',
      '@Entity',
    ];

    return (
      node.type === 'class_declaration' &&
      componentAnnotations.some(annotation => content.includes(annotation))
    );
  }

  private calculateSpringBootComplexity(content: string): number {
    let complexity = 0;

    // Application complexity
    complexity += content.includes('@SpringBootApplication') ? 5 : 0;

    // Controller complexity
    complexity += (content.match(/@(RestController|Controller)/g) || []).length * 3;
    complexity +=
      (content.match(/@(GetMapping|PostMapping|PutMapping|DeleteMapping)/g) || []).length * 2;

    // Service complexity
    complexity += (content.match(/@Service/g) || []).length * 2;

    // Repository complexity
    complexity += (content.match(/@(Repository|JpaRepository)/g) || []).length * 2;

    // Entity complexity
    complexity += (content.match(/@Entity/g) || []).length * 3;
    complexity += (content.match(/@Column/g) || []).length;
    complexity += (content.match(/@(OneToMany|ManyToOne|ManyToMany|OneToOne)/g) || []).length * 2;

    // Transaction complexity
    complexity += (content.match(/@Transactional/g) || []).length * 2;

    // Dependency injection complexity
    complexity += (content.match(/@Autowired/g) || []).length;

    // Security complexity
    complexity += (content.match(/@(PreAuthorize|PostAuthorize|Secured)/g) || []).length * 2;

    // AOP complexity
    complexity += (content.match(/@(Aspect|Before|After|Around)/g) || []).length * 2;

    return Math.max(1, complexity);
  }
}
