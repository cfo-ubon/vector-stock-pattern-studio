// Validation Engine core (Design Intelligence Core Phase 1, deliverable
// 10) — a small, hand-rolled JSON Schema (draft-07-subset) validator.
// This app has zero validation-library dependencies anywhere (every
// existing import/export validator in metadata/*.ts, trend/*.ts,
// project/*.ts hand-rolls its own structural checks) and no server-side
// dependencies at all, so a real npm JSON-Schema library (ajv etc.) would
// be the first validation dependency this codebase has ever needed —
// this module keeps that streak instead, supporting exactly the subset of
// JSON Schema the 9 schemas in /schemas actually use: type, properties,
// required, additionalProperties, enum, items, minItems, maxItems,
// minLength, maxLength, minimum, maximum, pattern, oneOf, and $ref
// (a local "#/definitions/X" pointer, or a registry lookup by another
// schema file's own $id).

export type JsonSchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';

export interface JsonSchema {
  $id?: string;
  $ref?: string;
  title?: string;
  description?: string;
  type?: JsonSchemaType;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  enum?: unknown[];
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  oneOf?: JsonSchema[];
  definitions?: Record<string, JsonSchema>;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Maps a schema `$id` (e.g. "keywordBundle.schema.json") to its parsed
 * JsonSchema — how cross-file `$ref`s are resolved. Callers build this
 * once (see `validators/index.ts`'s `SCHEMA_REGISTRY`) and pass it to
 * every validation call. */
export type SchemaRegistry = Record<string, JsonSchema>;

function typeOf(value: unknown): JsonSchemaType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'boolean') return 'boolean';
  return 'object';
}

function typeMatches(actual: JsonSchemaType, expected: JsonSchemaType): boolean {
  if (actual === expected) return true;
  // A whole-number JS number satisfies a "number" schema even when its
  // runtime type tag came back "integer" (and vice versa is intentionally
  // NOT allowed — a schema asking specifically for "integer" should still
  // reject 1.5).
  if (expected === 'number' && actual === 'integer') return true;
  return false;
}

function resolveRef(ref: string, rootSchema: JsonSchema, registry: SchemaRegistry): JsonSchema | null {
  if (ref.startsWith('#/')) {
    const parts = ref.slice(2).split('/');
    let node: unknown = rootSchema;
    for (const part of parts) {
      if (typeof node !== 'object' || node === null) return null;
      node = (node as Record<string, unknown>)[part];
    }
    return (node as JsonSchema) ?? null;
  }
  return registry[ref] ?? null;
}

/** Validates `data` against `schema`, returning every issue found (empty
 * array = valid). `rootSchema` (defaults to `schema` itself) is what local
 * "#/definitions/..." refs resolve against — pass it explicitly when
 * validating a sub-schema so its local refs still resolve to the
 * top-level document's own definitions. */
export function validateAgainstSchema(
  data: unknown,
  schema: JsonSchema,
  registry: SchemaRegistry = {},
  path = '$',
  rootSchema: JsonSchema = schema,
): ValidationIssue[] {
  if (schema.$ref) {
    const resolved = resolveRef(schema.$ref, rootSchema, registry);
    if (!resolved) return [{ path, message: `Unresolvable $ref "${schema.$ref}"` }];
    // A cross-file $ref switches "root" to the referenced document so its
    // own local #/definitions/... resolve correctly; a local #/... ref
    // keeps the current root.
    const nextRoot = schema.$ref.startsWith('#/') ? rootSchema : resolved;
    return validateAgainstSchema(data, resolved, registry, path, nextRoot);
  }

  if (schema.oneOf) {
    const results = schema.oneOf.map((sub) => validateAgainstSchema(data, sub, registry, path, rootSchema));
    if (results.some((issues) => issues.length === 0)) return [];
    // None matched — report the branch with the fewest issues as the most
    // likely intended shape, so the message stays actionable.
    const best = results.reduce((a, b) => (b.length < a.length ? b : a));
    return best.length > 0 ? best : [{ path, message: 'Value did not match any allowed shape (oneOf)' }];
  }

  const issues: ValidationIssue[] = [];

  if (schema.enum && !schema.enum.some((v) => v === data)) {
    issues.push({ path, message: `Value ${JSON.stringify(data)} is not one of ${JSON.stringify(schema.enum)}` });
  }

  if (schema.type) {
    const actual = typeOf(data);
    if (!typeMatches(actual, schema.type)) {
      issues.push({ path, message: `Expected type "${schema.type}" but got "${actual}"` });
      return issues; // further checks would be meaningless against the wrong type
    }
  }

  if (schema.type === 'string' && typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      issues.push({ path, message: `String shorter than minLength ${schema.minLength}` });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      issues.push({ path, message: `String longer than maxLength ${schema.maxLength}` });
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(data)) {
      issues.push({ path, message: `String does not match pattern ${schema.pattern}` });
    }
  }

  if ((schema.type === 'number' || schema.type === 'integer') && typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      issues.push({ path, message: `Number below minimum ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      issues.push({ path, message: `Number above maximum ${schema.maximum}` });
    }
  }

  if (schema.type === 'array' && Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      issues.push({ path, message: `Array shorter than minItems ${schema.minItems}` });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      issues.push({ path, message: `Array longer than maxItems ${schema.maxItems}` });
    }
    if (schema.items) {
      data.forEach((item, i) => {
        issues.push(...validateAgainstSchema(item, schema.items!, registry, `${path}[${i}]`, rootSchema));
      });
    }
  }

  if (schema.type === 'object' && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) issues.push({ path: `${path}.${key}`, message: 'Missing required field' });
    }
    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          issues.push(...validateAgainstSchema(obj[key], subSchema, registry, `${path}.${key}`, rootSchema));
        }
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(obj)) {
          if (!(key in schema.properties)) issues.push({ path: `${path}.${key}`, message: 'Unexpected additional property' });
        }
      }
    }
  }

  return issues;
}

export function isValid(data: unknown, schema: JsonSchema, registry: SchemaRegistry = {}): boolean {
  return validateAgainstSchema(data, schema, registry).length === 0;
}
