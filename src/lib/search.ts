// =====================================================
// BÚSQUEDA INTELIGENTE CON DISTANCIA FUZZY
// =====================================================

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function getSearchWords(text: string): string[] {
  return normalizeText(text).split(/\s+/).filter(w => w.length > 0);
}

/**
 * Checks if `sub` is a subsequence of `str` — all chars of sub appear
 * in str in order, but not necessarily consecutively.
 * "gdllo" is a subsequence of "gordillo" (g→o→r→d→i→l→l→o)
 * Returns the ratio of matched length to target length (0-1).
 */
function subsequenceScore(sub: string, str: string): number {
  if (sub.length === 0) return 0;
  let j = 0;
  for (let i = 0; i < str.length && j < sub.length; i++) {
    if (str[i] === sub[j]) j++;
  }
  if (j === sub.length) {
    return sub.length / str.length;
  }
  return 0;
}

/**
 * Levenshtein edit distance — number of insertions, deletions, or
 * substitutions needed to turn `a` into `b`.
 */
function editDistance(a: string, b: string): number {
  const la = a.length, lb = b.length;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prev = Array.from({ length: lb + 1 }, (_, i) => i);
  let curr = new Array(lb + 1);

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

/**
 * Normalized edit-distance similarity (0-1).
 * 1 = identical, 0 = completely different.
 */
function editSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - editDistance(a, b) / maxLen;
}

/**
 * Best edit similarity of search against any substring of target
 * of similar length. Handles partial matches inside long strings.
 */
function bestSubstringSimilarity(search: string, target: string): number {
  const sLen = search.length;
  if (sLen === 0 || target.length === 0) return 0;
  if (sLen > target.length) return editSimilarity(search, target);

  let best = 0;
  const windowMin = Math.max(1, sLen - 2);
  const windowMax = Math.min(target.length, sLen + 2);

  for (let winLen = windowMin; winLen <= windowMax; winLen++) {
    for (let i = 0; i <= target.length - winLen; i++) {
      const sub = target.substring(i, i + winLen);
      const sim = editSimilarity(search, sub);
      if (sim > best) best = sim;
      if (best >= 0.9) return best;
    }
  }
  return best;
}

/**
 * Combined fuzzy score (0-100) using multiple strategies:
 * exact > contains > subsequence > edit-distance
 */
export function fuzzySearch(searchTerm: string, targetText: string): number {
  if (!searchTerm || !targetText) return 0;

  const ns = normalizeText(searchTerm);
  const nt = normalizeText(targetText);

  if (!ns || !nt) return 0;

  if (nt === ns) return 100;
  if (nt.includes(ns)) return 85;
  if (nt.startsWith(ns)) return 90;

  const searchWords = getSearchWords(searchTerm);
  const targetWords = getSearchWords(targetText);
  if (searchWords.length === 0) return 0;

  let totalScore = 0;

  // Single-word search against full target
  if (searchWords.length === 1) {
    const sw = searchWords[0];

    // Subsequence match (handles "gdllo" → "gordillo")
    const subseqFull = subsequenceScore(sw, nt);
    if (subseqFull > 0) totalScore = Math.max(totalScore, subseqFull * 60);

    // Best word-level matches
    for (const tw of targetWords) {
      if (tw === sw) return 80;
      if (tw.startsWith(sw)) totalScore = Math.max(totalScore, 70);
      if (tw.includes(sw)) totalScore = Math.max(totalScore, 60);

      const subseq = subsequenceScore(sw, tw);
      if (subseq > 0.5) totalScore = Math.max(totalScore, subseq * 55);

      // Edit distance — only worthwhile for similar-length words
      if (Math.abs(sw.length - tw.length) <= 3) {
        const sim = editSimilarity(sw, tw);
        if (sim >= 0.5) totalScore = Math.max(totalScore, sim * 65);
      }
    }

    // Sliding-window substring similarity across full target
    if (totalScore < 40 && ns.length >= 3) {
      const bss = bestSubstringSimilarity(ns, nt);
      if (bss >= 0.6) totalScore = Math.max(totalScore, bss * 50);
    }

    return Math.round(totalScore);
  }

  // Multi-word search: each search word must match something
  let matchedWords = 0;
  let wordScoreSum = 0;

  for (const sw of searchWords) {
    let bestWordScore = 0;

    for (const tw of targetWords) {
      if (tw === sw) { bestWordScore = Math.max(bestWordScore, 20); break; }
      if (tw.startsWith(sw)) bestWordScore = Math.max(bestWordScore, 16);
      else if (tw.includes(sw)) bestWordScore = Math.max(bestWordScore, 12);
      else {
        const subseq = subsequenceScore(sw, tw);
        if (subseq > 0.5) bestWordScore = Math.max(bestWordScore, 10);

        if (Math.abs(sw.length - tw.length) <= 3) {
          const sim = editSimilarity(sw, tw);
          if (sim >= 0.5) bestWordScore = Math.max(bestWordScore, sim * 14);
        }
      }
    }

    if (bestWordScore === 0 && nt.includes(sw)) bestWordScore = 5;

    if (bestWordScore > 0) matchedWords++;
    wordScoreSum += bestWordScore;
  }

  if (matchedWords === searchWords.length) wordScoreSum += 20;
  else if (matchedWords === 0) return 0;

  return Math.round(wordScoreSum);
}

// ─── High-level search helpers ──────────────────────────

export function searchProducts<T extends { nombre: string; sku: string; categoria?: string | null }>(
  products: T[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return products;
  return products
    .map(p => ({ p, score: fuzzySearch(searchTerm, p.nombre) * 2 + fuzzySearch(searchTerm, p.sku) * 1.5 + (p.categoria ? fuzzySearch(searchTerm, p.categoria) : 0) }))
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(i => i.p);
}

export function searchCustomers<T extends { nombre: string; telefono?: string | null; zona?: string | null; ciudad?: string | null }>(
  customers: T[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return customers;
  return customers
    .map(c => ({ c, score: fuzzySearch(searchTerm, c.nombre) * 2 + (c.telefono ? fuzzySearch(searchTerm, c.telefono) * 1.5 : 0) + (c.zona ? fuzzySearch(searchTerm, c.zona) : 0) + (c.ciudad ? fuzzySearch(searchTerm, c.ciudad) : 0) }))
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(i => i.c);
}

/**
 * Generic fuzzy search over any list of items.
 * `fields` is a list of {key, weight} to search across.
 * Returns items sorted by relevance.
 */
export function searchItems<T>(
  items: T[],
  searchTerm: string,
  fields: { key: keyof T; weight?: number }[]
): T[] {
  if (!searchTerm.trim()) return items;
  return items
    .map(item => {
      let score = 0;
      for (const f of fields) {
        const val = item[f.key];
        if (typeof val === 'string' && val) {
          score += fuzzySearch(searchTerm, val) * (f.weight ?? 1);
        }
      }
      return { item, score };
    })
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(i => i.item);
}
