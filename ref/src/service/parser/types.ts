// Existing CodeChunk interface for backward compatibility
export interface CodeChunk {
  id: string;
  content: string;
  startLine: number;
  endLine: number;
  startByte: number;
  endByte: number;
  type: string;
  functionName?: string;
  className?: string;
  imports: string[];
  exports: string[];
  metadata: Record<string, any>;
}

// Standardized CodeChunk interface for the Splitter
export interface StandardizedCodeChunk {
  content: string;
  metadata: {
    startLine: number;
    endLine: number;
    language: string;
    filePath?: string;
  }
}

export interface SnippetMetadata {
  snippetType:
    | 'control_structure'
    | 'error_handling'
    | 'function_call_chain'
    | 'expression_sequence'
    | 'comment_marked'
    | 'logic_block'
    | 'object_array_literal'
    | 'arithmetic_logical_expression'
    | 'template_literal'
    | 'destructuring_assignment'
    | 'generic_pattern'
    | 'decorator_pattern'
    | 'async_pattern'
    | 'python_comprehension'
    | 'java_stream'
    | 'java_lambda'
    | 'functional_programming'
    | 'go_goroutine'
    | 'go_interface'
    | 'react_component'
    | 'django_model'
    | 'django_view'
    | 'spring_boot_controller'
    | 'pytorch_neural_network'
    | 'vue_component'
    | 'express_route'
    | 'pytest_test'
    | 'junit_test'
    | 'angular_component'
    | 'fastapi_route'
    | 'data_manipulation'
    | 'go_web_framework'
    | 'build_configuration'
    | 'package_management'
    | 'docker_containerization'
    | 'cicd_configuration';
  contextInfo: {
    parentFunction?: string;
    parentClass?: string;
    nestingLevel: number;
    surroundingCode?: string;
  };
  languageFeatures: {
    usesAsync?: boolean;
    usesGenerators?: boolean;
    usesDestructuring?: boolean;
    usesSpread?: boolean;
    usesTemplateLiterals?: boolean;
  };
  complexity: number;
  isStandalone: boolean;
  hasSideEffects: boolean;
  commentMarkers?: string[];
  // Extended properties for specific snippet types
  genericInfo?: {
    typeParameters: string[];
    constraints: string[];
    usesWildcards: boolean;
    genericPurpose?: string;
    nestingLevel: number;
  };
  decoratorInfo?: {
    decoratorCount: number;
    decoratorTypes: string[];
    hasClassDecorators: boolean;
    hasMethodDecorators: boolean;
    hasPropertyDecorators: boolean;
    decorators: string[];
    annotationTypes: string[];
    hasParameterizedDecorators: boolean;
    decoratorPurpose?: string;
  };
  asyncPattern?: string;
  comprehensionInfo?: {
    type: 'list' | 'dict' | 'set' | 'generator';
    conditions: number;
    loops: number;
    isNested: boolean;
    complexity: number;
  };
  javaStreamInfo?: {
    operations: string[];
    collectors: string[];
    usesParallelStream: boolean;
    usesMethodReferences: boolean;
    usesLambdas: boolean;
    chainingDepth: number;
    streamType?: 'sequential' | 'parallel';
    purpose?: string;
  };
  javaLambdaInfo?: {
    lambdaExpressions: string[];
    methodReferences: string[];
    functionalInterfaces: string[];
    lambdaParameters: number[];
    hasBlockBody: boolean;
    hasExpressionBody: boolean;
    purpose?: string;
  };
  goConcurrencyInfo?: {
    goroutines: number;
    channels: string[];
    usesSelect: boolean;
    usesWaitGroup: boolean;
    usesMutex: boolean;
    communicationPatterns: string[];
    purpose?: string;
  };
  goInterfaceInfo?: {
    interfaces: string[];
    embeddedInterfaces: string[];
    methodSignatures: string[];
    implementations: string[];
    usesEmptyInterface: boolean;
    interfaceSize: number;
    purpose?: string;
  };
  callChainInfo?: {
    chainLength: number;
    hasAsyncOperations: boolean;
    hasCallbacks: boolean;
    hasComplexArguments: boolean;
    callType?: 'simple' | 'chained' | 'async' | 'callback_based';
  };
  functionalInfo?: {
    usesArrowFunctions: boolean;
    usesFunctionComposition: boolean;
    usesHigherOrderFunctions: boolean;
    usesCurrying: boolean;
    usesRecursion: boolean;
    usesImmutability: boolean;
    complexity: number;
  };
  reactInfo?: {
    componentType: 'functional' | 'class';
    hooks: {
      useState: number;
      useEffect: number;
      useContext: number;
      useReducer: number;
      useCallback: number;
      useMemo: number;
      customHooks: string[];
    };
    jsxComplexity: {
      elementCount: number;
      nestedDepth: number;
      conditionalRendering: boolean;
      listRendering: boolean;
    };
    props: {
      destructured: string[];
      defaultValues: Record<string, any>;
      validation: boolean;
    };
    state: {
      stateVariables: string[];
      stateUpdaters: string[];
      complexState: boolean;
    };
    lifecycle: {
      useEffectDeps: string[][];
      cleanupFunctions: number;
    };
    performance: {
      memoizedComponents: boolean;
      memoizedCallbacks: boolean;
      lazyComponents: boolean;
    };
  };
  djangoInfo?: {
    models: {
      modelName: string;
      fields: {
        name: string;
        type: string;
        constraints: string[];
        relationships: {
          type: 'ForeignKey' | 'ManyToMany' | 'OneToOne';
          relatedModel: string;
        }[];
      }[];
      meta: {
        dbTable?: string;
        ordering?: string[];
        verboseName?: string;
      };
    }[];
    views: {
      name: string;
      type: 'function' | 'class';
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      authentication: boolean;
      permissions: string[];
      template?: string;
    }[];
    orm: {
      queryComplexity: number;
      relationships: string[];
      optimizedQueries: boolean;
      nPlusOneIssues: boolean;
    };
    patterns: {
      usesSignals: boolean;
      usesMiddleware: boolean;
      usesDecorators: boolean;
      usesGenericViews: boolean;
    };
  };
  springBootInfo?: {
    application: {
      mainClass?: string;
      packages: string[];
      autoConfigurations: string[];
    };
    controllers: {
      className: string;
      type: 'RestController' | 'Controller';
      endpoints: {
        path: string;
        method: string;
        parameters: string[];
        returnTypes: string;
      }[];
      requestMappings: string[];
    }[];
    dependencyInjection: {
      beans: string[];
      injections: {
        field: string;
        type: string;
        qualifier?: string;
      }[];
      circularDependencies: boolean;
    };
    data: {
      entities: {
        name: string;
        table: string;
        fields: {
          name: string;
          type: string;
          column: string;
          constraints: string[];
        }[];
        relationships: {
          field: string;
          targetEntity: string;
          type: string;
          cascade: string[];
        }[];
      }[];
      repositories: string[];
      queries: string[];
    };
    transactions: {
      transactionalMethods: string[];
      rollbackRules: string[];
      isolationLevels: string[];
    };
    performance: {
      lazyLoading: boolean;
      cachingEnabled: boolean;
      connectionPooling: boolean;
    };
  };
  pytorchInfo?: {
    neuralNetwork: {
      className: string;
      layers: {
        type: string;
        inputSize: number;
        outputSize: number;
        parameters: Record<string, any>;
      }[];
      totalParameters: number;
      trainableParameters: number;
    };
    training: {
      epochs: number;
      batchSize: number;
      optimizer: string;
      lossFunction: string;
      learningRate: number;
      device: 'cpu' | 'cuda' | 'mps';
    };
    data: {
      inputShape: number[];
      outputShape: number[];
      datasetSize: number;
      dataLoaders: string[];
      augmentation: boolean;
    };
    performance: {
      gpuAcceleration: boolean;
      mixedPrecision: boolean;
      gradientClipping: boolean;
      checkpointing: boolean;
    };
    patterns: {
      usesDistributed: boolean;
      usesCustomLoss: boolean;
      usesScheduler: boolean;
      usesEarlyStopping: boolean;
    };
  };
  vueInfo?: {
    componentType: 'options_api' | 'composition_api' | 'vue2' | 'vue3';
    setupFunction: {
      usesSetup: boolean;
      reactiveDeclarations: string[];
      computedProperties: string[];
      lifecycleHooks: {
        created: number;
        mounted: number;
        updated: number;
        unmounted: number;
      };
    };
    template: {
      directives: string[];
      componentUsage: string[];
      eventHandling: boolean;
      conditionalRendering: boolean;
      listRendering: boolean;
    };
    stateManagement: {
      dataProperties: string[];
      methods: string[];
      watchers: string[];
      usesVuex: boolean;
      usesPinia: boolean;
    };
    composition: {
      refs: string[];
      reactives: string[];
      composables: string[];
      injectProvide: boolean;
    };
    routing: {
      usesVueRouter: boolean;
      routeParams: string[];
      navigationMethods: string[];
    };
  };
  expressInfo?: {
    routeHandlers: {
      path: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';
      handlerType: 'function' | 'async_function' | 'arrow_function' | 'class_method';
      middlewareUsed: string[];
      parameters: {
        routeParams: string[];
        queryParams: string[];
        bodyParams: string[];
      };
    }[];
    middleware: {
      global: string[];
      routeSpecific: string[];
      errorHandling: boolean;
      authentication: boolean;
      validation: boolean;
    };
    routing: {
      usesExpressRouter: boolean;
      nestedRoutes: boolean;
      routeParameters: string[];
      staticFiles: boolean;
    };
    responseHandling: {
      jsonResponses: number;
      renderTemplates: number;
      statusCodes: number[];
      streaming: boolean;
    };
    errorHandling: {
      errorMiddleware: boolean;
      customErrorHandlers: number;
      tryCatchBlocks: number;
      asyncErrorHandling: boolean;
    };
    ecosystem: {
      bodyParser: boolean;
      cookieParser: boolean;
      cors: boolean;
      session: boolean;
      templateEngine?: string;
    };
  };
  pytestInfo?: {
    testStructure: {
      fixtures: string[];
      parametrizedTests: number;
      testCases: number;
      testModules: number;
    };
    patterns: {
      usesPytestFixtures: boolean;
      usesMarkers: boolean;
      usesMocking: boolean;
      usesAsserts: boolean;
      usesFixturesScope: boolean;
    };
    mocking: {
      mockObjects: string[];
      patchCalls: string[];
      spyUsage: boolean;
      sideEffects: boolean;
    };
    configuration: {
      customConfig: boolean;
      commandLineArgs: string[];
      environmentVariables: string[];
      conftestPyUsed: boolean;
    };
    assertions: {
      assertCount: number;
      customAssertions: boolean;
      exceptionTesting: boolean;
      warningTesting: boolean;
    };
    fixtures: {
      autouseFixtures: string[];
      sessionFixtures: string[];
      moduleFixtures: string[];
      classFixtures: string[];
      functionFixtures: string[];
    };
  };
  junitInfo?: {
    testStructure: {
      testClasses: number;
      testMethods: number;
      parameterizedTests: number;
      nestedTests: number;
    };
    annotations: {
      usesTest: boolean;
      usesBeforeEach: boolean;
      usesAfterEach: boolean;
      usesBeforeAll: boolean;
      usesAfterAll: boolean;
      usesParameterizedTest: boolean;
      usesRepeatedTest: boolean;
      usesTimeout: boolean;
      usesDisabled: boolean;
    };
    assertions: {
      assertCount: number;
      customAssertions: boolean;
      assertEqualsCount: number;
      assertTrueCount: number;
      assertNullCount: number;
    };
    lifecycle: {
      beforeEachCount: number;
      afterEachCount: number;
      beforeAllCount: number;
      afterAllCount: number;
    };
    parameterization: {
      valueSources: string[];
      methodSources: string[];
      csvSources: string[];
      enumSources: string[];
    };
    extensions: {
      customExtensions: string[];
      usesMockito: boolean;
      usesAssertJ: boolean;
      usesHamcrest: boolean;
    };
    performance: {
      timeoutUsage: boolean;
      parallelExecution: boolean;
      repeatedTests: number;
    };
  };
  goFrameworkInfo?: {
    complexity: number;
    tags: string[];
    framework: {
      name: string;
      version: string;
      patterns: string[];
      features: string[];
    };
    httpMethods: string[];
    middleware: string[];
    database: string[];
  };
  buildInfo?: {
    complexity: number;
    tags: string[];
    buildSystem: 'maven' | 'gradle' | 'unknown';
    buildType: string;
    dependencies: string[];
    plugins: string[];
    repositories: string[];
    properties: Record<string, string>;
    profiles: string[];
  };
  fastapiInfo?: {
    complexity: number;
    tags: string[];
    framework: {
      name: string;
      version: string;
      patterns: string[];
      features: string[];
    };
    endpointInfo?: {
      method?: string;
      path?: string;
      responseModel?: string;
      statusCode?: string;
    };
    dataModels: string[];
    dependencies: string[];
    authentication?: {
      type?: string;
      scheme?: string;
    };
  };
}

export interface SnippetChunk extends CodeChunk {
  type: 'snippet';
  snippetMetadata: SnippetMetadata;
}
