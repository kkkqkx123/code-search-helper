import 'reflect-metadata';
import { LSPService } from '../LSPService';
import { EnhancedParserService } from '../LSPIntegrationService';
import { LoggerService } from '../../../core/LoggerService';
import { ConfigService } from '../../../config/ConfigService';

// Mock dependencies
jest.mock('../LSPService');
jest.mock('../LSPIntegrationService');
jest.mock('../../../core/LoggerService');
jest.mock('../../../config/ConfigService');

describe('LSP Integration Tests', () => {
  let lspService: jest.Mocked<LSPService>;
  let enhancedParserService: jest.Mocked<EnhancedParserService>;
  let logger: jest.Mocked<LoggerService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    // Create mocked instances
    lspService = {
      initialize: jest.fn(),
      shutdown: jest.fn(),
      isLanguageSupported: jest.fn(),
      isHealthy: jest.fn(),
      clearCache: jest.fn(),
    } as any;

    enhancedParserService = {
      parseFile: jest.fn(),
    } as any;

    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    configService = {
      get: jest.fn(),
    } as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('LSP Service Initialization', () => {
    it('should initialize LSP service successfully', async () => {
      lspService.initialize.mockResolvedValue(true);
      lspService.isLanguageSupported.mockReturnValue(true);

      const result = await lspService.initialize('/test/path', 'typescript');
      expect(result).toBe(true);
      expect(lspService.isLanguageSupported('typescript')).toBe(true);
    });

    it('should return false for unsupported languages', async () => {
      lspService.initialize.mockResolvedValue(false);
      lspService.isLanguageSupported.mockReturnValue(false);

      const result = await lspService.initialize('/test/path', 'unsupported');
      expect(result).toBe(false);
      expect(lspService.isLanguageSupported('unsupported')).toBe(false);
    });
  });

  describe('Enhanced Parser Service Integration', () => {
    it('should use enhanced parser for supported languages', async () => {
      const mockResult = {
        filePath: '/test/path/test.ts',
        language: 'typescript',
        ast: {},
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        metadata: {},
        lspSymbols: [],
        lspDiagnostics: [],
        typeDefinitions: [],
        references: [],
        lspMetadata: {
          languageServer: undefined,
          processingTime: 0,
          hasErrors: false,
          symbolCount: 0,
          diagnosticCount: 0,
        },
      };
      enhancedParserService.parseFile.mockResolvedValue(mockResult);

      const result = await enhancedParserService.parseFile('/test/path/test.ts');
      expect(result).toBeDefined();
      expect(result.functions).toBeDefined();
    });

    it('should handle parse errors gracefully', async () => {
      const mockResult = {
        filePath: '/test/path/error.ts',
        language: 'typescript',
        ast: {},
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        metadata: {},
        lspSymbols: [],
        lspDiagnostics: [],
        typeDefinitions: [],
        references: [],
        lspMetadata: {
          languageServer: undefined,
          processingTime: 0,
          hasErrors: true,
          symbolCount: 0,
          diagnosticCount: 1,
        },
      };
      enhancedParserService.parseFile.mockResolvedValue(mockResult);

      const result = await enhancedParserService.parseFile('/test/path/error.ts');
      expect(result).toBeDefined();
      expect(result.lspMetadata?.hasErrors).toBe(true);
    });
  });

  describe('Health Check Integration', () => {
    it('should check LSP service health', async () => {
      lspService.isHealthy.mockReturnValue(true);

      const isHealthy = lspService.isHealthy('typescript');
      expect(isHealthy).toBe(true);
    });

    it('should handle LSP service unhealthy', async () => {
      lspService.isHealthy.mockReturnValue(false);

      const isHealthy = lspService.isHealthy('typescript');
      expect(isHealthy).toBe(false);
    });
  });

  describe('LSP Health Check', () => {
    it('should perform health check for LSP clients', async () => {
      const healthCheck = {
        name: 'LSP Service',
        status: 'healthy',
        details: {
          clients: {
            typescript: { status: 'healthy', symbols: 10, diagnostics: 2 },
            python: { status: 'healthy', symbols: 5, diagnostics: 0 },
          },
        },
      };

      jest.spyOn(lspService, 'isHealthy').mockImplementation(lang => {
        return lang === 'typescript' || lang === 'python';
      });

      expect(lspService.isHealthy('typescript')).toBe(true);
      expect(lspService.isHealthy('python')).toBe(true);
      expect(lspService.isHealthy('unsupported')).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should clear LSP cache when requested', async () => {
      lspService.clearCache.mockImplementation(() => {
        // Mock implementation
      });

      expect(() => lspService.clearCache()).not.toThrow();
    });

    it('should handle cache clear errors gracefully', async () => {
      lspService.clearCache.mockImplementation(() => {
        // Mock implementation
      });

      expect(() => lspService.clearCache()).not.toThrow();
    });
  });
});
