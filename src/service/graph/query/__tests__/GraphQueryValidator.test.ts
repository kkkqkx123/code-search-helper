import { GraphQueryValidator, ValidationResult } from '../GraphQueryValidator';

describe('GraphQueryValidator', () => {
 let validator: GraphQueryValidator;

  beforeEach(() => {
    validator = new GraphQueryValidator();
  });

  describe('validateQuery', () => {
    it('should return valid for a safe query', () => {
      const query = 'MATCH (n) RETURN n LIMIT 10;';
      const result: ValidationResult = validator.validateQuery(query);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for queries exceeding max length', () => {
      const longQuery = 'a'.repeat(10001); // Exceeds the 1000 character limit
      const result: ValidationResult = validator.validateQuery(longQuery);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Query too long');
    });

    it('should return invalid for queries containing dangerous keywords', () => {
      const dangerousQueries = [
        'DROP SPACE test_space;',
        'DELETE FROM test_table;',
        'TRUNCATE TABLE test_table;',
        'ALTER TABLE test_table ADD COLUMN new_col;',
        'CREATE USER new_user IDENTIFIED BY password123;',
        'GRANT ALL PRIVILEGES ON *.* TO user@localhost;',
        'REVOKE ALL PRIVILEGES ON *.* FROM user@localhost;'
      ];

      for (const query of dangerousQueries) {
        const result: ValidationResult = validator.validateQuery(query);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Dangerous keyword detected');
      }
    });

    it('should return invalid for queries with unmatched parentheses', () => {
      const queriesWithUnmatchedParentheses = [
        'MATCH (n WHERE n.name = "test"',
        'MATCH (n) WHERE (n.name = "test"',
        'MATCH (n) WHERE n.name = "test")',
        'MATCH ((n) WHERE n.name = "test"'  // Fixed: removed extra closing paren
      ];

      for (const query of queriesWithUnmatchedParentheses) {
        const result: ValidationResult = validator.validateQuery(query);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Unmatched parentheses');
      }
    });

    it('should return valid for queries with matched parentheses', () => {
      const queriesWithMatchedParentheses = [
        'MATCH (n) WHERE n.name = "test"',
        'MATCH (n) WHERE (n.name = "test")',
        'MATCH (n) WHERE ((n.name = "test") AND (n.age > 18))'
      ];

      for (const query of queriesWithMatchedParentheses) {
        const result: ValidationResult = validator.validateQuery(query);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });
  });

  describe('validateProjectId', () => {
    it('should return valid for a valid project ID', () => {
      const validProjectIds = [
        'my-project',
        'my_project',
        'project123',
        'Project_123-Test',
        'a', // minimum length
        'a'.repeat(50) // maximum length
      ];

      for (const projectId of validProjectIds) {
        const result: ValidationResult = validator.validateProjectId(projectId);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('should return invalid for project IDs with invalid characters', () => {
      const invalidProjectIds = [
        'project.id', // dot
        'project id', // space
        'project@id', // @ symbol
        'project$id', // $ symbol
        'project&id'  // & symbol
      ];

      for (const projectId of invalidProjectIds) {
        const result: ValidationResult = validator.validateProjectId(projectId);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Invalid project ID format');
      }
    });

    it('should return invalid for project IDs that are too short', () => {
      const shortProjectIds = [''];

      for (const projectId of shortProjectIds) {
        const result: ValidationResult = validator.validateProjectId(projectId);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Project ID must be between 1 and 50 characters long');
      }
    });

    it('should return invalid for project IDs that are too long', () => {
      const longProjectId = 'a'.repeat(51); // exceeds 50 characters
      const result: ValidationResult = validator.validateProjectId(longProjectId);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Project ID must be between 1 and 50 characters long');
    });
  });

  describe('validateNodeId', () => {
    it('should return valid for a valid node ID', () => {
      const validNodeIds = [
        'node123',
        'a', // minimum length
        'a'.repeat(1000) // maximum length
      ];

      for (const nodeId of validNodeIds) {
        const result: ValidationResult = validator.validateNodeId(nodeId);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('should return invalid for empty node ID', () => {
      const result: ValidationResult = validator.validateNodeId('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Node ID cannot be empty');
    });

    it('should return invalid for node ID that is too long', () => {
      const longNodeId = 'a'.repeat(1001); // exceeds 1000 characters
      const result: ValidationResult = validator.validateNodeId(longNodeId);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Node ID is too long');
    });
  });
});