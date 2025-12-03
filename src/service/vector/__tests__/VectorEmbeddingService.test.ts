import { VectorEmbeddingService, EmbeddingOptions } from '../embedding/VectorEmbeddingService';
import { EmbedderFactory } from '../../../embedders/EmbedderFactory';
import { BatchProcessingService } from '../../../infrastructure/batching/BatchProcessingService';
import { LoggerService } from '../../../utils/LoggerService';
import { BaseEmbedder } from '../../../embedders/BaseEmbedder';

describe('VectorEmbeddingService', () => {
  let vectorEmbeddingService: VectorEmbeddingService;
  let mockEmbedderFactory: jest.Mocked<EmbedderFactory>;
  let mockBatchProcessor: jest.Mocked<BatchProcessingService>;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let mockEmbedder: jest.Mocked<BaseEmbedder>;

  beforeEach(() => {
    mockEmbedderFactory = {
      getEmbedder: jest.fn(),
    } as any;

    mockBatchProcessor = {
      processBatches: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockEmbedder = {
      embed: jest.fn(),
    } as any;

    vectorEmbeddingService = new VectorEmbeddingService(
      mockEmbedderFactory,
      mockBatchProcessor,
      mockLoggerService
    );
  });

  describe('generateEmbedding', () => {
    it('should generate embedding using embedder factory', async () => {
      // Arrange
      const content = 'function test() { return true; }';
      const options: EmbeddingOptions = { provider: 'test-provider' };
      const expectedVector = [0.1, 0.2, 0.3, 0.4];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue({
        vector: expectedVector,
        dimensions: expectedVector.length,
        model: 'test-model',
        processingTime: 100
      });

      // Act
      const result = await vectorEmbeddingService.generateEmbedding(content, options);

      // Assert
      expect(result).toEqual(expectedVector);
      expect(mockEmbedderFactory.getEmbedder).toHaveBeenCalledWith('test-provider');
      expect(mockEmbedder.embed).toHaveBeenCalledWith({ text: content });
    });

    it('should use default provider when not specified', async () => {
      // Arrange
      const content = 'function test() { return true; }';
      const expectedVector = [0.1, 0.2, 0.3, 0.4];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue({
        vector: expectedVector,
        dimensions: expectedVector.length,
        model: 'test-model',
        processingTime: 100
      });

      // Act
      const result = await vectorEmbeddingService.generateEmbedding(content);

      // Assert
      expect(result).toEqual(expectedVector);
      expect(mockEmbedderFactory.getEmbedder).toHaveBeenCalledWith('default');
    });

    it('should handle array result from embedder', async () => {
      // Arrange
      const content = 'function test() { return true; }';
      const expectedVector = [0.1, 0.2, 0.3, 0.4];

      mockEmbedderFactory.getEmbedder.mockResolvedValue(mockEmbedder);
      mockEmbedder.embed.mockResolvedValue([{
        vector: expectedVector,
        dimensions: expectedVector.length,
        model: 'test-model',
        processingTime: 100
      }]);

      // Act
      const result = await vectorEmbeddingService.generateEmbedding(content);

      // Assert
      expect(result).toEqual(expectedVector);
    });

    it('should handle errors during embedding generation', async () => {
      // Arrange
      const content = 'function test() { return true; }';
      const error = new Error('Embedding generation failed');

      mockEmbedderFactory.getEmbedder.mockRejectedValue(error);

      // Act & Assert
      await expect(vectorEmbeddingService.generateEmbedding(content)).rejects.toThrow('Embedding generation failed');
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should generate batch embeddings using batch processor', async () => {
      // Arrange
      const contents = ['content1', 'content2', 'content3'];
      const options: EmbeddingOptions = { provider: 'test-provider', batchSize: 2 };
      const expectedEmbeddings = [
        [0.1, 0.2, 0.3, 0.4],
        [0.5, 0.6, 0.7, 0.8],
        [0.9, 1.0, 1.1, 1.2]
      ];

      mockBatchProcessor.processBatches.mockImplementation(async (items: any, processor: (arg0: any[]) => any) => {
        const results = [];
        for (const item of items) {
          const embeddingResults = await processor([item]);
          results.push(...embeddingResults);
        }
        return results;
      });

      // Mock the generateEmbedding method
      jest.spyOn(vectorEmbeddingService, 'generateEmbedding')
        .mockResolvedValueOnce(expectedEmbeddings[0])
        .mockResolvedValueOnce(expectedEmbeddings[1])
        .mockResolvedValueOnce(expectedEmbeddings[2]);

      // Act
      const result = await vectorEmbeddingService.generateBatchEmbeddings(contents, options);

      // Assert
      expect(result).toEqual(expectedEmbeddings);
      expect(mockBatchProcessor.processBatches).toHaveBeenCalledWith(
        contents,
        expect.any(Function),
        { batchSize: 2 }
      );
    });

    it('should use default batch size when not specified', async () => {
      // Arrange
      const contents = ['content1'];
      const expectedEmbeddings = [[0.1, 0.2, 0.3, 0.4]];

      mockBatchProcessor.processBatches.mockImplementation(async (items: any, processor: (arg0: any) => any) => {
        return await processor(items);
      });

      jest.spyOn(vectorEmbeddingService, 'generateEmbedding')
        .mockResolvedValueOnce(expectedEmbeddings[0]);

      // Act
      const result = await vectorEmbeddingService.generateBatchEmbeddings(contents);

      // Assert
      expect(result).toEqual(expectedEmbeddings);
      expect(mockBatchProcessor.processBatches).toHaveBeenCalledWith(
        contents,
        expect.any(Function),
        { batchSize: 100 }
      );
    });
  });
});