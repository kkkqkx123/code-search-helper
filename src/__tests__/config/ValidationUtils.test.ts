import * as Joi from 'joi';
import { ValidationUtils } from '../../config/utils/ValidationUtils';

describe('ValidationUtils', () => {
  describe('portSchema', () => {
    it('should create a port schema with the correct default value', () => {
      const schema = ValidationUtils.portSchema(3000);
      const { value } = schema.validate({});
      expect(value).toBe(3000);
    });

    it('should validate a valid port number', () => {
      const schema = ValidationUtils.portSchema(3000);
      const { value } = schema.validate(8080);
      expect(value).toBe(8080);
    });

    it('should reject an invalid port number', () => {
      const schema = ValidationUtils.portSchema(3000);
      const { error } = schema.validate(99999);
      expect(error).toBeDefined();
    });
  });

  describe('positiveNumberSchema', () => {
    it('should create a positive number schema with the correct default value', () => {
      const schema = ValidationUtils.positiveNumberSchema(42);
      const { value } = schema.validate({});
      expect(value).toBe(42);
    });

    it('should validate a positive number', () => {
      const schema = ValidationUtils.positiveNumberSchema(42);
      const { value } = schema.validate(100);
      expect(value).toBe(100);
    });

    it('should reject a negative number', () => {
      const schema = ValidationUtils.positiveNumberSchema(42);
      const { error } = schema.validate(-1);
      expect(error).toBeDefined();
    });

    it('should reject zero', () => {
      const schema = ValidationUtils.positiveNumberSchema(42);
      const { error } = schema.validate(0);
      expect(error).toBeDefined();
    });
  });

  describe('optionalPositiveNumberSchema', () => {
    it('should create an optional positive number schema with the correct default value', () => {
      const schema = ValidationUtils.optionalPositiveNumberSchema(42);
      const { value } = schema.validate({});
      expect(value).toBe(42);
    });

    it('should create an optional positive number schema without default value', () => {
      const schema = ValidationUtils.optionalPositiveNumberSchema();
      const { value } = schema.validate({});
      expect(value).toBeUndefined();
    });

    it('should validate a positive number', () => {
      const schema = ValidationUtils.optionalPositiveNumberSchema(42);
      const { value } = schema.validate(100);
      expect(value).toBe(100);
    });

    it('should reject a negative number', () => {
      const schema = ValidationUtils.optionalPositiveNumberSchema(42);
      const { error } = schema.validate(-1);
      expect(error).toBeDefined();
    });
  });

  describe('booleanSchema', () => {
    it('should create a boolean schema with the correct default value', () => {
      const schema = ValidationUtils.booleanSchema(true);
      const { value } = schema.validate({});
      expect(value).toBe(true);
    });

    it('should validate a boolean value', () => {
      const schema = ValidationUtils.booleanSchema(true);
      const { value } = schema.validate(false);
      expect(value).toBe(false);
    });
  });

  describe('enumSchema', () => {
    it('should create an enum schema with the correct default value', () => {
      const schema = ValidationUtils.enumSchema(['a', 'b', 'c'], 'a');
      const { value } = schema.validate({});
      expect(value).toBe('a');
    });

    it('should validate an allowed enum value', () => {
      const schema = ValidationUtils.enumSchema(['a', 'b', 'c'], 'a');
      const { value } = schema.validate('b');
      expect(value).toBe('b');
    });

    it('should reject a disallowed enum value', () => {
      const schema = ValidationUtils.enumSchema(['a', 'b', 'c'], 'a');
      const { error } = schema.validate('d');
      expect(error).toBeDefined();
    });
  });

  describe('optionalStringSchema', () => {
    it('should create an optional string schema with the correct default value', () => {
      const schema = ValidationUtils.optionalStringSchema('default');
      const { value } = schema.validate({});
      expect(value).toBe('default');
    });

    it('should create an optional string schema without default value', () => {
      const schema = ValidationUtils.optionalStringSchema();
      const { value } = schema.validate({});
      expect(value).toBeUndefined();
    });

    it('should validate a string value', () => {
      const schema = ValidationUtils.optionalStringSchema('default');
      const { value } = schema.validate('test');
      expect(value).toBe('test');
    });
  });

  describe('uriSchema', () => {
    it('should create a URI schema with the correct default value', () => {
      const schema = ValidationUtils.uriSchema('http://localhost');
      const { value } = schema.validate({});
      expect(value).toBe('http://localhost');
    });

    it('should create an optional URI schema without default value', () => {
      const schema = ValidationUtils.uriSchema();
      const { value } = schema.validate({});
      expect(value).toBeUndefined();
    });

    it('should validate a valid URI', () => {
      const schema = ValidationUtils.uriSchema();
      const { value } = schema.validate('http://example.com');
      expect(value).toBe('http://example.com');
    });

    it('should reject an invalid URI', () => {
      const schema = ValidationUtils.uriSchema();
      const { error } = schema.validate('invalid-uri');
      expect(error).toBeDefined();
    });
  });

  describe('rangeNumberSchema', () => {
    it('should create a range number schema with the correct default value', () => {
      const schema = ValidationUtils.rangeNumberSchema(1, 100, 50);
      const { value } = schema.validate({});
      expect(value).toBe(50);
    });

    it('should validate a number within range', () => {
      const schema = ValidationUtils.rangeNumberSchema(1, 100, 50);
      const { value } = schema.validate(75);
      expect(value).toBe(75);
    });

    it('should reject a number below the minimum', () => {
      const schema = ValidationUtils.rangeNumberSchema(1, 100, 50);
      const { error } = schema.validate(0);
      expect(error).toBeDefined();
    });

    it('should reject a number above the maximum', () => {
      const schema = ValidationUtils.rangeNumberSchema(1, 100, 50);
      const { error } = schema.validate(101);
      expect(error).toBeDefined();
    });
  });

  describe('optionalRangeNumberSchema', () => {
    it('should create an optional range number schema with the correct default value', () => {
      const schema = ValidationUtils.optionalRangeNumberSchema(1, 100, 50);
      const { value } = schema.validate({});
      expect(value).toBe(50);
    });

    it('should create an optional range number schema without default value', () => {
      const schema = ValidationUtils.optionalRangeNumberSchema(1, 100);
      const { value } = schema.validate({});
      expect(value).toBeUndefined();
    });

    it('should validate a number within range', () => {
      const schema = ValidationUtils.optionalRangeNumberSchema(1, 100, 50);
      const { value } = schema.validate(75);
      expect(value).toBe(75);
    });

    it('should reject a number below the minimum', () => {
      const schema = ValidationUtils.optionalRangeNumberSchema(1, 100, 50);
      const { error } = schema.validate(0);
      expect(error).toBeDefined();
    });
  });

  describe('validateConfig', () => {
    it('should validate a config object successfully', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().positive().required(),
      });

      const config = {
        name: 'test',
        age: 25,
      };

      const result = ValidationUtils.validateConfig(config, schema);
      expect(result).toEqual(config);
    });

    it('should throw an error for invalid config', () => {
      const schema = Joi.object({
        name: Joi.string().required(),
        age: Joi.number().positive().required(),
      });

      const config = {
        name: 'test',
        age: -1, // Invalid: negative number
      };

      expect(() => ValidationUtils.validateConfig(config, schema)).toThrow();
    });
  });

  describe('objectSchema', () => {
    it('should create an object schema with the correct structure', () => {
      const schema = ValidationUtils.objectSchema({
        name: Joi.string().required(),
        age: Joi.number().positive().required(),
      });

      const { value } = schema.validate({
        name: 'test',
        age: 25,
      });

      expect(value).toEqual({
        name: 'test',
        age: 25,
      });
    });
  });

  describe('optionalObjectSchema', () => {
    it('should create an optional object schema with the correct structure', () => {
      const schema = ValidationUtils.optionalObjectSchema({
        name: Joi.string().required(),
        age: Joi.number().positive().required(),
      });

      const { value } = schema.validate({
        name: 'test',
        age: 25,
      });

      expect(value).toEqual({
        name: 'test',
        age: 25,
      });
    });

    it('should allow undefined values', () => {
      const schema = ValidationUtils.optionalObjectSchema({
        name: Joi.string().required(),
        age: Joi.number().positive().required(),
      });

      const { value } = schema.validate(undefined);
      expect(value).toBeUndefined();
    });
  });
});