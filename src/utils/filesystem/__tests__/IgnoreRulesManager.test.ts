import { IgnoreRulesManager, TraversalOptions } from '../IgnoreRulesManager';
import { GitignoreParser } from '../../../service/ignore/GitignoreParser';
import { LoggerService } from '../../LoggerService';
import { DEFAULT_IGNORE_PATTERNS } from '../../../service/ignore/defaultIgnorePatterns';

// Mock dependencies
jest.mock('../../../service/ignore/GitignoreParser');

const mockGitignoreParser = GitignoreParser as jest.Mocked<typeof GitignoreParser>;

describe('IgnoreRulesManager', () => {
  let ignoreRulesManager: IgnoreRulesManager;
  let mockLogger: LoggerService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    } as any;
    
    ignoreRulesManager = new IgnoreRulesManager(mockLogger);
  });

  describe('refreshIgnoreRules', () => {
    it('should load default ignore patterns', async () => {
      const rootPath = '/test/path';
      
      await ignoreRulesManager.refreshIgnoreRules(rootPath);
      
      const patterns = ignoreRulesManager.getIgnorePatternsForPath(rootPath);
      expect(patterns).toEqual(expect.arrayContaining(DEFAULT_IGNORE_PATTERNS));
    });

    it('should add gitignore patterns when respectGitignore is true', async () => {
      const rootPath = '/test/path';
      const gitignorePatterns = ['*.log', 'temp/'];
      const options: TraversalOptions = { respectGitignore: true };
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue(gitignorePatterns);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await ignoreRulesManager.refreshIgnoreRules(rootPath, options);
      
      const patterns = ignoreRulesManager.getIgnorePatternsForPath(rootPath);
      expect(patterns).toEqual(expect.arrayContaining(gitignorePatterns));
      expect(mockGitignoreParser.getAllGitignorePatterns).toHaveBeenCalledWith(rootPath);
    });

    it('should add indexignore patterns', async () => {
      const rootPath = '/test/path';
      const indexignorePatterns = ['*.tmp', 'cache/'];
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue([]);
      mockGitignoreParser.parseIndexignore.mockResolvedValue(indexignorePatterns);
      
      await ignoreRulesManager.refreshIgnoreRules(rootPath);
      
      const patterns = ignoreRulesManager.getIgnorePatternsForPath(rootPath);
      expect(patterns).toEqual(expect.arrayContaining(indexignorePatterns));
      expect(mockGitignoreParser.parseIndexignore).toHaveBeenCalledWith(rootPath);
    });

    it('should add custom exclude patterns', async () => {
      const rootPath = '/test/path';
      const customPatterns = ['custom/', '*.custom'];
      const options: TraversalOptions = { excludePatterns: customPatterns };
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue([]);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await ignoreRulesManager.refreshIgnoreRules(rootPath, options);
      
      const patterns = ignoreRulesManager.getIgnorePatternsForPath(rootPath);
      expect(patterns).toEqual(expect.arrayContaining(customPatterns));
    });

    it('should remove duplicate patterns', async () => {
      const rootPath = '/test/path';
      const customPatterns = ['*.log']; // This might be in default patterns
      const gitignorePatterns = ['*.log']; // Duplicate
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue(gitignorePatterns);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await ignoreRulesManager.refreshIgnoreRules(rootPath, { 
        respectGitignore: true,
        excludePatterns: customPatterns 
      });
      
      const patterns = ignoreRulesManager.getIgnorePatternsForPath(rootPath);
      const logPatternCount = patterns.filter(p => p === '*.log').length;
      expect(logPatternCount).toBe(1); // Should only appear once
    });

    it('should log debug information when logger is provided', async () => {
      const rootPath = '/test/path';
      const gitignorePatterns = ['*.log'];
      const indexignorePatterns = ['*.tmp'];
      const customPatterns = ['custom/'];
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue(gitignorePatterns);
      mockGitignoreParser.parseIndexignore.mockResolvedValue(indexignorePatterns);
      
      await ignoreRulesManager.refreshIgnoreRules(rootPath, {
        respectGitignore: true,
        excludePatterns: customPatterns
      });
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `[DEBUG] Refreshed ignore patterns for ${rootPath}`,
        expect.objectContaining({
          defaultPatterns: expect.any(Number),
          gitignorePatterns: gitignorePatterns.length,
          indexignorePatterns: indexignorePatterns.length,
          customPatterns: customPatterns.length,
          totalPatterns: expect.any(Number)
        })
      );
    });

    it('should work without logger', async () => {
      const managerWithoutLogger = new IgnoreRulesManager();
      const rootPath = '/test/path';
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue([]);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await expect(managerWithoutLogger.refreshIgnoreRules(rootPath)).resolves.not.toThrow();
    });
  });

  describe('getIgnorePatternsForPath', () => {
    it('should return cached patterns for known path', async () => {
      const rootPath = '/test/path';
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue([]);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await ignoreRulesManager.refreshIgnoreRules(rootPath);
      
      const patterns = ignoreRulesManager.getIgnorePatternsForPath(rootPath);
      expect(patterns).toEqual(expect.arrayContaining(DEFAULT_IGNORE_PATTERNS));
    });

    it('should return empty array for unknown path', () => {
      const unknownPath = '/unknown/path';
      
      const patterns = ignoreRulesManager.getIgnorePatternsForPath(unknownPath);
      expect(patterns).toEqual([]);
    });
  });

  describe('cache management', () => {
    it('should clear cache for specific path', async () => {
      const rootPath = '/test/path';
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue([]);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await ignoreRulesManager.refreshIgnoreRules(rootPath);
      expect(ignoreRulesManager.getIgnorePatternsForPath(rootPath)).not.toEqual([]);
      
      ignoreRulesManager.clearCacheForPath(rootPath);
      expect(ignoreRulesManager.getIgnorePatternsForPath(rootPath)).toEqual([]);
    });

    it('should clear all cache', async () => {
      const path1 = '/test/path1';
      const path2 = '/test/path2';
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue([]);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await ignoreRulesManager.refreshIgnoreRules(path1);
      await ignoreRulesManager.refreshIgnoreRules(path2);
      
      expect(ignoreRulesManager.getIgnorePatternsForPath(path1)).not.toEqual([]);
      expect(ignoreRulesManager.getIgnorePatternsForPath(path2)).not.toEqual([]);
      
      ignoreRulesManager.clearAllCache();
      expect(ignoreRulesManager.getIgnorePatternsForPath(path1)).toEqual([]);
      expect(ignoreRulesManager.getIgnorePatternsForPath(path2)).toEqual([]);
    });

    it('should return cached paths', async () => {
      const path1 = '/test/path1';
      const path2 = '/test/path2';
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue([]);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await ignoreRulesManager.refreshIgnoreRules(path1);
      await ignoreRulesManager.refreshIgnoreRules(path2);
      
      const cachedPaths = ignoreRulesManager.getCachedPaths();
      expect(cachedPaths).toEqual(expect.arrayContaining([path1, path2]));
      expect(cachedPaths).toHaveLength(2);
    });

    it('should check if path is cached', async () => {
      const path1 = '/test/path1';
      const path2 = '/test/path2';
      
      mockGitignoreParser.getAllGitignorePatterns.mockResolvedValue([]);
      mockGitignoreParser.parseIndexignore.mockResolvedValue([]);
      
      await ignoreRulesManager.refreshIgnoreRules(path1);
      
      expect(ignoreRulesManager.isPathCached(path1)).toBe(true);
      expect(ignoreRulesManager.isPathCached(path2)).toBe(false);
    });
  });
});