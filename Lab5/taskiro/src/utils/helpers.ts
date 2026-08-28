/**
 * Funções utilitárias compartilhadas.
 */

/**
 * Formata uma data no padrão DD/MM/YYYY.
 *
 * @param date - A data a ser formatada.
 * @returns A data formatada como "DD/MM/YYYY".
 * @throws {TypeError} Se `date` não for um Date válido.
 */
export function formatDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('formatDate espera um objeto Date válido.');
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).padStart(4, '0');

  return `${day}/${month}/${year}`;
}
