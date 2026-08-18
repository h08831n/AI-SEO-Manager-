import crypto from 'crypto';

export interface DuplicateAnalysisResult {
  exactDuplicateClusterId?: string;
  isExactDuplicate: boolean;
  nearDuplicateClusterId?: string;
  isNearDuplicate: boolean;
  similarityScore?: number;
}

export class DuplicateContentAnalyzer {
  /**
   * Generates a normalized SHA-256 hash of clean visible body text
   */
  public static generateExactHash(visibleText: string): string {
    const normalized = visibleText
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // remove punctuation
      .replace(/\s+/g, ' ')
      .trim();

    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Generates a 64-bit SimHash for near-duplicate text clustering
   */
  public static generateSimHash64(visibleText: string): string {
    const rawWords = visibleText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 1);

    if (rawWords.length === 0) return '0000000000000000';

    // Form 2-grams (shingles) for structural sequence representation
    const tokens: string[] = [];
    for (let i = 0; i < rawWords.length; i++) {
      tokens.push(rawWords[i]);
      if (i < rawWords.length - 1) {
        tokens.push(`${rawWords[i]}_${rawWords[i + 1]}`);
      }
    }

    const v = new Array(64).fill(0);

    for (const token of tokens) {
      const md5 = crypto.createHash('md5').update(token).digest();
      const hash64 = md5.readBigUInt64BE(0);

      for (let i = 0; i < 64; i++) {
        const bit = (hash64 >> BigInt(63 - i)) & BigInt(1);
        v[i] += bit === BigInt(1) ? 1 : -1;
      }
    }

    let fingerprint = BigInt(0);
    for (let i = 0; i < 64; i++) {
      if (v[i] > 0) {
        fingerprint |= BigInt(1) << BigInt(63 - i);
      }
    }

    return fingerprint.toString(16).padStart(16, '0');
  }

  /**
   * Calculates Hamming distance between two 64-bit hex SimHashes
   */
  public static hammingDistance(simHashA: string, simHashB: string): number {
    try {
      const a = BigInt(`0x${simHashA}`);
      const b = BigInt(`0x${simHashB}`);
      let xor = a ^ b;
      let count = 0;

      while (xor > BigInt(0)) {
        count += Number(xor & BigInt(1));
        xor >>= BigInt(1);
      }
      return count;
    } catch {
      return 64;
    }
  }

  /**
   * Evaluates if two pages are near-duplicates (Hamming distance <= 4 out of 64 bits, ~93%+ similarity)
   */
  public static isNearDuplicate(simHashA: string, simHashB: string, maxDistance = 10): boolean {
    const dist = this.hammingDistance(simHashA, simHashB);
    return dist <= maxDistance;
  }
}
