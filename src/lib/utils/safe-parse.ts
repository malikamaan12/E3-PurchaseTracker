/**
 * Robust JSON/PostgreSQL Array Parser
 * Parses request items stored in either standard JSON arrays or PostgreSQL array representations.
 */
export function safeParseItems(itemsData: any): any[] {
  if (!itemsData) return [];
  if (Array.isArray(itemsData)) return itemsData;
  if (typeof itemsData !== 'string') return [];

  const trimmed = itemsData.trim();
  
  // 1. Standard JSON array format: [...]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      return JSON.parse(trimmed);
    } catch (e) {
      console.error("[Safe Parse] Failed to parse items as JSON array:", e);
      return [];
    }
  }

  // 2. PostgreSQL text array format: {"{...}", "{...}"}
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const stripped = trimmed.substring(1, trimmed.length - 1);
      let elements: string[] = [];
      if (stripped.startsWith('"') && stripped.endsWith('"')) {
        const content = stripped.substring(1, stripped.length - 1);
        elements = content.split('","');
      } else {
        elements = [stripped];
      }

      return elements.map(el => {
        const unescaped = el
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '\\');
        try {
          return JSON.parse(unescaped);
        } catch (e) {
          console.error("[Safe Parse] Failed to parse unescaped Postgres array element:", unescaped, e);
          return null;
        }
      }).filter(Boolean);
    } catch (e) {
      console.error("[Safe Parse] Failed to parse items as PostgreSQL array:", e);
      return [];
    }
  }

  // 3. Fallback: single JSON object: {...}
  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    return [];
  }
}
