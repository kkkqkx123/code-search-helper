import { BusinessQueryBuilder } from '../BusinessQueryBuilder';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorHandlerService } from '../../../../utils/ErrorHandlerService';
import { ConfigService } from '../../../../config/ConfigService';
import { NebulaQueryBuilder } from '../../../../database/nebula/query/NebulaQueryBuilder';

const mockLoggerService = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

const mockErrorHandler = {
  handleError: jest.fn()
};

const mockConfigService = {
  get: jest.fn()
};

const mockNebulaQueryBuilder = {
  buildQuery: jest.fn()
};

describe('BusinessQueryBuilder', () => {
  let businessQueryBuilder: BusinessQueryBuilder;

  beforeEach(() => {
    businessQueryBuilder = new BusinessQueryBuilder(
      mockLoggerService as unknown as LoggerService,
      mockErrorHandler as unknown as ErrorHandlerService,
      mockConfigService as unknown as ConfigService,
      mockNebulaQueryBuilder as unknown as NebulaQueryBuilder
    );
  });

  describe('buildNodeCountQuery', () => {
    it('should build a node count query', () => {
      const result = businessQueryBuilder.buildNodeCountQuery('File');
      expect(result.nGQL).toContain('LOOKUP ON `File`');
      expect(result.nGQL).toContain('count');
    });
  });

  describe('buildPathQuery', () => {
    it('should build a shortest path query', () => {
      const result = businessQueryBuilder.buildPathQuery('node1', 'node2', 5);
      expect(result.nGQL).toContain('FIND SHORTEST PATH');
      expect(result.nGQL).toContain('node1');
      expect(result.nGQL).toContain('node2');
    });
  });
});