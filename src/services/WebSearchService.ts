const SEARCH_KEYWORDS = [
  "latest", "current", "today", "news", "recent",
  "price of", "weather", "who won", "score", "stock",
  "update on", "what happened", "how much is", "when did",
  "who is", "what is the", "search for", "look up", "find out",
];

const SEARCH_PATTERNS = [
  /\b(latest|current|recent|today'?s?)\b.*\b(news|update|price|score|results?|status)\b/i,
  /\b(who|what|when|where|how)\b.*\b(won|happened|is|are|was|were|did)\b.*\b(today|now|currently|recently|2026|2025)\b/i,
  /\b(search|look up|find|google)\b/i,
];

export function detectSearchIntent(message: string): boolean {
  const lower = message.toLowerCase();
  if (SEARCH_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  return SEARCH_PATTERNS.some((pat) => pat.test(message));
}

const FILLER_PATTERNS = [
  /^(hey|hi|hello|please|can you|could you|would you|i want to know|tell me|i need to know)\s*/i,
  /\?$/,
  /\b(about|regarding|on the topic of)\b/gi,
];

export function extractSearchQuery(message: string): string {
  let query = message;
  for (const pattern of FILLER_PATTERNS) {
    query = query.replace(pattern, " ");
  }
  return query.replace(/\s+/g, " ").trim() || message;
}

interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

let dailyCount = 0;
let resetDate = new Date().toDateString();

export function isSearchAvailable(): boolean {
  const today = new Date().toDateString();
  if (today !== resetDate) {
    dailyCount = 0;
    resetDate = today;
  }
  return dailyCount < 95;
}

export async function search(query: string): Promise<SearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX;

  if (!apiKey || !cx) {
    console.warn("[WebSearch] Missing GOOGLE_API_KEY or GOOGLE_SEARCH_CX");
    return [];
  }

  if (!isSearchAvailable()) {
    console.warn("[WebSearch] Daily quota reached (95/100)");
    return [];
  }

  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=5`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`[WebSearch] API error: ${res.status}`);
      return [];
    }

    dailyCount++;

    const data = await res.json();
    const items = (data as { items?: Array<{ title: string; snippet: string; link: string }> }).items ?? [];

    return items.map((item) => ({
      title: item.title,
      snippet: item.snippet,
      link: item.link,
    }));
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      console.error("[WebSearch] Request timed out");
    } else {
      console.error("[WebSearch] Request failed:", err);
    }
    return [];
  }
}

export function formatSearchResults(results: SearchResult[]): string {
  if (results.length === 0) return "";
  const formatted = results
    .map((r, i) => `${i + 1}. [${r.title}](${r.link}) — ${r.snippet}`)
    .join("\n");
  return `## Web Search Results\n\n${formatted}\n\nUse these search results to provide an accurate, up-to-date answer. Cite sources with markdown links.`;
}
