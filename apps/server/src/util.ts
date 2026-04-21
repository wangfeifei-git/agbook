import { nanoid } from 'nanoid';

export const now = () => Date.now();
export const id = () => nanoid(16);

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function stringifyJson(value: unknown): string | null {
  if (value == null) return null;
  return JSON.stringify(value);
}
