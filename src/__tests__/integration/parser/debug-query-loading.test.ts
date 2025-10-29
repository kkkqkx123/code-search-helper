import { QueryLoader } from '../../../service/parser/core/query/QueryLoader';
import { LoggerService } from '../../../utils/LoggerService';

describe('Debug Query Loading', () => {
  let logger: LoggerService;

  beforeAll(() => {
    logger = new LoggerService();
  });

  it('should load Go query patterns correctly', async () => {
    // 加载Go语言查询
    await QueryLoader.loadLanguageQueries('go');
    
    // 检查Go语言是否已加载
    expect(QueryLoader.isLanguageLoaded('go')).toBe(true);
    
    // 获取Go语言支持的查询类型
    const queryTypes = QueryLoader.getQueryTypesForLanguage('go');
    logger.info('Go query types:', queryTypes);
    
    // 应该包含functions查询类型
    expect(queryTypes).toContain('functions');
    expect(queryTypes).toContain('classes');
    expect(queryTypes).toContain('variables');
    expect(queryTypes).toContain('imports');
    
    // 检查functions查询是否存在
    const hasFunctions = QueryLoader.hasQueryType('go', 'functions');
    logger.info('Go has functions query:', hasFunctions);
    expect(hasFunctions).toBe(true);
    
    // 获取functions查询字符串
    const functionsQuery = QueryLoader.getQuery('go', 'functions');
    logger.info('Functions query:', functionsQuery);
    expect(functionsQuery).toBeDefined();
    expect(functionsQuery.length).toBeGreaterThan(0);
    
    // 检查classes查询是否存在
    const hasClasses = QueryLoader.hasQueryType('go', 'classes');
    logger.info('Go has classes query:', hasClasses);
    expect(hasClasses).toBe(true);
    
    // 获取classes查询字符串
    const classesQuery = QueryLoader.getQuery('go', 'classes');
    logger.info('Classes query:', classesQuery);
    expect(classesQuery).toBeDefined();
    expect(classesQuery.length).toBeGreaterThan(0);
  });
});