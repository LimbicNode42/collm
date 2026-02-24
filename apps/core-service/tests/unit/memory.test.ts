import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HierarchicalMemoryManager } from '../../src/services/memory';
import { FactSource, KeyFact, Message, MessageStatus, Node, NodeMemory } from '../../src/types/domain';
import { mockFacts, mockCoreContext, mockWorkingMemory } from '../fixtures/test-data';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<NodeMemory> = {}): Node {
  return {
    id: 'node-1',
    topic: 'Machine Learning',
    description: 'A node about ML',
    model: 'claude-sonnet-4-5-20250929',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    memory: {
      coreContext: mockCoreContext,
      workingMemory: '',
      keyFacts: [],
      messageCount: 0,
      lastSummaryAt: 0,
      ...overrides,
    },
  };
}

function makeMessage(content: string): Message {
  return {
    id: `msg-${Date.now()}`,
    content,
    userId: 'user-1',
    nodeId: 'node-1',
    targetNodeVersion: 1,
    status: MessageStatus.ACCEPTED,
    createdAt: new Date(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('HierarchicalMemoryManager', () => {
  let manager: HierarchicalMemoryManager;

  beforeEach(() => {
    manager = new HierarchicalMemoryManager();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── initializeMemory ──────────────────────────────────────────────────────

  describe('initializeMemory', () => {
    it('should create memory with correct core context', () => {
      const memory = manager.initializeMemory('Python', 'A discussion about Python');

      expect(memory.coreContext).toContain('Python');
      expect(memory.coreContext).toContain('A discussion about Python');
    });

    it('should start with zero message count and lastSummaryAt', () => {
      const memory = manager.initializeMemory('Python', 'Test');

      expect(memory.messageCount).toBe(0);
      expect(memory.lastSummaryAt).toBe(0);
    });

    it('should create an initial fact from the description', () => {
      const memory = manager.initializeMemory('Python', 'User is a Python developer');

      expect(memory.keyFacts).toHaveLength(1);
      expect(memory.keyFacts[0].content).toBe('User is a Python developer');
      expect(memory.keyFacts[0].source).toBe(FactSource.USER_STATED);
      expect(memory.keyFacts[0].confidence).toBe(0.9);
    });

    it('should not create an initial fact for empty description', () => {
      const memory = manager.initializeMemory('Python', '');

      expect(memory.keyFacts).toHaveLength(0);
    });

    it('should not create an initial fact for whitespace-only description', () => {
      const memory = manager.initializeMemory('Python', '   ');

      expect(memory.keyFacts).toHaveLength(0);
    });

    it('should initialise working memory mentioning the topic', () => {
      const memory = manager.initializeMemory('Machine Learning', 'Some context');

      expect(memory.workingMemory).toContain('Machine Learning');
    });
  });

  // ── shouldCompress ────────────────────────────────────────────────────────

  describe('shouldCompress', () => {
    it('should not compress fresh memory with 0 messages', () => {
      const memory: NodeMemory = {
        coreContext: mockCoreContext,
        workingMemory: 'Short working memory',
        keyFacts: [],
        messageCount: 0,
        lastSummaryAt: 0,
      };

      expect(manager.shouldCompress(memory)).toBe(false);
    });

    it('should not compress when below the 3-message threshold', () => {
      const memory: NodeMemory = {
        coreContext: mockCoreContext,
        workingMemory: 'Some content',
        keyFacts: [],
        messageCount: 2,
        lastSummaryAt: 0,
      };

      expect(manager.shouldCompress(memory)).toBe(false);
    });

    it('should compress exactly at the 3-message threshold', () => {
      const memory: NodeMemory = {
        coreContext: mockCoreContext,
        workingMemory: 'Some content',
        keyFacts: [],
        messageCount: 3,
        lastSummaryAt: 0,
      };

      expect(manager.shouldCompress(memory)).toBe(true);
    });

    it('should compress when working memory exceeds ~4000-token estimate', () => {
      // ~4 chars per token → 4000 tokens ≈ 16000 chars
      const hugeWorkingMemory = 'x'.repeat(17000);

      const memory: NodeMemory = {
        coreContext: mockCoreContext,
        workingMemory: hugeWorkingMemory,
        keyFacts: [],
        messageCount: 1, // Below message threshold
        lastSummaryAt: 0,
      };

      expect(manager.shouldCompress(memory)).toBe(true);
    });

    it('should not compress when 3 messages were already summarised', () => {
      // messageCount = 5, lastSummaryAt = 3 → only 2 messages since last summary
      const memory: NodeMemory = {
        coreContext: mockCoreContext,
        workingMemory: 'Short',
        keyFacts: [],
        messageCount: 5,
        lastSummaryAt: 3,
      };

      expect(manager.shouldCompress(memory)).toBe(false);
    });
  });

  // ── addMessage ────────────────────────────────────────────────────────────

  describe('addMessage', () => {
    it('should increment message count', async () => {
      const node = makeNode();
      const message = makeMessage('Hello');

      const updated = await manager.addMessage(node, message);

      expect(updated.messageCount).toBe(1);
    });

    it('should append user message to working memory', async () => {
      const node = makeNode();
      const message = makeMessage('Tell me about Python');

      const updated = await manager.addMessage(node, message);

      expect(updated.workingMemory).toContain('Tell me about Python');
      expect(updated.workingMemory).toContain('User:');
    });

    it('should append assistant response to working memory when provided', async () => {
      const node = makeNode();
      const message = makeMessage('What is Python?');

      const updated = await manager.addMessage(node, message, 'Python is a programming language.');

      expect(updated.workingMemory).toContain('User: What is Python?');
      expect(updated.workingMemory).toContain('Assistant: Python is a programming language.');
    });

    it('should not add assistant section when no response provided', async () => {
      const node = makeNode();
      const message = makeMessage('Hello');

      const updated = await manager.addMessage(node, message);

      expect(updated.workingMemory).not.toContain('Assistant:');
    });

    it('should accumulate multiple messages before compression threshold', async () => {
      // Stay below the 3-message threshold so compression doesn't fire
      let node = makeNode();
      node = { ...node, memory: await manager.addMessage(node, makeMessage('Message 1')) };
      const updated = await manager.addMessage(node, makeMessage('Message 2'));

      expect(updated.workingMemory).toContain('Message 1');
      expect(updated.workingMemory).toContain('Message 2');
      expect(updated.messageCount).toBe(2);
    });

    it('should trigger compression when message threshold is reached', async () => {
      // Mock compressMemory to avoid LLM calls while still verifying it's called
      const compressSpy = vi.spyOn(manager, 'compressMemory').mockResolvedValue({
        coreContext: mockCoreContext,
        workingMemory: 'Compressed summary',
        keyFacts: [],
        messageCount: 3,
        lastSummaryAt: 3,
      });

      // Add 2 messages first to get to count 2
      let node = makeNode();
      node = { ...node, memory: await manager.addMessage(node, makeMessage('Msg 1')) };
      node = { ...node, memory: await manager.addMessage(node, makeMessage('Msg 2')) };

      // 3rd message should trigger compression
      await manager.addMessage(node, makeMessage('Msg 3'));

      expect(compressSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ── getContext ────────────────────────────────────────────────────────────

  describe('getContext', () => {
    it('should include core context in output', async () => {
      const node = makeNode({ coreContext: mockCoreContext });

      const context = await manager.getContext(node, []);

      expect(context).toContain(mockCoreContext);
    });

    it('should include working memory in output', async () => {
      const node = makeNode({ workingMemory: mockWorkingMemory });

      const context = await manager.getContext(node, []);

      expect(context).toContain(mockWorkingMemory);
    });

    it('should include high-confidence key facts', async () => {
      const highConfidenceFact: KeyFact = {
        id: 'hc-1',
        content: 'User is a senior engineer',
        confidence: 0.9,
        source: FactSource.USER_STATED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      };

      const node = makeNode({ keyFacts: [highConfidenceFact] });

      const context = await manager.getContext(node, []);

      expect(context).toContain('User is a senior engineer');
    });

    it('should exclude facts with confidence below 0.3', async () => {
      const lowConfidenceFact: KeyFact = {
        id: 'lc-1',
        content: 'User maybe likes Java',
        confidence: 0.2,
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      };

      const node = makeNode({ keyFacts: [lowConfidenceFact] });

      const context = await manager.getContext(node, []);

      expect(context).not.toContain('User maybe likes Java');
    });

    it('should sort facts by confidence (highest first)', async () => {
      const facts: KeyFact[] = [
        {
          id: 'f1',
          content: 'Low confidence fact',
          confidence: 0.4,
          source: FactSource.LLM_INFERRED,
          extractedAt: Date.now(),
          supportingEvidence: [],
        },
        {
          id: 'f2',
          content: 'High confidence fact',
          confidence: 0.95,
          source: FactSource.USER_STATED,
          extractedAt: Date.now(),
          supportingEvidence: [],
        },
      ];

      const node = makeNode({ keyFacts: facts });
      const context = await manager.getContext(node, []);

      const highPos = context.indexOf('High confidence fact');
      const lowPos = context.indexOf('Low confidence fact');

      expect(highPos).toBeLessThan(lowPos);
    });

    it('should cap facts at 10 in the output', async () => {
      const manyFacts: KeyFact[] = Array.from({ length: 15 }, (_, i) => ({
        id: `f-${i}`,
        content: `Fact number ${i} with enough confidence`,
        confidence: 0.5 + (i / 100),
        source: FactSource.LLM_INFERRED,
        extractedAt: Date.now(),
        supportingEvidence: [],
      }));

      const node = makeNode({ keyFacts: manyFacts });
      const context = await manager.getContext(node, []);

      // Count how many "Fact number" lines appear
      const matches = context.match(/Fact number \d+/g) || [];
      expect(matches.length).toBeLessThanOrEqual(10);
    });

    it('should include recent messages when provided', async () => {
      const node = makeNode();
      const recentMessages = [
        makeMessage('What should I focus on today?'),
        makeMessage('Can you explain embeddings?'),
      ];

      const context = await manager.getContext(node, recentMessages);

      expect(context).toContain('What should I focus on today?');
      expect(context).toContain('Can you explain embeddings?');
    });

    it('should cap recent messages at the last 5', async () => {
      const node = makeNode();
      const manyMessages = Array.from({ length: 8 }, (_, i) =>
        makeMessage(`Message ${i}`)
      );

      const context = await manager.getContext(node, manyMessages);

      // First 3 messages should not appear
      expect(context).not.toContain('Message 0');
      expect(context).not.toContain('Message 1');
      expect(context).not.toContain('Message 2');

      // Last 5 should appear
      expect(context).toContain('Message 3');
      expect(context).toContain('Message 7');
    });
  });
});
