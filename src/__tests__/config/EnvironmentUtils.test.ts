import { EnvironmentUtils } from '../../config/utils/EnvironmentUtils';

describe('EnvironmentUtils', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('parseString', () => {
    it('should return the environment value when it exists', () => {
      process.env.TEST_STRING = 'test-value';
      expect(EnvironmentUtils.parseString('TEST_STRING', 'default')).toBe('test-value');
    });

    it('should return the default value when environment variable does not exist', () => {
      delete process.env.TEST_STRING;
      expect(EnvironmentUtils.parseString('TEST_STRING', 'default')).toBe('default');
    });
  });

  describe('parseNumber', () => {
    it('should return the parsed number when environment variable exists and is valid', () => {
      process.env.TEST_NUMBER = '42';
      expect(EnvironmentUtils.parseNumber('TEST_NUMBER', 0)).toBe(42);
    });

    it('should return the default value when environment variable does not exist', () => {
      delete process.env.TEST_NUMBER;
      expect(EnvironmentUtils.parseNumber('TEST_NUMBER', 42)).toBe(42);
    });

    it('should return the default value when environment variable is not a valid number', () => {
      process.env.TEST_NUMBER = 'invalid';
      expect(EnvironmentUtils.parseNumber('TEST_NUMBER', 42)).toBe(42);
    });
  });

  describe('parseFloat', () => {
    it('should return the parsed float when environment variable exists and is valid', () => {
      process.env.TEST_FLOAT = '3.14';
      expect(EnvironmentUtils.parseFloat('TEST_FLOAT', 0)).toBe(3.14);
    });

    it('should return the default value when environment variable does not exist', () => {
      delete process.env.TEST_FLOAT;
      expect(EnvironmentUtils.parseFloat('TEST_FLOAT', 3.14)).toBe(3.14);
    });

    it('should return the default value when environment variable is not a valid float', () => {
      process.env.TEST_FLOAT = 'invalid';
      expect(EnvironmentUtils.parseFloat('TEST_FLOAT', 3.14)).toBe(3.14);
    });
  });

  describe('parseBoolean', () => {
    it('should return true when environment variable is "true"', () => {
      process.env.TEST_BOOLEAN = 'true';
      expect(EnvironmentUtils.parseBoolean('TEST_BOOLEAN', false)).toBe(true);
    });

    it('should return false when environment variable is "false"', () => {
      process.env.TEST_BOOLEAN = 'false';
      expect(EnvironmentUtils.parseBoolean('TEST_BOOLEAN', true)).toBe(false);
    });

    it('should return the default value when environment variable does not exist', () => {
      delete process.env.TEST_BOOLEAN;
      expect(EnvironmentUtils.parseBoolean('TEST_BOOLEAN', true)).toBe(true);
    });

    it('should return the default value when environment variable is not "true" or "false"', () => {
      process.env.TEST_BOOLEAN = 'invalid';
      expect(EnvironmentUtils.parseBoolean('TEST_BOOLEAN', true)).toBe(true);
    });
  });

  describe('parseOptionalString', () => {
    it('should return the environment value when it exists', () => {
      process.env.TEST_OPTIONAL_STRING = 'test-value';
      expect(EnvironmentUtils.parseOptionalString('TEST_OPTIONAL_STRING')).toBe('test-value');
    });

    it('should return undefined when environment variable does not exist', () => {
      delete process.env.TEST_OPTIONAL_STRING;
      expect(EnvironmentUtils.parseOptionalString('TEST_OPTIONAL_STRING')).toBeUndefined();
    });
  });

  describe('parseOptionalNumber', () => {
    it('should return the parsed number when environment variable exists and is valid', () => {
      process.env.TEST_OPTIONAL_NUMBER = '42';
      expect(EnvironmentUtils.parseOptionalNumber('TEST_OPTIONAL_NUMBER')).toBe(42);
    });

    it('should return undefined when environment variable does not exist', () => {
      delete process.env.TEST_OPTIONAL_NUMBER;
      expect(EnvironmentUtils.parseOptionalNumber('TEST_OPTIONAL_NUMBER')).toBeUndefined();
    });

    it('should return undefined when environment variable is not a valid number', () => {
      process.env.TEST_OPTIONAL_NUMBER = 'invalid';
      expect(EnvironmentUtils.parseOptionalNumber('TEST_OPTIONAL_NUMBER')).toBeUndefined();
    });
  });

  describe('parseOptionalBoolean', () => {
    it('should return true when environment variable is "true"', () => {
      process.env.TEST_OPTIONAL_BOOLEAN = 'true';
      expect(EnvironmentUtils.parseOptionalBoolean('TEST_OPTIONAL_BOOLEAN')).toBe(true);
    });

    it('should return false when environment variable is "false"', () => {
      process.env.TEST_OPTIONAL_BOOLEAN = 'false';
      expect(EnvironmentUtils.parseOptionalBoolean('TEST_OPTIONAL_BOOLEAN')).toBe(false);
    });

    it('should return undefined when environment variable does not exist', () => {
      delete process.env.TEST_OPTIONAL_BOOLEAN;
      expect(EnvironmentUtils.parseOptionalBoolean('TEST_OPTIONAL_BOOLEAN')).toBeUndefined();
    });

    it('should return undefined when environment variable is not "true" or "false"', () => {
      process.env.TEST_OPTIONAL_BOOLEAN = 'invalid';
      expect(EnvironmentUtils.parseOptionalBoolean('TEST_OPTIONAL_BOOLEAN')).toBeUndefined();
    });
  });

  describe('validateEnum', () => {
    it('should return the environment value when it exists and is valid', () => {
      process.env.TEST_ENUM = 'valid-value';
      expect(EnvironmentUtils.validateEnum('TEST_ENUM', ['valid-value', 'another-value'], 'default')).toBe('valid-value');
    });

    it('should return the default value when environment variable does not exist', () => {
      delete process.env.TEST_ENUM;
      expect(EnvironmentUtils.validateEnum('TEST_ENUM', ['valid-value', 'another-value'], 'default')).toBe('default');
    });

    it('should return the default value when environment variable is not in the allowed values', () => {
      process.env.TEST_ENUM = 'invalid-value';
      expect(EnvironmentUtils.validateEnum('TEST_ENUM', ['valid-value', 'another-value'], 'default')).toBe('default');
    });
  });

  describe('parsePort', () => {
    it('should return the parsed port when environment variable exists and is valid', () => {
      process.env.TEST_PORT = '8080';
      expect(EnvironmentUtils.parsePort('TEST_PORT', 3000)).toBe(8080);
    });

    it('should return the default value when environment variable does not exist', () => {
      delete process.env.TEST_PORT;
      expect(EnvironmentUtils.parsePort('TEST_PORT', 3000)).toBe(3000);
    });

    it('should return the default value when environment variable is not a valid port', () => {
      process.env.TEST_PORT = 'invalid';
      expect(EnvironmentUtils.parsePort('TEST_PORT', 3000)).toBe(3000);
    });

    it('should return the default value when port is out of range', () => {
      process.env.TEST_PORT = '99999';
      expect(EnvironmentUtils.parsePort('TEST_PORT', 3000)).toBe(3000);
    });
  });
});