import * as crypto from 'crypto';

const TOTP_STEP = 3600; // segundos por janela (1 hora)
const TOTP_DIGITS = 6; // caracteres alfanuméricos (base36: 0-9, A-Z)

/**
 * Gera um secret aleatório de 20 bytes (hexadecimal) para ser salvo no banco.
 */
export function generateTotpSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

/**
 * Calcula o índice da janela TOTP atual (ou com offset).
 */
export function getTotpWindow(offsetWindows: number = 0): number {
  return Math.floor(Date.now() / 1000 / TOTP_STEP) + offsetWindows;
}

/**
 * Gera o código TOTP alfanumérico (base36) para um dado secret e janela de tempo.
 * Implementação do RFC 6238 / HOTP (RFC 4226) usando HMAC-SHA1.
 * O resultado usa caracteres 0-9 e A-Z (base36) para facilitar digitação.
 *
 * @param secret  Hex string de 20 bytes armazenada no banco
 * @param window  Índice da janela (padrão: janela atual)
 */
export function generateTotpCode(secret: string, window?: number): string {
  const counter = window ?? getTotpWindow();

  // Counter como buffer de 8 bytes big-endian
  const counterBuffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  counterBuffer.writeUInt32BE(high, 0);
  counterBuffer.writeUInt32BE(low, 4);

  // HMAC-SHA1
  const hmac = crypto.createHmac('sha1', Buffer.from(secret, 'hex'));
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = digest[digest.length - 1] & 0x0f;
  const code =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  // Converte para base36 (0-9, A-Z) em vez de decimal puro
  return (code % Math.pow(36, TOTP_DIGITS))
    .toString(36)
    .padStart(TOTP_DIGITS, '0')
    .toUpperCase();
}

/**
 * Verifica se um código (case-insensitive) é válido para o secret dado.
 * Aceita a janela atual e a janela anterior (tolerância de 1 janela = 2 horas).
 *
 * @returns índice da janela que validou, ou null se inválido
 */
export function verifyTotpCode(token: string, secret: string): number | null {
  const normalized = token.toUpperCase();
  for (const offset of [0, -1]) {
    const window = getTotpWindow(offset);
    const generatedCode = generateTotpCode(secret, window);
    try {
      const isMatch = crypto.timingSafeEqual(
        Buffer.from(generatedCode),
        Buffer.from(normalized),
      );
      if (isMatch) return window;
    } catch {
      // Tokens with different lengths will throw, fallback to string comparison
      if (generatedCode === normalized) return window;
    }
  }
  return null;
}

/**
 * Retorna quantos segundos faltam para a próxima janela TOTP.
 */
export function secondsUntilNextWindow(): number {
  return TOTP_STEP - (Math.floor(Date.now() / 1000) % TOTP_STEP);
}
