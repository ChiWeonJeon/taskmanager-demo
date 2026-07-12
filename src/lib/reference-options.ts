export interface ReferenceLikeOption {
  value: string;
  label: string;
  color?: string | null;
  aliases?: string[];
}

export function getReferenceOptionAliases(option: ReferenceLikeOption) {
  const aliases = new Set<string>();
  for (const value of [option.value, ...(option.aliases ?? [])]) {
    if (value) aliases.add(value);
  }
  return Array.from(aliases);
}

export function optionMatchesValue(option: ReferenceLikeOption, value: string | null | undefined) {
  if (!value) return false;
  return getReferenceOptionAliases(option).includes(value);
}

export function findReferenceOption<T extends ReferenceLikeOption>(
  options: T[],
  value: string | null | undefined,
) {
  return options.find((option) => optionMatchesValue(option, value));
}

export function canonicalizeReferenceValue<T extends ReferenceLikeOption>(
  options: T[],
  value: string | null | undefined,
) {
  if (!value) return value ?? "";
  return findReferenceOption(options, value)?.value ?? value;
}

export function canonicalizeReferenceValues<T extends ReferenceLikeOption>(
  options: T[],
  values: string[],
) {
  const next = new Set<string>();
  for (const value of values) {
    const canonicalValue = canonicalizeReferenceValue(options, value);
    if (canonicalValue) next.add(canonicalValue);
  }
  return Array.from(next);
}

export function mergeReferenceOptions<T extends ReferenceLikeOption>(
  staticOptions: T[],
  dynamicOptions: T[],
) {
  const merged = new Map<string, ReferenceLikeOption>();

  for (const option of [...staticOptions, ...dynamicOptions]) {
    const existing = merged.get(option.value);
    if (!existing) {
      merged.set(option.value, {
        value: option.value,
        label: option.label,
        color: option.color ?? null,
        aliases: option.aliases?.filter(Boolean),
      });
      continue;
    }

    const aliases = new Set([...(existing.aliases ?? []), ...(option.aliases ?? [])].filter(Boolean));
    merged.set(option.value, {
      value: existing.value,
      label: option.label || existing.label,
      color: option.color ?? existing.color ?? null,
      aliases: aliases.size > 0 ? Array.from(aliases) : undefined,
    });
  }

  return Array.from(merged.values());
}
