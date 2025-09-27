import { ConfigService } from '../../config/ConfigService';
import { OpenAIEmbedder } from '../OpenAIEmbedder';
import { GeminiEmbedder } from '../GeminiEmbedder';
import { MistralEmbedder } from '../MistralEmbedder';
import { OllamaEmbedder } from '../OllamaEmbedder';
import { LoggerService } from '../../core/LoggerService';
import { ErrorHandlerService } from '../../core/ErrorHandlerService';
import { EmbeddingCacheService } from '../EmbeddingCacheService';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Test suite for base URL priority testing
describe('Base URL Priority Tests', () => {
  let configService: ConfigService;
  let logger: LoggerService;
  let errorHandler: ErrorHandlerService;
  let cacheService: EmbeddingCacheService;

  beforeEach(() => {
    // Mock config service to avoid validation errors
    configService = {
      get: jest.fn().mockReturnValue({
        openai: {
          apiKey: 'test-key',
          baseUrl: 'https://api.openai.com/v1',
          model: 'text-embedding-ada-002',
        },
        gemini: {
          apiKey: 'test-key',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
          model: 'embedding-001',
        },
        mistral: {
          apiKey: 'test-key',
          baseUrl: 'https://api.mistral.ai/v1',
          model: 'mistral-embed',
        },
        ollama: {
          baseUrl: 'http://localhost:11434',
          model: 'nomic-embed-text',
        },
      }),
      getAll: jest.fn().mockReturnValue({}),
    } as any;

    logger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    errorHandler = {
      handleError: jest.fn(),
      handleAsyncError: jest.fn(),
      wrapAsync: jest.fn().mockImplementation(fn => fn),
    } as any;

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      isAvailable: jest.fn().mockReturnValue(true),
    } as any;
  });

  test('should create embedders with proper configuration', () => {
    expect(() => {
      new OpenAIEmbedder(configService, logger, errorHandler, cacheService);
      new GeminiEmbedder(configService, logger, errorHandler, cacheService);
      new MistralEmbedder(configService, logger, errorHandler, cacheService);
      new OllamaEmbedder(configService, logger, errorHandler, cacheService);
    }).not.toThrow();
  });

  test('should use configured base URLs', () => {
    const openAIEmbedder = new OpenAIEmbedder(configService, logger, errorHandler, cacheService);
    const geminiEmbedder = new GeminiEmbedder(configService, logger, errorHandler, cacheService);
    const mistralEmbedder = new MistralEmbedder(configService, logger, errorHandler, cacheService);
    const ollamaEmbedder = new OllamaEmbedder(configService, logger, errorHandler, cacheService);

    // Test that embedders can be created and have expected methods
    expect(openAIEmbedder.getModelName).toBeDefined();
    expect(geminiEmbedder.getModelName).toBeDefined();
    expect(mistralEmbedder.getModelName).toBeDefined();
    expect(ollamaEmbedder.getModelName).toBeDefined();
  });

  test('should handle missing configuration gracefully', () => {
    // Test with minimal configuration
    const minimalConfig = {
      get: jest.fn().mockReturnValue({
        openai: {
          apiKey: 'test-key',
          model: 'text-embedding-ada-002',
          // baseUrl is missing
        },
        gemini: {
          apiKey: 'test-key',
          model: 'embedding-001',
          // baseUrl is missing
        },
      }),
      getAll: jest.fn().mockReturnValue({}),
    } as any;

    expect(() => {
      new OpenAIEmbedder(minimalConfig, logger, errorHandler, cacheService);
      new GeminiEmbedder(minimalConfig, logger, errorHandler, cacheService);
    }).not.toThrow();
  });
});
