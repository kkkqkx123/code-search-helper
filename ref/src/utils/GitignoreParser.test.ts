import { GitignoreParser } from './GitignoreParser';
import fs from 'fs/promises';

// Mock fs
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('GitignoreParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseGitignore', () => {
    it('should parse a gitignore file and return patterns', async () => {
      const gitignoreContent = `
# Comment
*.log
node_modules/
dist
.DS_Store
`;
      mockFs.readFile.mockResolvedValue(gitignoreContent);

      const patterns = await GitignoreParser.parseGitignore('/test/.gitignore');

      expect(patterns).toEqual([
        '**/*.log',
        '**/node_modules/**',
        '**/dist',
        '**/.DS_Store'
      ]);
    });

    it('should handle empty gitignore file', async () => {
      mockFs.readFile.mockResolvedValue('');

      const patterns = await GitignoreParser.parseGitignore('/test/.gitignore');

      expect(patterns).toEqual([]);
    });

    it('should handle non-existent gitignore file', async () => {
      mockFs.readFile.mockRejectedValue({ code: 'ENOENT' });

      const patterns = await GitignoreParser.parseGitignore('/test/.gitignore');

      expect(patterns).toEqual([]);
    });

    it('should handle other read errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      await expect(GitignoreParser.parseGitignore('/test/.gitignore')).rejects.toThrow(
        'Permission denied'
      );
    });

    it('should skip comment lines and empty lines', async () => {
      const gitignoreContent = `
# This is a comment

*.log

# Another comment
node_modules/
`;
      mockFs.readFile.mockResolvedValue(gitignoreContent);

      const patterns = await GitignoreParser.parseGitignore('/test/.gitignore');

      expect(patterns).toEqual([
        '**/*.log',
        '**/node_modules/**'
      ]);
    });

    it('should handle negation patterns by skipping them', async () => {
      const gitignoreContent = `
*.log
!important.log
node_modules/
`;
      mockFs.readFile.mockResolvedValue(gitignoreContent);

      const patterns = await GitignoreParser.parseGitignore('/test/.gitignore');

      expect(patterns).toEqual([
        '**/*.log',
        '**/node_modules/**'
      ]);
    });

    it('should handle absolute patterns (starting with /)', async () => {
      const gitignoreContent = `
/*.log
/dist/
`;
      mockFs.readFile.mockResolvedValue(gitignoreContent);

      const patterns = await GitignoreParser.parseGitignore('/test/.gitignore');

      expect(patterns).toEqual([
        '*.log',
        'dist/**'
      ]);
    });
  });

  describe('parseContent', () => {
    it('should parse content directly', () => {
      const content = `
# Comment
*.log
node_modules/
dist
`;

      const patterns = GitignoreParser.parseContent(content);

      expect(patterns).toEqual([
        '**/*.log',
        '**/node_modules/**',
        '**/dist'
      ]);
    });

    it('should handle empty content', () => {
      const patterns = GitignoreParser.parseContent('');

      expect(patterns).toEqual([]);
    });

    it('should handle content with only comments and empty lines', () => {
      const content = `
# Comment 1

# Comment 2

`;

      const patterns = GitignoreParser.parseContent(content);

      expect(patterns).toEqual([]);
    });
  });

  describe('convertGitignorePattern', () => {
    it('should convert simple patterns', () => {
      // This test would need to access the private method, which is not ideal
      // In a real implementation, we would test this through the public API
    });
  });
});