/**
 * ChunkTypeMapper 单元测试
 * 测试类型映射和验证功能
 */

import { ChunkTypeMapper } from '../ChunkTypeMapper';
import { StructureType } from '../../../service/parser/processing/types/HierarchicalTypes';
import { ChunkType } from '../../../service/parser/processing/types/CodeChunk';

describe('ChunkTypeMapper', () => {
  describe('mapStructureToChunk', () => {
    it('should map StructureType.FUNCTION to ChunkType.FUNCTION', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.FUNCTION)).toBe(ChunkType.FUNCTION);
    });

    it('should map StructureType.CLASS to ChunkType.CLASS', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.CLASS)).toBe(ChunkType.CLASS);
    });

    it('should map StructureType.STRUCT to ChunkType.CLASS', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.STRUCT)).toBe(ChunkType.CLASS);
    });

    it('should map StructureType.TYPE_DEFINITION to ChunkType.TYPE_DEF', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.TYPE_DEFINITION)).toBe(ChunkType.TYPE_DEF);
    });

    it('should map StructureType.DOCUMENT to ChunkType.DOCUMENTATION', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.DOCUMENT)).toBe(ChunkType.DOCUMENTATION);
    });

    it('should map StructureType.TRAIT to ChunkType.INTERFACE', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.TRAIT)).toBe(ChunkType.INTERFACE);
    });

    it('should map StructureType.IMPLEMENTATION to ChunkType.CLASS', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.IMPLEMENTATION)).toBe(ChunkType.CLASS);
    });

    it('should map control flow types correctly', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.IF)).toBe(ChunkType.CONTROL_FLOW);
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.FOR)).toBe(ChunkType.CONTROL_FLOW);
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.WHILE)).toBe(ChunkType.CONTROL_FLOW);
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.SWITCH)).toBe(ChunkType.CONTROL_FLOW);
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.CASE)).toBe(ChunkType.CONTROL_FLOW);
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.TRY)).toBe(ChunkType.CONTROL_FLOW);
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.CATCH)).toBe(ChunkType.CONTROL_FLOW);
    });

    it('should map unknown structure to ChunkType.GENERIC', () => {
      expect(ChunkTypeMapper.mapStructureToChunk(StructureType.UNKNOWN)).toBe(ChunkType.GENERIC);
    });
  });

  describe('mapChunkToStructure', () => {
    it('should map ChunkType.FUNCTION to StructureType.FUNCTION', () => {
      expect(ChunkTypeMapper.mapChunkToStructure(ChunkType.FUNCTION)).toBe(StructureType.FUNCTION);
    });

    it('should map ChunkType.CLASS to StructureType.CLASS', () => {
      expect(ChunkTypeMapper.mapChunkToStructure(ChunkType.CLASS)).toBe(StructureType.CLASS);
    });

    it('should map ChunkType.GENERIC to StructureType.UNKNOWN', () => {
      expect(ChunkTypeMapper.mapChunkToStructure(ChunkType.GENERIC)).toBe(StructureType.UNKNOWN);
    });
  });

  describe('isValidChunkType', () => {
    it('should return true for valid ChunkType values', () => {
      expect(ChunkTypeMapper.isValidChunkType('function')).toBe(true);
      expect(ChunkTypeMapper.isValidChunkType('class')).toBe(true);
      expect(ChunkTypeMapper.isValidChunkType('method')).toBe(true);
      expect(ChunkTypeMapper.isValidChunkType('generic')).toBe(true);
    });

    it('should return false for invalid ChunkType values', () => {
      expect(ChunkTypeMapper.isValidChunkType('invalid-type')).toBe(false);
      expect(ChunkTypeMapper.isValidChunkType('')).toBe(false);
      expect(ChunkTypeMapper.isValidChunkType('123')).toBe(false);
    });
  });

  describe('isValidStructureType', () => {
    it('should return true for valid StructureType values', () => {
      expect(ChunkTypeMapper.isValidStructureType('function')).toBe(true);
      expect(ChunkTypeMapper.isValidStructureType('class')).toBe(true);
      expect(ChunkTypeMapper.isValidStructureType('method')).toBe(true);
      expect(ChunkTypeMapper.isValidStructureType('unknown')).toBe(true);
    });

    it('should return false for invalid StructureType values', () => {
      expect(ChunkTypeMapper.isValidStructureType('invalid-type')).toBe(false);
      expect(ChunkTypeMapper.isValidStructureType('')).toBe(false);
      expect(ChunkTypeMapper.isValidStructureType('123')).toBe(false);
    });
  });

  describe('getAllSupportedChunkTypes', () => {
    it('should return all ChunkType values', () => {
      const chunkTypes = ChunkTypeMapper.getAllSupportedChunkTypes();
      expect(chunkTypes).toContain(ChunkType.FUNCTION);
      expect(chunkTypes).toContain(ChunkType.CLASS);
      expect(chunkTypes).toContain(ChunkType.METHOD);
      expect(chunkTypes).toContain(ChunkType.GENERIC);
      expect(chunkTypes.length).toBeGreaterThan(0);
    });
  });

  describe('getAllSupportedStructureTypes', () => {
    it('should return all StructureType values', () => {
      const structureTypes = ChunkTypeMapper.getAllSupportedStructureTypes();
      expect(structureTypes).toContain(StructureType.FUNCTION);
      expect(structureTypes).toContain(StructureType.CLASS);
      expect(structureTypes).toContain(StructureType.METHOD);
      expect(structureTypes).toContain(StructureType.UNKNOWN);
      expect(structureTypes.length).toBeGreaterThan(0);
    });
  });

  describe('areTypesCompatible', () => {
    it('should return true for compatible types', () => {
      expect(ChunkTypeMapper.areTypesCompatible(StructureType.FUNCTION, ChunkType.FUNCTION)).toBe(true);
      expect(ChunkTypeMapper.areTypesCompatible(StructureType.CLASS, ChunkType.CLASS)).toBe(true);
      expect(ChunkTypeMapper.areTypesCompatible(StructureType.STRUCT, ChunkType.CLASS)).toBe(true);
    });

    it('should return false for incompatible types', () => {
      expect(ChunkTypeMapper.areTypesCompatible(StructureType.FUNCTION, ChunkType.CLASS)).toBe(false);
      expect(ChunkTypeMapper.areTypesCompatible(StructureType.CLASS, ChunkType.FUNCTION)).toBe(false);
    });
  });

  describe('shouldPreserveNestedStructure', () => {
    it('should return true for types that should be preserved', () => {
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.METHOD)).toBe(true);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.CONTROL_FLOW)).toBe(true);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.CONFIG_ITEM)).toBe(true);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.SECTION)).toBe(true);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.ARRAY)).toBe(true);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.TABLE)).toBe(true);
    });

    it('should return false for types that should not be preserved', () => {
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.FUNCTION)).toBe(false);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.CLASS)).toBe(false);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.EXPRESSION)).toBe(false);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.KEY)).toBe(false);
      expect(ChunkTypeMapper.shouldPreserveNestedStructure(ChunkType.VALUE)).toBe(false);
    });
  });

  describe('getComplexityThresholds', () => {
    it('should return correct thresholds for known types', () => {
      const functionThresholds = ChunkTypeMapper.getComplexityThresholds(ChunkType.FUNCTION);
      expect(functionThresholds.min).toBe(5);
      expect(functionThresholds.max).toBe(300);

      const classThresholds = ChunkTypeMapper.getComplexityThresholds(ChunkType.CLASS);
      expect(classThresholds.min).toBe(10);
      expect(classThresholds.max).toBe(400);
    });

    it('should return default thresholds for unknown types', () => {
      // 创建一个假的 ChunkType 来测试默认值
      const fakeType = 'fake-type' as ChunkType;
      const thresholds = ChunkTypeMapper.getComplexityThresholds(fakeType);
      expect(thresholds.min).toBe(2);
      expect(thresholds.max).toBe(500);
    });
  });

  describe('getAllComplexityThresholds', () => {
    it('should return all complexity thresholds', () => {
      const thresholds = ChunkTypeMapper.getAllComplexityThresholds();
      expect(thresholds.typeSpecific).toBeDefined();
      expect(thresholds.default).toBeDefined();
      expect(thresholds.default.minComplexity).toBe(2);
      expect(thresholds.default.maxComplexity).toBe(500);
      expect(thresholds.typeSpecific[ChunkType.FUNCTION]).toBeDefined();
    });
  });

  describe('batchMapStructureToChunk', () => {
    it('should batch map structure types to chunk types', () => {
      const structureTypes = [StructureType.FUNCTION, StructureType.CLASS, StructureType.METHOD];
      const chunkTypes = ChunkTypeMapper.batchMapStructureToChunk(structureTypes);

      expect(chunkTypes).toEqual([ChunkType.FUNCTION, ChunkType.CLASS, ChunkType.METHOD]);
    });

    it('should handle empty array', () => {
      const chunkTypes = ChunkTypeMapper.batchMapStructureToChunk([]);
      expect(chunkTypes).toEqual([]);
    });
  });

  describe('batchMapChunkToStructure', () => {
    it('should batch map chunk types to structure types', () => {
      const chunkTypes = [ChunkType.FUNCTION, ChunkType.CLASS, ChunkType.METHOD];
      const structureTypes = ChunkTypeMapper.batchMapChunkToStructure(chunkTypes);

      expect(structureTypes).toEqual([StructureType.FUNCTION, StructureType.CLASS, StructureType.METHOD]);
    });

    it('should handle empty array', () => {
      const structureTypes = ChunkTypeMapper.batchMapChunkToStructure([]);
      expect(structureTypes).toEqual([]);
    });
  });

  describe('filterValidChunkTypes', () => {
    it('should filter valid chunk types', () => {
      const mixedTypes = ['function', 'invalid-type', 'class', 'another-invalid'];
      const validTypes = ChunkTypeMapper.filterValidChunkTypes(mixedTypes);

      expect(validTypes).toEqual(['function', 'class']);
    });

    it('should handle empty array', () => {
      const validTypes = ChunkTypeMapper.filterValidChunkTypes([]);
      expect(validTypes).toEqual([]);
    });
  });

  describe('filterValidStructureTypes', () => {
    it('should filter valid structure types', () => {
      const mixedTypes = ['function', 'invalid-type', 'class', 'another-invalid'];
      const validTypes = ChunkTypeMapper.filterValidStructureTypes(mixedTypes);

      expect(validTypes).toEqual(['function', 'class']);
    });

    it('should handle empty array', () => {
      const validTypes = ChunkTypeMapper.filterValidStructureTypes([]);
      expect(validTypes).toEqual([]);
    });
  });

  describe('getMappingStatistics', () => {
    it('should return mapping statistics', () => {
      const stats = ChunkTypeMapper.getMappingStatistics();

      expect(stats.totalStructureTypes).toBeGreaterThan(0);
      expect(stats.totalChunkTypes).toBeGreaterThan(0);
      expect(stats.mappedStructureTypes).toBeGreaterThan(0);
      expect(stats.mappedChunkTypes).toBeGreaterThan(0);
      expect(stats.preserveStrategiesCount).toBeGreaterThan(0);
      expect(stats.complexityThresholdsCount).toBeGreaterThan(0);
    });
  });
});