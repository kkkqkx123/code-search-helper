import { VectorConversionService } from '../conversion/VectorConversionService';
import { ProjectIdManager } from '../../../database/ProjectIdManager';
import { LoggerService } from '../../../utils/LoggerService';
import { CodeChunk } from '../../parser/types';
import { Vector } from '../types/VectorTypes';
import { VectorPoint } from '../../../database/qdrant/IVectorStore';

describe('VectorConversionService', () => {
  let vectorConversionService: VectorConversionService;
  let mockProjectIdManager: jest.Mocked<ProjectIdManager>;
  let mockLoggerService: jest.Mocked<LoggerService>;

  beforeEach(() => {
    mockProjectIdManager = {
      getProjectId: jest.fn(),
    } as any;

    mockLoggerService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    vectorConversionService = new VectorConversionService(
      mockProjectIdManager,
      mockLoggerService
    );
  });

  describe('convertChunksToVectors', () => {
    it('should convert chunks to vectors successfully', async () => {
      // Arrange
      const chunks: CodeChunk[] = [
        {
          content: 'function test() { return true; }',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'javascript',
            filePath: '/test/file.js',
            strategy: 'function',
            type: 'function' as any,
            timestamp: Date.now(),
            size: 30,
            lineCount: 3
          }
        }
      ];

      const embeddings = [[0.1, 0.2, 0.3, 0.4]];
      const projectPath = '/test/project';
      const projectId = 'test-project-id';

      mockProjectIdManager.getProjectId.mockReturnValue(projectId);

      // Act
      const result = await vectorConversionService.convertChunksToVectors(
        chunks,
        embeddings,
        projectPath
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: expect.any(String),
        vector: embeddings[0],
        content: chunks[0].content,
        metadata: {
          projectId,
          filePath: chunks[0].metadata.filePath,
          language: chunks[0].metadata.language,
          startLine: chunks[0].metadata.startLine,
          endLine: chunks[0].metadata.endLine,
          chunkType: ['code']
        },
        timestamp: expect.any(Date)
      });
    });

    it('should throw error when chunks and embeddings length mismatch', async () => {
      // Arrange
      const chunks: CodeChunk[] = [
        {
          content: 'function test() { return true; }',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'javascript',
            filePath: '/test/file.js',
            strategy: 'function',
            type: 'function' as any,
            timestamp: Date.now(),
            size: 30,
            lineCount: 3
          }
        }
      ];

      const embeddings = [[0.1, 0.2, 0.3, 0.4], [0.5, 0.6, 0.7, 0.8]]; // Length mismatch

      // Act & Assert
      await expect(
        vectorConversionService.convertChunksToVectors(chunks, embeddings, '/test/project')
      ).rejects.toThrow('Chunks and embeddings length mismatch');
    });

    it('should handle empty project ID', async () => {
      // Arrange
      const chunks: CodeChunk[] = [
        {
          content: 'function test() { return true; }',
          metadata: {
            startLine: 1,
            endLine: 3,
            language: 'javascript',
            filePath: '/test/file.js',
            strategy: 'function',
            type: 'function' as any,
            timestamp: Date.now(),
            size: 30,
            lineCount: 3
          }
        }
      ];

      const embeddings = [[0.1, 0.2, 0.3, 0.4]];
      const projectPath = '/test/project';

      mockProjectIdManager.getProjectId.mockReturnValue(undefined);

      // Act
      const result = await vectorConversionService.convertChunksToVectors(
        chunks,
        embeddings,
        projectPath
      );

      // Assert
      expect(result[0].metadata.projectId).toBe('');
    });
  });

  describe('convertVectorToPoint', () => {
    it('should convert vector to point successfully', () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'function test() { return true; }',
        metadata: {
          projectId: 'test-project',
          filePath: '/test/file.js',
          language: 'javascript',
          startLine: 1,
          endLine: 3,
          chunkType: ['code'],
          functionName: 'test',
          className: 'TestClass',
          snippetMetadata: { test: 'data' },
          customFields: { custom: 'field' }
        },
        timestamp: new Date()
      };

      // Act
      const result = vectorConversionService.convertVectorToPoint(vector);

      // Assert
      expect(result).toEqual({
        id: vector.id,
        vector: vector.vector,
        payload: {
          content: vector.content,
          filePath: vector.metadata.filePath,
          language: vector.metadata.language,
          chunkType: vector.metadata.chunkType,
          startLine: vector.metadata.startLine,
          endLine: vector.metadata.endLine,
          functionName: vector.metadata.functionName,
          className: vector.metadata.className,
          snippetMetadata: vector.metadata.snippetMetadata,
          metadata: vector.metadata.customFields,
          timestamp: vector.timestamp,
          projectId: vector.metadata.projectId
        }
      });
    });

    it('should handle missing optional fields', () => {
      // Arrange
      const vector: Vector = {
        id: 'test-vector-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        content: 'function test() { return true; }',
        metadata: {
          projectId: 'test-project'
        },
        timestamp: new Date()
      };

      // Act
      const result = vectorConversionService.convertVectorToPoint(vector);

      // Assert
      expect(result.payload.filePath).toBe('');
      expect(result.payload.language).toBe('');
      expect(result.payload.chunkType).toBeUndefined();
      expect(result.payload.startLine).toBe(0);
      expect(result.payload.endLine).toBe(0);
      expect(result.payload.functionName).toBeUndefined();
      expect(result.payload.className).toBeUndefined();
      expect(result.payload.snippetMetadata).toBeUndefined();
      expect(result.payload.metadata).toEqual({});
    });
  });

  describe('convertPointToVector', () => {
    it('should convert point to vector successfully', () => {
      // Arrange
      const point: VectorPoint = {
        id: 'test-point-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        payload: {
          content: 'function test() { return true; }',
          filePath: '/test/file.js',
          language: 'javascript',
          chunkType: ['code'],
          startLine: 1,
          endLine: 3,
          functionName: 'test',
          className: 'TestClass',
          snippetMetadata: { test: 'data' },
          metadata: { custom: 'field' },
          timestamp: new Date(),
          projectId: 'test-project'
        }
      };

      // Act
      const result = vectorConversionService.convertPointToVector(point);

      // Assert
      expect(result).toEqual({
        id: point.id as string,
        vector: point.vector,
        content: point.payload.content,
        metadata: {
          projectId: point.payload.projectId,
          filePath: point.payload.filePath,
          language: point.payload.language,
          chunkType: point.payload.chunkType,
          startLine: point.payload.startLine,
          endLine: point.payload.endLine,
          functionName: point.payload.functionName,
          className: point.payload.className,
          snippetMetadata: point.payload.snippetMetadata,
          customFields: point.payload.metadata
        },
        timestamp: point.payload.timestamp
      });
    });

    it('should handle missing optional fields', () => {
      // Arrange
      const point: VectorPoint = {
        id: 'test-point-id',
        vector: [0.1, 0.2, 0.3, 0.4],
        payload: {
          content: 'function test() { return true; }',
          filePath: '/test/file.js',
          language: 'javascript',
          chunkType: ['code'],
          startLine: 1,
          endLine: 3,
          metadata: {},
          timestamp: new Date()
        }
      };

      // Act
      const result = vectorConversionService.convertPointToVector(point);

      // Assert
      expect(result.metadata.projectId).toBeUndefined();
      expect(result.metadata.functionName).toBeUndefined();
      expect(result.metadata.className).toBeUndefined();
      expect(result.metadata.snippetMetadata).toBeUndefined();
      expect(result.metadata.customFields).toBeUndefined();
    });
  });

  describe('generateVectorId', () => {
    it('should generate consistent vector IDs', () => {
      // Arrange
      const chunk: CodeChunk = {
        content: 'function test() { return true; }',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'javascript',
          filePath: '/test/file.js',
          strategy: 'function',
          type: 'function' as any,
          timestamp: Date.now(),
          size: 30,
          lineCount: 3
        }
      };

      const projectPath = '/test/project';
      const projectId = 'test-project-id';
      const index = 0;

      mockProjectIdManager.getProjectId.mockReturnValue(projectId);

      // Act
      const id1 = (vectorConversionService as any).generateVectorId(chunk, projectPath, index);
      const id2 = (vectorConversionService as any).generateVectorId(chunk, projectPath, index);

      // Assert
      expect(id1).toBe(id2);
      expect(id1).toContain(projectId);
      expect(id1).toContain(String(chunk.metadata.startLine));
      expect(id1).toContain(String(index));
    });
  });

  describe('hashFilePath', () => {
    it('should generate consistent hash for same file path', () => {
      // Arrange
      const filePath = '/test/file.js';

      // Act
      const hash1 = (vectorConversionService as any).hashFilePath(filePath);
      const hash2 = (vectorConversionService as any).hashFilePath(filePath);

      // Assert
      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe('string');
    });

    it('should generate different hashes for different file paths', () => {
      // Arrange
      const filePath1 = '/test/file1.js';
      const filePath2 = '/test/file2.js';

      // Act
      const hash1 = (vectorConversionService as any).hashFilePath(filePath1);
      const hash2 = (vectorConversionService as any).hashFilePath(filePath2);

      // Assert
      expect(hash1).not.toBe(hash2);
    });
  });
});