# Core Service Tests

Comprehensive test suite for the memory system, focusing on embedding-based fact compression and semantic similarity.

## Test Stack

- **Vitest** — Fast unit testing framework with built-in benchmarking
- **@xenova/transformers** — Local embeddings (MiniLM-L6-v2, runs offline)
- **vi.spyOn** — Mock isolation without module hoisting side-effects
- **100% Open Source** — No cloud dependencies for unit tests

## Test Structure

```
tests/
├── unit/                                          # Always run, no API keys needed
│   ├── embedding.test.ts                          # Embedding service (19 tests)
│   ├── longTermMemory.test.ts                     # Fact management & merge pipeline (22 tests)
│   └── memory.test.ts                             # HierarchicalMemoryManager orchestration (25 tests)
├── evaluation/                                    # Always run, no API keys needed
│   ├── memoryEvaluator.ts                         # MemoryEvaluator class (retention/relevance/consistency/compression)
│   └── memory-quality.eval.ts                     # Evaluator unit tests (13 tests)
├── integration/                                   # Requires a live LLM API key (skipped silently without one)
│   ├── longTermMemory.integration.test.ts         # End-to-end fact extraction (6 tests)
│   └── memory-quality.integration.test.ts         # Quality gate tests using MemoryEvaluator (3 tests)
├── benchmark/                                     # Performance timing data
│   └── compression.bench.ts                       # All layers benchmarked (20 benches)
├── fixtures/
│   └── test-data.ts                              # mockFacts, conversationScenarios, similarTextPairs
└── tsconfig.json                                  # Tests-specific TS config (noEmit, rootDir fix)
```

## Running Tests

```bash
cd apps/core-service

# Unit tests (watch mode)
npm test

# Unit tests once — what CI runs
npm run test:run

# Integration tests — requires at least one LLM API key env var
ANTHROPIC_API_KEY=sk-... npm run test:integration

# UI explorer
npm run test:ui

# Coverage report
npm run test:coverage

# Benchmarks once
npm run bench:run

# Benchmarks + save JSON results
npm run bench:report
```

## Test Coverage

### Unit + Evaluation Tests — 79 tests, ~1.2 seconds, no network

#### Embedding Service (`embedding.test.ts`) — 19 tests
| Area | What's tested |
|------|--------------|
| Initialization | Model loads without error |
| Dimensions | All embeddings are 384-dimensional (MiniLM-L6-v2) |
| Determinism | Same text → identical embedding every run |
| Cosine similarity | Identical vectors → 1.0; mismatched dimensions → throws |
| Semantic accuracy | 4 parameterised text-pair cases from `similarTextPairs` fixture |
| Batch processing | Empty array, 3-item array, 25-item array |
| Edge cases | Empty string, 1000-word text |

#### Long-Term Memory (`longTermMemory.test.ts`) — 22 tests
| Area | What's tested |
|------|--------------|
| Similarity | Similar phrasing scores >0.7; unrelated scores <0.5 |
| Confidence: USER_CONFIRMED | +0.3, capped at 1.0 |
| Confidence: MENTIONED_AGAIN | +0.1 |
| Confidence: CONTRADICTED | -0.4, floor at 0.1 |
| Confidence: TIME_DECAY | 0.95^weeks formula; uses `lastConfirmedAt` when present |
| Confidence: NEW FACT | Zero elapsed time → no decay |
| lastConfirmedAt field | Only set by USER_CONFIRMED, not by other events |
| Pruning | Threshold filtering, descending sort, MAX_FACTS (50) cap |
| Pruning edge cases | All below threshold → empty array; empty input → empty array |
| Merge pipeline (mocked) | Valid KeyFact shape, near-duplicate merged not duplicated |
| LLM resilience (mocked) | Malformed JSON → graceful fallback, existing facts preserved |
| Embedding caching | Cached cosine similarity < 10ms |

#### Memory Manager (`memory.test.ts`) — 25 tests
| Area | What's tested |
|------|--------------|
| initializeMemory | Core context, zero counters, fact from description, empty/whitespace |
| shouldCompress | 0 msgs (no), 2 msgs (no), 3 msgs (yes), 17k chars (yes), post-summary (no) |
| addMessage | Count increment, User/Assistant format, no assistant without response, accumulation below threshold, compression triggered via spy |
| getContext | Core context present, working memory present, high-confidence facts shown, <0.3 facts hidden, sorted by confidence, capped at 10, recent messages appended, capped at 5 |

#### MemoryEvaluator (`evaluation/memory-quality.eval.ts`) — 13 tests
| Area | What's tested |
|------|--------------|
| Retention: match | Two semantically similar facts → score > 0.7 |
| Retention: no facts | 0 extracted, expected facts present → 0.0 |
| Retention: no expected | Empty expected list → 1.0 |
| Relevance: on vs off topic | ML fact scores higher than beach fact against ML context |
| Relevance: no facts | 0 extracted → 0.0 |
| Consistency: single fact | 1 fact, no pairs → 1.0 |
| Consistency: all distinct | 3 different-topic facts → 1.0 |
| Consistency: near-duplicate | Two identical facts → < 1.0 |
| Compression ratio: compressed | ~350 char input, 16 char output → ratio > 5 |
| Compression ratio: no facts | No facts → 1.0 (no change) |
| checkThresholds: all pass | All scores above threshold → no failures |
| checkThresholds: all fail | All scores below threshold → 4 failure messages |
| checkThresholds: custom override | Custom thresholds respected per-metric |

---

### Integration Tests — requires live LLM (`tests/integration/`)

Run automatically in CI when an API key secret is present. Skipped silently otherwise.

**To enable locally:**
```bash
ANTHROPIC_API_KEY=sk-... npm run test:integration
# or OPENAI_API_KEY, or GOOGLE_API_KEY — any one works
```

**To enable in CI:** Add any key to *GitHub → Settings → Secrets → Actions*.

| Test | What it validates |
|------|------------------|
| Real fact extraction | LLM extracts ML-relevant facts from `mockWorkingMemory` |
| Deduplication | Near-duplicate Python facts merged when existing fact has embedding |
| Pruning applied | All returned facts > 0.2 confidence, count ≤ 50 |
| **Fact retention — per scenario** | `conversationScenarios` fixture: Python and location conversations each capture at least one expected key concept |
| Conversation length | Longer conversation → at least as many facts as shorter version |
| Topic specificity | Python conversation → programming terms; location conversation → location terms |

---

### Benchmarks (`compression.bench.ts`) — 20 benches

Benchmarks are **timing data, not pass/fail**. Results saved as artifacts per commit SHA in CI for trend analysis (90-day retention).

| Group | Benches |
|-------|---------|
| Embedding Generation | Single, 5-batch, 10-batch |
| Similarity Calculation | Cached cosine, fresh similarity with embedding |
| Fact Comparison | 5 vs 20 cached, 5 vs 50 cached |
| Confidence Updates | Single fact decay, 50 facts decay |
| Fact Pruning | 20 facts, 60 facts (triggers MAX_FACTS cap) |
| **Memory Manager** | initializeMemory, shouldCompress (×2), addMessage, getContext (×3 sizes) |
| Full Workflow | Embed 5 facts, compare 5 vs 20 end-to-end |

**Baseline numbers from local machine:**

| Operation | Speed |
|-----------|-------|
| Single embedding | ~14ms |
| Cosine similarity (cached) | <1ms |
| 5 vs 20 full comparison | ~80ms |
| addMessage (no compression) | <1ms |
| getContext (50 facts) | <1ms |
| Prune 20 facts | ~7µs |
| Prune 60 facts (capped) | ~0.5ms |

---

## How Tests Protect Against Regressions

| Change | Caught by |
|--------|-----------|
| Swap embedding model | Dimension test (384), semantic pair tests |
| Change similarity threshold (0.75) | Merge detection test in unit + integration |
| Change confidence arithmetic | 11 confidence event tests |
| Change shouldCompress thresholds | 5 boundary tests |
| Change getContext filtering/sorting | 8 context shape tests |
| Change addMessage format | 5 working memory tests |
| LLM returns malformed JSON | Graceful fallback test |
| MAX_FACTS cap changed | Pruning limit test |
| Performance regression | Benchmark artifact comparison across PRs |
| End-to-end extraction quality drops | Integration fact retention tests (with API key) |

---

## Writing New Tests

### Unit test (mocking the LLM)

```typescript
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';
import * as llmModule from '../../src/services/llm';
import { embeddingService } from '../../src/services/embedding';

describe('Your Feature', () => {
  beforeAll(async () => {
    await embeddingService.initialize();
  }, 60000);

  afterEach(() => { vi.restoreAllMocks(); });

  it('should handle LLM response', async () => {
    vi.spyOn(llmModule.llmService, 'generateCompletion').mockResolvedValue({
      content: JSON.stringify([{ content: 'Test fact', confidence: 0.7, ... }]),
    });

    const result = await yourFunction();
    expect(result).toEqual(expected);
  });
});
```

**Important:** Always use `vi.spyOn` on the singleton rather than `vi.mock()` inside a test body. `vi.mock()` is hoisted to module scope by Vitest and will pollute subsequent tests in the same file.

### Integration test

Add tests to `tests/integration/` and gate with `describe.skipIf(!hasLLMApiKey)`. They skip automatically in environments without an API key.

### Benchmark

```typescript
bench('your operation', async () => {
  await yourExpensiveOperation();
});
```

---

## First-Run Note

The embedding model (~23 MB) is downloaded on first run and cached:
- Windows: `%LOCALAPPDATA%\transformers\cache`
- Linux/Mac: `~/.cache/huggingface/transformers`

**First run:** 30–60 seconds. **Subsequent runs:** instant.
