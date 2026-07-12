type PrimitiveClassValue = string | number | boolean | null | undefined;
type DictionaryClassValue = Record<string, PrimitiveClassValue>;
export type ClassValue = PrimitiveClassValue | DictionaryClassValue | ClassValue[];

function appendClassNames(value: ClassValue, output: string[]) {
  if (!value) return;

  if (Array.isArray(value)) {
    for (const nestedValue of value) {
      appendClassNames(nestedValue, output);
    }
    return;
  }

  if (typeof value === "object") {
    for (const [className, shouldInclude] of Object.entries(value)) {
      if (shouldInclude) output.push(className);
    }
    return;
  }

  output.push(String(value));
}

export function cn(...inputs: ClassValue[]) {
  const output: string[] = [];

  for (const input of inputs) {
    appendClassNames(input, output);
  }

  return output.join(" ");
}
