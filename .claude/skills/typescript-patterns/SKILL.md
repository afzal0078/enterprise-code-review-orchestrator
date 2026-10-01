---
description: Advanced TypeScript patterns, strict type-safety rules, idiomatic design practices, and type-system pitfall prevention
---

# TypeScript Architectural & Type Patterns

Provides specialized heuristics for evaluating TypeScript code quality, structural typing precision, and idiomatic ecosystem patterns.

## Type Safety Principles
- **Eliminate `any`**: Discourage unrestricted `any`. Require `unknown` with type narrowing (type guards, `typeof`, `instanceof`, or Zod validation schemas).
- **Strict Null Checks**: Enforce handling of `null` and `undefined`. Discourage unsafe non-null assertion operator (`!`) unless proven unreachable by explicit invariants.
- **Discriminated Unions**: Prefer tagged unions over loose optional bag objects (`{ type: 'success', data: T } | { type: 'error', error: Error }`).
- **Readonly Immobility**: Use `readonly` arrays/properties (`ReadonlyArray<T>`, `readonly string[]`, `as const`) for configuration tables, lookup maps, and domain parameters to prevent accidental side effects.

## Modern Language & Type Features
- **Utility Types**: Leverage built-in utility types (`Partial`, `Required`, `Pick`, `Omit`, `Record`, `Extract`, `Exclude`) instead of hand-crafting duplicate interfaces.
- **Template Literal Types & Branded Types**: Use template literal types (`type EventName = \`on\${Capitalize<string>}\``) or nominal branding for IDs (`type UserId = string & { readonly __brand: unique symbol }`) to prevent ID mix-ups.
- **Generics Constraints**: Constrain generic type arguments (`<T extends Record<string, unknown>>`) rather than using unbounded parameter types.
- **Satisfies Operator**: Use `satisfies` to validate object shapes against types without losing concrete literal inference.

## Design & Structural Conventions
- **Interface vs. Type Alias**: Use `interface` for public extension points and object contracts; use `type` for unions, intersections, primitives, and mapped types.
- **Narrowing Guards**: Implement custom type guards (`function isRecord(val: unknown): val is Record<string, unknown>`) when checking heterogeneous dynamic data.
- **Exhaustiveness Checking**: Enforce compile-time exhaustiveness in `switch` statements using the `never` type check pattern.

## Code Review Output Guidelines
When evaluating TypeScript code, provide:
1. Exact symbol or location in file.
2. The specific type weakness or safety risk.
3. Recommended modern refactored snippet.
4. Impact rating (High / Medium / Low).
