import { pipeline } from '@xenova/transformers';

/**
 * Local embedding service using @xenova/transformers
 * Provides fast, free semantic embeddings without API calls
 */
export class EmbeddingService {
  private extractor: any = null;
  private initPromise: Promise<void> | null = null;
  private readonly MODEL = 'Xenova/all-MiniLM-L6-v2';

  /**
   * Initialize the embedding model (lazy loading)
   * Safe to call multiple times - will only initialize once
   */
  async initialize(): Promise<void> {
    if (this.extractor) {
      return; // Already initialized
    }

    if (this.initPromise) {
      return this.initPromise; // Initialization in progress
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    console.log('[EmbeddingService] Initializing model:', this.MODEL);
    const startTime = Date.now();
    
    try {
      this.extractor = await pipeline(
        'feature-extraction',
        this.MODEL,
        { quantized: true } // Optimize for speed/size
      );
      
      const elapsed = Date.now() - startTime;
      console.log(`[EmbeddingService] Model initialized in ${elapsed}ms`);
    } catch (error) {
      console.error('[EmbeddingService] Failed to initialize model:', error);
      this.initPromise = null; // Allow retry
      throw error;
    }
  }

  /**
   * Generate embedding for a text string
   * Returns a normalized vector (384 dimensions for MiniLM-L6-v2)
   */
  async embed(text: string): Promise<number[]> {
    await this.initialize();
    
    if (!this.extractor) {
      throw new Error('Embedding model not initialized');
    }

    try {
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true
      });
      
      return Array.from(output.data);
    } catch (error) {
      console.error('[EmbeddingService] Error generating embedding:', error);
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embedding vectors
   * Returns a value between 0 (unrelated) and 1 (identical)
   * 
   * Note: Assumes vectors are already normalized (which embed() does)
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error(`Embedding dimensions don't match: ${embedding1.length} vs ${embedding2.length}`);
    }

    // For normalized vectors, cosine similarity is just the dot product
    let dotProduct = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
    }

    // Clamp to [0, 1] range to handle floating point errors
    return Math.max(0, Math.min(1, dotProduct));
  }

  /**
   * Calculate semantic similarity between two text strings
   * Returns a value between 0 (unrelated) and 1 (identical)
   */
  async calculateSimilarity(text1: string, text2: string): Promise<number> {
    const [embedding1, embedding2] = await Promise.all([
      this.embed(text1),
      this.embed(text2)
    ]);

    return this.cosineSimilarity(embedding1, embedding2);
  }

  /**
   * Batch embed multiple texts efficiently
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    await this.initialize();
    
    if (!this.extractor) {
      throw new Error('Embedding model not initialized');
    }

    // Process in batches to avoid memory issues
    const BATCH_SIZE = 10;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const embeddings = await Promise.all(
        batch.map(text => this.embed(text))
      );
      results.push(...embeddings);
    }

    return results;
  }
}

// Singleton instance
export const embeddingService = new EmbeddingService();
