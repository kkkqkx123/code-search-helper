import * as Joi from 'joi';
import { ValidationUtils } from '../../config/utils/ValidationUtils';

describe('ValidationUtils', () => {
  describe('portSchema', () => {
    it('should create a port schema with the correct default value', () => {
      const schema = Joi.object({
        port: ValidationUtils.portSchema(3000)
      });
      const { value } = schema.validate({});
      expect(value.port).toBe(3000);
    });

    it('should validate a valid port number', () => {
      const schema = Joi.object({
        port: ValidationUtils.portSchema(3000)
      });
      const { value } = schema.validate({ port: 8080 });
      expect(value.port).toBe(8080);
    });

    it('should reject an invalid port number', () => {
      const schema = Joi.object({
        port: ValidationUtils.portSchema(3000)
      });
      const { error } = schema.validate({ port: 99999 });
      expect(error).toBeDefined();
    });
  });

  describe('positiveNumberSchema', () => {
    it('should create a positive number schema with the correct default value', () => {
      const schema = Joi.object({
        number: ValidationUtils.positiveNumberSchema(42)
      });
      const { value } = schema.validate({});
      expect(value.number).toBe(42);
    });

    it('should validate a positive number', () => {
      const schema = Joi.object({
        number: ValidationUtils.positiveNumberSchema(42)
      });
      const { value } = schema.validate({ number: 100 });
      expect(value.number).toBe(100);
    });

    it('should reject a negative number', () => {
      const schema = Joi.object({
        number: ValidationUtils.positiveNumberSchema(42)
      });
      const { error } = schema.validate({ number: -1 });
      expect(error).toBeDefined();
    });

    it('should reject zero', () => {
      const schema = Joi.object({
        number: ValidationUtils.positiveNumberSchema(42)
      });
      const { error } = schema.validate({ number: 0 });
      expect(error).toBeDefined();
    });
  });

  describe('optionalPositiveNumberSchema', () => {
    it('should create an optional positive number schema with the correct default value', () => {
      const schema = Joi.object({
        number: ValidationUtils.optionalPositiveNumberSchema(42)
      });
      const { value } = schema.validate({});
      expect(value.number).toBe(42);
    });

    it('should create an optional positive number schema without default value', () => {
      const schema = Joi.object({
        number: ValidationUtils.optionalPositiveNumberSchema()
      });
      const { value } = schema.validate({});
      expect(value.number).toBeUndefined();
    });

    it('should validate a positive number', () => {
      const schema = Joi.object({
        number: ValidationUtils.optionalPositiveNumberSchema(42)
      });
      const { value } = schema.validate({ number: 100 });
      expect(value.number).toBe(100);
    });

    it('should reject a negative number', () => {
      const schema = Joi.object({
        number: ValidationUtils.optionalPositiveNumberSchema(42)
      });
      const { error } = schema.validate({ number: -1 });
      expect(error).toBeDefined();
    });
  });

  describe('booleanSchema', () => {
    it('should create a boolean schema with the correct default value', () => {
      const schema = Joi.object({
        boolean: ValidationUtils.booleanSchema(true)
      });
      const { value } = schema.validate({});
      expect(value.boolean).toBe(true);
    });

    it('should validate a boolean value', () => {
      const schema = Joi.object({
        boolean: ValidationUtils.booleanSchema(true)
      });
      const { value } = schema.validate({ boolean: false });
      expect(value.boolean).toBe(false);
    });
  });

  describe('enumSchema', () => {
    it('should create an enum schema with the correct default value', () => {
      const schema = Joi.object({
        enum: ValidationUtils.enumSchema(['a', 'b', 'c'], 'a')
      });
      const { value } = schema.validate({});
      expect(value.enum).toBe('a');
    });

    it('should validate an allowed enum value', () => {
      const schema = Joi.object({
        enum: ValidationUtils.enumSchema(['a', 'b', 'c'], 'a')
      });
      const { value } = schema.validate({ enum: 'b' });
      expect(value.enum).toBe('b');
    });

    it('should reject a disallowed enum value', () => {
      const schema = Joi.object({
        enum: ValidationUtils.enumSchema(['a', 'b', 'c'], 'a')
      });
      const { error } = schema.validate({ enum: 'd' });
      expect(error).toBeDefined();
    });
  });

  describe('optionalStringSchema', () => {
    it('should create an optional string schema with the correct default value', () => {
      const schema = Joi.object({
        string: ValidationUtils.optionalStringSchema('default')
      });
      const { value } = schema.validate({});
      expect(value.string).toBe('default');
    });

    it('should create an optional string schema without default value', () => {
      const schema = Joi.object({
        string: ValidationUtils.optionalStringSchema()
      });
      const { value } = schema.validate({});
      expect(value.string).toBeUndefined();
    });

    it('should validate a string value', () => {
      const schema = Joi.object({
        string: ValidationUtils.optionalStringSchema('default')
      });
      const { value } = schema.validate({ string: 'test' });
      expect(value.string).toBe('test');
    });
  });

  describe('uriSchema', () => {
    it('should create a URI schema with the correct default value', () => {
      const schema = Joi.object({
        uri: ValidationUtils.uriSchema('http://localhost')
      });
      const { value } = schema.validate({});
      expect(value.uri).toBe('http://localhost');
    });

    it('should create an optional URI schema without default value', () => {
      const schema = Joi.object({
        uri: ValidationUtils.uriSchema()
      });
      const { value } = schema.validate({});
      expect(value.uri).toBeUndefined();
    });

    it('should validate a valid URI', () => {
      const schema = Joi.object({
        uri: ValidationUtils.uriSchema()
      });
      const { value } = schema.validate({ uri: 'http://example.com' });
      expect(value.uri).toBe('http://example.com');
    });

    it('should reject an invalid URI', () => {
      const schema = Joi.object({
        uri: ValidationUtils.uriSchema()
      });
      const { error } = schema.validate({ uri: 'invalid-uri' });
      expect(error).toBeDefined();
    });
  });

  describe('rangeNumberSchema', () => {
    it('should create a range number schema with the correct default value', () => {
      const schema = Joi.object({
        number: ValidationUtils.rangeNumberSchema(1, 100, 50)
      });
      const { value } = schema.validate({});
      expect(value.number).toBe(50);
    });

    it('should validate a number within range', () => {
      const schema = Joi.object({
        number: ValidationUtils.rangeNumberSchema(1, 100, 50)
      });
      const { value } = schema.validate({ number: 75 });
      expect(value.number).toBe(75);
    });

    it('should reject a number below the minimum', () => {
      const schema = Joi.object({
        number: ValidationUtils.rangeNumberSchema(1, 100, 50)
      });
      const { error } = schema.validate({ number: 0 });
      expect(error).toBeDefined();
    });

    it('should reject a number above the maximum', () => {
      const schema = Joi.object({
        number: ValidationUtils.rangeNumberSchema(1, 100, 50)
      });
      const { error } = schema.validate({ number: 101 });
      expect(error).toBeDefined();
    });
  });

  describe('optionalRangeNumberSchema', () => {
    it('should create an optional range number schema with the correct default value', () => {
      const schema = Joi.object({
        number: ValidationUtils.optionalRangeNumberSchema(1, 100, 50)
      });
      const { value } = schema.validate({});
      expect(value.number).toBe(50);
    });

    it('should create an optional range number schema without default value', () => {
      const schema = Joi.object({
        number: ValidationUtils.optionalRangeNumberSchema(1, 100)
      });
      const { value } = schema.validate({});
      expect(value.number).toBeUndefined();
    });

    it('should validate a number within range', () => {
      const schema = Joi.object({
        number: ValidationUtils.optionalRangeNumberSchema(1, 100, 50)
      });
      const { value } = schema.validate({ number: 75 });
      expect(value.number).toBe(75);
    });

    it('should reject a number below the minimum', () => {
      const schema = Joi.object({
        number: ValidationUtils.optionalRangeNumberSchema(1, 100, 50)
      });
      const { error } = schema.validate({ number: 0 });
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
      const schema = Joi.object({
        object: ValidationUtils.objectSchema({
          name: Joi.string().required(),
          age: Joi.number().positive().required(),
        })
      });

      const { value } = schema.validate({
        object: {
          name: 'test',
          age: 25,
        },
      });

      expect(value).toEqual({
        object: {
          name: 'test',
          age: 25,
        },
      });
    });
  });

  describe('optionalObjectSchema', () => {
    it('should create an optional object schema with the correct structure', () => {
      const schema = Joi.object({
        object: ValidationUtils.optionalObjectSchema({
          name: Joi.string().required(),
          age: Joi.number().positive().required(),
        })
      });

      const { value } = schema.validate({
        object: {
          name: 'test',
          age: 25,
        },
      });

      expect(value).toEqual({
        object: {
          name: 'test',
          age: 25,
        },
      });
    });

    it('should allow undefined values', () => {
      const schema = Joi.object({
        object: ValidationUtils.optionalObjectSchema({
          name: Joi.string().required(),
          age: Joi.number().positive().required(),
        })
      });

      const { value } = schema.validate({});
      expect(value.object).toBeUndefined();
    });
  });
});