// =====================================================
// BÚSQUEDA ROBUSTA DE TEXTO
// =====================================================

/**
 * Normaliza un texto quitando tildes y caracteres especiales
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Divide el texto en palabras normalizadas
 */
function getSearchWords(text: string): string[] {
  return normalizeText(text).split(/\s+/).filter(w => w.length > 0);
}

/**
 * Búsqueda robusta que:
 * - Ignora tildes/acentos
 * - Busca palabras en cualquier orden
 * - Busca coincidencias parciales
 * - Prioriza coincidencias exactas
 */
export function fuzzySearch(searchTerm: string, targetText: string): number {
  if (!searchTerm || !targetText) return 0;
  
  const normalizedSearch = normalizeText(searchTerm);
  const normalizedTarget = normalizeText(targetText);
  
  // Coincidencia exacta (normalizada) = puntuación máxima
  if (normalizedTarget === normalizedSearch) return 100;
  
  // Contiene el término completo
  if (normalizedTarget.includes(normalizedSearch)) return 80;
  
  // Búsqueda por palabras
  const searchWords = getSearchWords(searchTerm);
  const targetWords = getSearchWords(targetText);
  
  if (searchWords.length === 0) return 0;
  
  let matchScore = 0;
  let matchedWords = 0;
  
  for (const searchWord of searchWords) {
    // Coincidencia exacta de palabra
    if (targetWords.includes(searchWord)) {
      matchScore += 20;
      matchedWords++;
      continue;
    }
    
    // Coincidencia parcial (palabra contiene búsqueda o viceversa)
    let partialMatch = false;
    for (const targetWord of targetWords) {
      if (targetWord.includes(searchWord) || searchWord.includes(targetWord)) {
        matchScore += 10;
        matchedWords++;
        partialMatch = true;
        break;
      }
      // Coincidencia al inicio de palabra (más relevante)
      if (targetWord.startsWith(searchWord)) {
        matchScore += 15;
        matchedWords++;
        partialMatch = true;
        break;
      }
    }
    
    if (!partialMatch && normalizedTarget.includes(searchWord)) {
      matchScore += 5;
      matchedWords++;
    }
  }
  
  // Bonus si todas las palabras coinciden
  if (matchedWords === searchWords.length) matchScore += 20;
  
  return matchScore;
}

/**
 * Filtra y ordena productos por relevancia de búsqueda
 * Ignora tildes/acentos, busca en cualquier orden de palabras
 */
export function searchProducts<T extends { nombre: string; sku: string; categoria?: string | null }>(
  products: T[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return products;
  
  return products
    .map(product => ({
      product,
      score: fuzzySearch(searchTerm, product.nombre) * 2 +
             fuzzySearch(searchTerm, product.sku) * 1.5 +
             (product.categoria ? fuzzySearch(searchTerm, product.categoria) : 0)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);
}

/**
 * Filtra clientes por relevancia de búsqueda
 * Ignora tildes/acentos, busca en cualquier orden de palabras
 */
export function searchCustomers<T extends { nombre: string; telefono?: string | null; zona?: string | null; ciudad?: string | null }>(
  customers: T[],
  searchTerm: string
): T[] {
  if (!searchTerm.trim()) return customers;
  
  return customers
    .map(customer => ({
      customer,
      score: fuzzySearch(searchTerm, customer.nombre) * 2 +
             (customer.telefono ? fuzzySearch(searchTerm, customer.telefono) * 1.5 : 0) +
             (customer.zona ? fuzzySearch(searchTerm, customer.zona) : 0) +
             (customer.ciudad ? fuzzySearch(searchTerm, customer.ciudad) : 0)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.customer);
}
