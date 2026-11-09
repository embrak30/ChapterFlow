// Supabase embeds a unique child relationship as an object, not an array.
export function relatedRecords<T>(value: T | T[] | null | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}
