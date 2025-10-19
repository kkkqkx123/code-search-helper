import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from '../types';
import { FaultToleranceHandler } from '../utils/FaultToleranceHandler';
import { GraphDataMappingService } from '../service/graph/mapping/GraphDataMappingService';
import { LoggerService } from '../utils/LoggerService';
import { TransactionLogger } from '../service/transaction/TransactionLogger';
import { GraphMappingCache } from '../service/graph/caching/GraphMappingCache';
import { DataMappingValidator } from '../service/validation/DataMappingValidator';
import { GraphBatchOptimizer } from '../service/graph/utils/GraphBatchOptimizer';
import { GraphConfigService } from '../config/service/GraphConfigService';
import { ConfigService } from '../config/ConfigService';

describe('FaultTolerance Integration', () => {
  let container: Container;
  let faultToleranceHandler: FaultToleranceHandler;
  let graphDataMappingService: GraphDataMappingService;

  beforeEach(() => {
    container = new Container();
    
    // Mock services
    const mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    } as any;
    
    const mockTransactionLogger = {
      logTransaction: jest.fn()
    } as any;
    
    const mockCache = {
      getMappingResult: jest.fn(),
      getFileAnalysis: jest.fn(),
      clear: jest.fn(),
      getStats: jest.fn()
    } as any;
    
    const mockValidator = {} as any;
    
    const mockBatchOptimizer = {} as any;
    
    const mockConfigService = {
      get: jest.fn().mockReturnValue({
        maxRetries: 2,
        retryDelay: 100,
        exponentialBackoff: true,
        circuitBreakerEnabled: true,
        circuitBreakerFailureThreshold: 1,
        circuitBreakerTimeout: 1000,
        fallbackStrategy: 'cache'
      })
    } as any;
    
    const faultToleranceOptions = {
      maxRetries: 2,
      retryDelay: 100,
      exponentialBackoff: true,
      circuitBreakerEnabled: true,
      circuitBreakerFailureThreshold: 1,
      circuitBreakerTimeout: 1000,
      fallbackStrategy: 'cache' as 'cache' | 'default' | 'error'
    };
    
    const mockGraphCacheService = {
      getGraphData: jest.fn(),
      setGraphData: jest.fn(),
      clearGraphCache: jest.fn(),
      getGraphCacheStats: jest.fn()
    } as any;

    // Register services
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(mockLogger);
    container.bind<TransactionLogger>(TYPES.TransactionLogger).toConstantValue(mockTransactionLogger);
    container.bind<GraphMappingCache>(TYPES.GraphMappingCache).toConstantValue(mockCache);
    container.bind<DataMappingValidator>(TYPES.DataMappingValidator).toConstantValue(mockValidator);
    container.bind<GraphBatchOptimizer>(TYPES.GraphBatchOptimizer).toConstantValue(mockBatchOptimizer);
    container.bind<ConfigService>(TYPES.ConfigService).toConstantValue(mockConfigService);
    container.bind<GraphConfigService>(TYPES.GraphConfigService).toConstantValue(new GraphConfigService(mockConfigService));
    container.bind<any>(TYPES.GraphCacheService).toConstantValue(mockGraphCacheService);

    // Register FaultToleranceHandler with config
    container.bind<FaultToleranceHandler>(TYPES.FaultToleranceHandler).toDynamicValue(context => {
      const logger = context.get<LoggerService>(TYPES.LoggerService);
      const transactionLogger = context.get<TransactionLogger>(TYPES.TransactionLogger);
      const cache = context.get<GraphMappingCache>(TYPES.GraphMappingCache);
      
      return new FaultToleranceHandler(
        logger,
        transactionLogger,
        cache,
        faultToleranceOptions
      );
    }).inSingletonScope();

    // Register GraphDataMappingService
    container.bind<GraphDataMappingService>(TYPES.GraphDataMappingService).to(GraphDataMappingService).inSingletonScope();

    faultToleranceHandler = container.get<FaultToleranceHandler>(TYPES.FaultToleranceHandler);
    graphDataMappingService = container.get<GraphDataMappingService>(TYPES.GraphDataMappingService);
  });

  it('should register FaultToleranceHandler successfully', () => {
    expect(faultToleranceHandler).toBeDefined();
    expect(faultToleranceHandler).toBeInstanceOf(FaultToleranceHandler);
  });

  it('should register GraphDataMappingService with fault tolerance', () => {
    expect(graphDataMappingService).toBeDefined();
    expect(graphDataMappingService).toBeInstanceOf(GraphDataMappingService);
  });

  it('should execute operation with fault tolerance', async () => {
    const mockOperation = jest.fn().mockResolvedValue('success');
    
    const result = await faultToleranceHandler.executeWithFaultTolerance(
      mockOperation,
      'testOperation',
      {}
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should retry failed operation', async () => {
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('success');

    const result = await faultToleranceHandler.executeWithFaultTolerance(
      mockOperation,
      'testOperation',
      {}
    );

    expect(result.success).toBe(true);
    expect(result.data).toBe('success');
    expect(result.retries).toBe(2);
  });

  it('should use circuit breaker after multiple failures', async () => {
    const mockOperation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

    // First call - should fail after retries
    const result1 = await faultToleranceHandler.executeWithFaultTolerance(
      mockOperation,
      'testOperation',
      {}
    );

    expect(result1.success).toBe(false);
    expect(result1.circuitBreakerState?.state).toBe('OPEN');

    // Second call - should use fallback due to open circuit breaker
    const result2 = await faultToleranceHandler.executeWithFaultTolerance(
      mockOperation,
      'testOperation',
      {}
    );

    expect(result2.success).toBe(false);
    expect(result2.circuitBreakerState?.state).toBe('OPEN');
  });

  it('should integrate with GraphDataMappingService', async () => {
    // Mock successful mapping
    const mockCache = container.get<GraphMappingCache>(TYPES.GraphMappingCache);
    (mockCache.getMappingResult as jest.Mock).mockResolvedValue(null);
    
    const mockGraphCacheService = container.get<any>(TYPES.GraphCacheService);
    (mockGraphCacheService.getGraphData as jest.Mock).mockResolvedValue(null);
    (mockGraphCacheService.setGraphData as jest.Mock).mockResolvedValue(undefined);

    const result = await graphDataMappingService.mapFileToGraphNodes(
      'test.js',
      'console.log("test");',
      {
        filePath: 'test.js',
        language: 'javascript',
        ast: {},
        functions: [],
        classes: [],
        imports: [],
        variables: []
      }
    );

    expect(result).toBeDefined();
    expect(result.nodes).toBeDefined();
    expect(result.relationships).toBeDefined();
    expect(result.stats).toBeDefined();
  });
});