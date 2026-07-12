"use client";

interface TaskTitleHighlightProps {
  text: string;
  query?: string;
}

function getHighlightedParts(text: string, query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) {
    return [{ value: text, matched: false }];
  }

  const parts: { value: string; matched: boolean }[] = [];
  const lowerText = text.toLocaleLowerCase();
  let cursor = 0;

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(normalizedQuery, cursor);
    if (matchIndex === -1) {
      parts.push({ value: text.slice(cursor), matched: false });
      break;
    }

    if (matchIndex > cursor) {
      parts.push({ value: text.slice(cursor, matchIndex), matched: false });
    }

    parts.push({
      value: text.slice(matchIndex, matchIndex + normalizedQuery.length),
      matched: true,
    });
    cursor = matchIndex + normalizedQuery.length;
  }

  return parts;
}

export function TaskTitleHighlight({ text, query = "" }: TaskTitleHighlightProps) {
  const parts = getHighlightedParts(text, query);

  return (
    <>
      {parts.map((part, index) => (
        <span
          key={`${part.value}-${index}`}
          className={part.matched ? "text-[var(--color-accent)]" : undefined}
        >
          {part.value}
        </span>
      ))}
    </>
  );
}
