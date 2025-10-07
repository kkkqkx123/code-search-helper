import { ConfigValidationDecorator } from '../../config/utils/ConfigValidationDecorator';

describe('ConfigValidationDecorator', () => {
  describe('validate', () => {
    it('should validate a config object successfully', () => {
      const config = {
        name: 'test',
        age: 25,
      };

      const schemaMap = {
        name: ConfigValidationDecorator.requiredString(),
        age: ConfigValidationDecorator.requiredNumber(),
      };

      const result = ConfigValidationDecorator.validate(config, schemaMap);
      expect(result).toEqual(config);
    });

    it('should throw an error for invalid config', () => {
      const config = {
        name: 'test',
        age: -1, // Invalid: negative number
      };

      const schemaMap = {
        name: ConfigValidationDecorator.requiredString(),
        age: ConfigValidationDecorator.positiveNumber(),
      };

      expect(() => ConfigValidationDecorator.validate(config, schemaMap)).toThrow();
    });
  });

  describe('requiredString', () => {
    it('should create a required string schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.requiredString('default');
      const { value } = schema.validate('test');
      expect(value).toBe('test');
    });

    it('should create a required string schema without default value', () => {
      const schema = ConfigValidationDecorator.requiredString();
      const { value } = schema.validate('test');
      expect(value).toBe('test');
    });
  });

  describe('optionalString', () => {
    it('should create an optional string schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.optionalString('default');
      const { value } = schema.validate('test');
      expect(value).toBe('test');
    });

    it('should create an optional string schema without default value', () => {
      const schema = ConfigValidationDecorator.optionalString();
      const { value } = schema.validate('test');
      expect(value).toBe('test');
    });
  });

  describe('requiredNumber', () => {
    it('should create a required number schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.requiredNumber(42);
      const { value } = schema.validate(100);
      expect(value).toBe(100);
    });

    it('should create a required number schema without default value', () => {
      const schema = ConfigValidationDecorator.requiredNumber();
      const { value } = schema.validate(100);
      expect(value).toBe(100);
    });
  });

  describe('optionalNumber', () => {
    it('should create an optional number schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.optionalNumber(42);
      const { value } = schema.validate(100);
      expect(value).toBe(100);
    });

    it('should create an optional number schema without default value', () => {
      const schema = ConfigValidationDecorator.optionalNumber();
      const { value } = schema.validate(100);
      expect(value).toBe(100);
    });
  });

  describe('requiredBoolean', () => {
    it('should create a required boolean schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.requiredBoolean(true);
      const { value } = schema.validate(false);
      expect(value).toBe(false);
    });

    it('should create a required boolean schema without default value', () => {
      const schema = ConfigValidationDecorator.requiredBoolean();
      const { value } = schema.validate(false);
      expect(value).toBe(false);
    });
  });

  describe('optionalBoolean', () => {
    it('should create an optional boolean schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.optionalBoolean(true);
      const { value } = schema.validate(false);
      expect(value).toBe(false);
    });

    it('should create an optional boolean schema without default value', () => {
      const schema = ConfigValidationDecorator.optionalBoolean();
      const { value } = schema.validate(false);
      expect(value).toBe(false);
    });
  });

  describe('port', () => {
    it('should create a port schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.port(3000);
      const { value } = schema.validate(8080);
      expect(value).toBe(8080);
    });

    it('should create a port schema without default value', () => {
      const schema = ConfigValidationDecorator.port();
      const { value } = schema.validate(8080);
      expect(value).toBe(8080);
    });
  });

  describe('positiveNumber', () => {
    it('should create a positive number schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.positiveNumber(42);
      const { value } = schema.validate(100);
      expect(value).toBe(100);
    });

    it('should create a positive number schema without default value', () => {
      const schema = ConfigValidationDecorator.positiveNumber();
      const { value } = schema.validate(100);
      expect(value).toBe(100);
    });
  });

  describe('rangeNumber', () => {
    it('should create a range number schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.rangeNumber(1, 100, 50);
      const { value } = schema.validate(75);
      expect(value).toBe(75);
    });

    it('should create a range number schema without default value', () => {
      const schema = ConfigValidationDecorator.rangeNumber(1, 100);
      const { value } = schema.validate(75);
      expect(value).toBe(75);
    });
  });

  describe('uri', () => {
    it('should create a URI schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.uri('http://localhost');
      const { value } = schema.validate('http://example.com');
      expect(value).toBe('http://example.com');
    });

    it('should create a URI schema without default value', () => {
      const schema = ConfigValidationDecorator.uri();
      const { value } = schema.validate('http://example.com');
      expect(value).toBe('http://example.com');
    });
  });

  describe('enum', () => {
    it('should create an enum schema with the correct default value', () => {
      const schema = ConfigValidationDecorator.enum(['a', 'b', 'c'], 'a');
      const { value } = schema.validate('b');
      expect(value).toBe('b');
    });

    it('should create an enum schema without default value', () => {
      const schema = ConfigValidationDecorator.enum(['a', 'b', 'c']);
      const { value } = schema.validate('b');
      expect(value).toBe('b');
    });
  });
});