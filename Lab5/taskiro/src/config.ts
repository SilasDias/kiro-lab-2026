/**
 * Configuração da aplicação.
 * Valores sensíveis são lidos de variáveis de ambiente, nunca hardcoded.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Variável de ambiente ausente: ${name}. Defina-a no seu ambiente ou em um arquivo .env.`,
    );
  }
  return value;
}

export const config = {
  apiKey: requireEnv('API_KEY'),
} as const;

export const { apiKey } = config;
