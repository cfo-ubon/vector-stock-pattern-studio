import { describe, it, expect } from 'vitest';
import { validateAgainstSchema, isValid, type JsonSchema, type SchemaRegistry } from './jsonSchemaValidator';

describe('jsonSchemaValidator: type checks', () => {
  it('accepts a matching primitive type', () => {
    expect(isValid('hello', { type: 'string' })).toBe(true);
    expect(isValid(42, { type: 'number' })).toBe(true);
    expect(isValid(true, { type: 'boolean' })).toBe(true);
    expect(isValid(null, { type: 'null' })).toBe(true);
  });

  it('rejects a mismatched primitive type with a descriptive issue', () => {
    const issues = validateAgainstSchema(42, { type: 'string' });
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Expected type "string"');
    expect(issues[0].message).toContain('"integer"');
  });

  it('treats a whole number as satisfying "number" but "integer" still requires no fraction', () => {
    expect(isValid(3, { type: 'number' })).toBe(true);
    expect(isValid(3.5, { type: 'number' })).toBe(true);
    expect(isValid(3, { type: 'integer' })).toBe(true);
    expect(isValid(3.5, { type: 'integer' })).toBe(false);
  });

  it('distinguishes array from object from null', () => {
    expect(isValid([], { type: 'array' })).toBe(true);
    expect(isValid({}, { type: 'array' })).toBe(false);
    expect(isValid({}, { type: 'object' })).toBe(true);
    expect(isValid(null, { type: 'object' })).toBe(false);
  });

  it('short-circuits further checks once the type itself is wrong', () => {
    const issues = validateAgainstSchema('abc', { type: 'number', minimum: 10 });
    expect(issues).toHaveLength(1);
  });
});

describe('jsonSchemaValidator: string constraints', () => {
  const schema: JsonSchema = { type: 'string', minLength: 2, maxLength: 4, pattern: '^[a-z]+$' };

  it('accepts a string within all constraints', () => {
    expect(isValid('abcd', schema)).toBe(true);
  });

  it('flags too-short, too-long, and pattern-mismatched strings independently', () => {
    expect(validateAgainstSchema('a', schema).some((i) => i.message.includes('minLength'))).toBe(true);
    expect(validateAgainstSchema('abcde', schema).some((i) => i.message.includes('maxLength'))).toBe(true);
    expect(validateAgainstSchema('AB', schema).some((i) => i.message.includes('pattern'))).toBe(true);
  });
});

describe('jsonSchemaValidator: numeric constraints', () => {
  const schema: JsonSchema = { type: 'number', minimum: 0, maximum: 1 };

  it('accepts a number within range, rejects below/above', () => {
    expect(isValid(0.5, schema)).toBe(true);
    expect(validateAgainstSchema(-1, schema)[0].message).toContain('below minimum');
    expect(validateAgainstSchema(2, schema)[0].message).toContain('above maximum');
  });
});

describe('jsonSchemaValidator: enum', () => {
  it('accepts a listed value and rejects an unlisted one', () => {
    const schema: JsonSchema = { type: 'string', enum: ['a', 'b'] };
    expect(isValid('a', schema)).toBe(true);
    expect(isValid('c', schema)).toBe(false);
  });
});

describe('jsonSchemaValidator: arrays', () => {
  const schema: JsonSchema = { type: 'array', minItems: 1, maxItems: 2, items: { type: 'number' } };

  it('enforces minItems/maxItems', () => {
    expect(validateAgainstSchema([], schema).some((i) => i.message.includes('minItems'))).toBe(true);
    expect(validateAgainstSchema([1, 2, 3], schema).some((i) => i.message.includes('maxItems'))).toBe(true);
  });

  it('validates each item against `items` and reports its index in the path', () => {
    const issues = validateAgainstSchema([1, 'bad'], schema);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('$[1]');
  });
});

describe('jsonSchemaValidator: objects', () => {
  const schema: JsonSchema = {
    type: 'object',
    required: ['id', 'label'],
    additionalProperties: false,
    properties: {
      id: { type: 'string' },
      label: { type: 'string' },
      count: { type: 'integer' },
    },
  };

  it('accepts a fully-conforming object', () => {
    expect(isValid({ id: 'x', label: 'X', count: 1 }, schema)).toBe(true);
  });

  it('reports every missing required field', () => {
    const issues = validateAgainstSchema({}, schema);
    expect(issues.map((i) => i.path).sort()).toEqual(['$.id', '$.label']);
  });

  it('recurses into nested property schemas with a dotted path', () => {
    const issues = validateAgainstSchema({ id: 'x', label: 'X', count: 'not-a-number' }, schema);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe('$.count');
  });

  it('flags unexpected additional properties when additionalProperties is false', () => {
    const issues = validateAgainstSchema({ id: 'x', label: 'X', extra: true }, schema);
    expect(issues.some((i) => i.path === '$.extra' && i.message.includes('additional'))).toBe(true);
  });
});

describe('jsonSchemaValidator: oneOf', () => {
  const schema: JsonSchema = {
    oneOf: [{ type: 'null' }, { type: 'object', required: ['id'], properties: { id: { type: 'string' } } }],
  };

  it('accepts a value matching any one branch', () => {
    expect(isValid(null, schema)).toBe(true);
    expect(isValid({ id: 'x' }, schema)).toBe(true);
  });

  it('reports the closest-matching branch when nothing matches', () => {
    const issues = validateAgainstSchema({}, schema);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('rejects a value matching neither branch', () => {
    expect(isValid('nope', schema)).toBe(false);
  });
});

describe('jsonSchemaValidator: $ref resolution', () => {
  it('resolves a local "#/definitions/..." ref against the same document', () => {
    const schema: JsonSchema = {
      type: 'object',
      required: ['point'],
      properties: { point: { $ref: '#/definitions/point' } },
      definitions: { point: { type: 'object', required: ['x', 'y'], properties: { x: { type: 'number' }, y: { type: 'number' } } } },
    };
    expect(isValid({ point: { x: 1, y: 2 } }, schema)).toBe(true);
    expect(isValid({ point: { x: 1 } }, schema)).toBe(false);
  });

  it('resolves a cross-file ref through the registry by $id', () => {
    const pointSchema: JsonSchema = {
      $id: 'point.schema.json',
      type: 'object',
      required: ['x', 'y'],
      properties: { x: { type: 'number' }, y: { type: 'number' } },
    };
    const registry: SchemaRegistry = { 'point.schema.json': pointSchema };
    const shapeSchema: JsonSchema = {
      type: 'object',
      required: ['origin'],
      properties: { origin: { $ref: 'point.schema.json' } },
    };
    expect(isValid({ origin: { x: 0, y: 0 } }, shapeSchema, registry)).toBe(true);
    expect(isValid({ origin: { x: 0 } }, shapeSchema, registry)).toBe(false);
  });

  it('returns an issue for an unresolvable ref instead of throwing', () => {
    const schema: JsonSchema = { $ref: 'missing.schema.json' };
    const issues = validateAgainstSchema({}, schema, {});
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('Unresolvable');
  });
});
