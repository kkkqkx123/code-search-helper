import * as fs from 'fs/promises';
import * as path from 'path';

export class GitignoreParser {
  /**
   * Parses a .gitignore file and returns an array of ignore patterns
   * @param gitignorePath Path to the .gitignore file
   * @returns Array of ignore patterns
   */
  static async parseGitignore(gitignorePath: string): Promise<string[]> {
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      // If the file doesn't exist, return empty array
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Parses the content of a .gitignore file and returns an array of ignore patterns
   * @param content Content of the .gitignore file
   * @returns Array of ignore patterns
   */
  static parseContent(content: string): string[] {
    // Handle case where content might be undefined or null
    if (!content) {
      return [];
    }
    
    const patterns: string[] = [];
    
    const lines = content.split('\n');
    
    for (const line of lines) {
      // Skip empty lines and comments
      const trimmedLine = line.trim();
      if (trimmedLine === '' || trimmedLine.startsWith('#')) {
        continue;
      }
      
      // Convert gitignore pattern to glob pattern
      const pattern = this.convertGitignorePattern(trimmedLine);
      // Only add non-empty patterns (to skip negation patterns)
      if (pattern !== '') {
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }

  /**
   * Converts a gitignore pattern to a glob pattern that can be used with our matching logic
   * @param pattern Gitignore pattern
   * @returns Converted glob pattern
   */
  private static convertGitignorePattern(pattern: string): string {
    // Handle negation patterns (we'll skip these for now as our system doesn't support them)
    if (pattern.startsWith('!')) {
      // For now, we'll skip negation patterns
      return '';
    }
    
    // Normalize path separators
    pattern = pattern.replace(/\\/g, '/');
    
    // Handle patterns that start with /
    if (pattern.startsWith('/')) {
      // Absolute pattern from root - remove leading /
      pattern = pattern.substring(1);
      // If it's a simple pattern (no more slashes) and not ending with /, it's a root file pattern
      if (!pattern.includes('/') && !pattern.endsWith('/')) {
        return pattern;
      }
      // If it's a directory pattern ending with /, convert to glob pattern
      if (pattern.endsWith('/')) {
        return pattern.slice(0, -1) + '/**';
      }
      // For other absolute patterns with path, add **/ prefix
      return '**/' + pattern;
    } else if (!pattern.includes('/')) {
      // Simple file name pattern - match files with this name anywhere
      // For simple patterns like *.js, we want to match both:
      // 1. Files directly: file.js
      // 2. Files in directories: path/to/file.js
      // We'll create a pattern that can match both by using a more flexible approach
      return '**/' + pattern;
    } else if (!pattern.endsWith('/')) {
      // Pattern with path but not ending with / - match both file and directory
      pattern = '**/' + pattern;
    } else if (pattern.endsWith('/')) {
      // Directory pattern - match in any directory
      pattern = '**/' + pattern.slice(0, -1) + '/**';
    }
    
    // Handle directory patterns (ending with /) that were absolute
    if (pattern.endsWith('/')) {
      pattern = pattern.slice(0, -1) + '/**';
    }
    
    return pattern;
  }

  /**
   * Gets all gitignore patterns for a project by traversing directories from root to the file
   * @param projectRoot Root of the project
   * @param filePath Path to the file relative to project root
   * @returns Array of all applicable gitignore patterns
   */
  static async getGitignorePatternsForFile(projectRoot: string, filePath: string): Promise<string[]> {
    const patterns: string[] = [];

    // Normalize the file path to ensure consistent path separators
    const normalizedFilePath = path.normalize(filePath);
    const fileDir = path.dirname(normalizedFilePath);

    // Split the directory path into individual directories
    const dirs = fileDir.split(path.sep).filter(dir => dir !== '');

    // Start with root .gitignore
    const rootGitignorePath = path.join(projectRoot, '.gitignore');
    const rootPatterns = await this.parseGitignore(rootGitignorePath);
    patterns.push(...rootPatterns);

    // Traverse each directory and collect .gitignore patterns
    let currentPath = projectRoot;
    for (const dir of dirs) {
      if (dir === '' || dir === '.') continue;

      currentPath = path.join(currentPath, dir);
      const gitignorePath = path.join(currentPath, '.gitignore');
      const dirPatterns = await this.parseGitignore(gitignorePath);
      patterns.push(...dirPatterns);
    }

    // Filter out empty patterns and return
    const filteredPatterns = patterns.filter(pattern => pattern !== '');
    return filteredPatterns;
  }

  /**
   * Gets all applicable .gitignore rules from root directory and first-level subdirectories
   * @param projectRoot Project root directory
   * @returns Array of all applicable ignore rules
   */
  static async getAllGitignorePatterns(projectRoot: string): Promise<string[]> {
    const patterns: string[] = [];

    // 1. Read root directory .gitignore
    const rootGitignorePath = path.join(projectRoot, '.gitignore');
    const rootPatterns = await this.parseGitignore(rootGitignorePath);
    patterns.push(...rootPatterns);

    // 2. Read .gitignore files in first-level subdirectories
    try {
      const entries = await fs.readdir(projectRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDirPath = path.join(projectRoot, entry.name);
          const subGitignorePath = path.join(subDirPath, '.gitignore');
          const subPatterns = await this.parseGitignore(subGitignorePath);

          // Add prefix to subdirectory rules to ensure they only apply in corresponding directory
          // Only add non-empty patterns
          const prefixedPatterns = subPatterns
            .filter(pattern => pattern !== '')
            .map(pattern => path.join(entry.name, pattern).replace(/\\/g, '/'));
          patterns.push(...prefixedPatterns);
        }
      }
    } catch (error) {
      // Ignore read errors, continue execution
      console.warn(`Failed to read subdirectories: ${error}`);
    }

    return patterns.filter(pattern => pattern !== '');
  }

  /**
   * Parses .indexignore file
   * @param projectRoot Project root directory
   * @returns Array of rules from .indexignore
   */
  static async parseIndexignore(projectRoot: string): Promise<string[]> {
    const indexignorePath = path.join(projectRoot, '.indexignore');
    try {
      const content = await fs.readFile(indexignorePath, 'utf-8');
      return this.parseContent(content);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
}