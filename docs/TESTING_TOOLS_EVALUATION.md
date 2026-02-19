# Testing Tools Evaluation for Memory System

## Overview

We need to test:
1. **Memory Accuracy/Meaningfulness** - Does the system retain important information correctly?
2. **Memory Retention** - Are facts preserved appropriately over time?
3. **Compression Performance** - How fast is the working memory → long-term memory conversion?
4. **Embedding Quality** - Are semantic similarities detected correctly?

---

## 1. Unit Testing Frameworks (TypeScript/Node.js)

### Option A: **Vitest** ⭐ RECOMMENDED

**Pros:**
- ✅ Blazing fast (native ESM, parallel test execution)
- ✅ Jest-compatible API (easy migration)
- ✅ Built-in TypeScript support (no extra config)
- ✅ Watch mode with HMR-like experience
- ✅ Native code coverage (via c8/istanbul)
- ✅ Snapshot testing built-in
- ✅ Modern, actively maintained
- ✅ Works great with monorepos
- ✅ **Works with Next.js apps** (see note below)
- ✅ **Includes benchmark mode** (no extra dependencies)
- ✅ **Fully local** (no cloud services required)

**Cons:**
- ⚠️ Slightly newer (less mature than Jest)

**Next.js Compatibility:**
Vitest works perfectly with Next.js despite Next.js not using Vite for builds. You can test:
- Server-side code (your core-service, API routes)
- Shared utilities and libraries
- React components (with @testing-library/react)

The only limitation is you can't test Next.js-specific build optimizations, but that's fine for unit/integration tests.

**Installation:**
```bash
npm install -D vitest @vitest/ui
```

**Example Test:**
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { embeddingService } from '../services/embedding';

describe('Embedding Service', () => {
  it('should generate consistent embeddings', async () => {
    const text = "User prefers Python for data science";
    const embedding1 = await embeddingService.embed(text);
    const embedding2 = await embeddingService.embed(text);
    
    expect(embedding1).toHaveLength(384);
    expect(embedding1).toEqual(embedding2);
  });
});
```

---

### Option B: **Jest**

**Pros:**
- ✅ Most popular (huge community)
- ✅ Comprehensive documentation
- ✅ Mature and stable
- ✅ Extensive ecosystem

**Cons:**
- ❌ Slower than Vitest
- ❌ ESM support still problematic
- ❌ More configuration needed for TypeScript

**Use Case:** If you need maximum stability and community support.

---

### Option C: **Node Test Runner** (Built-in Node.js)

**Pros:**
- ✅ No dependencies
- ✅ Native to Node.js (v18+)
- ✅ TypeScript support via tsx/ts-node

**Cons:**
- ❌ Limited features (no coverage, snapshots, etc.)
- ❌ Less ergonomic API
- ❌ Minimal tooling

**Use Case:** Minimal projects, avoiding dependencies.

---

## 2. LLM Evaluation & Testing Tools

### Option A: **Braintrust** ⭐ RECOMMENDED FOR LLMOPS

**Website:** https://braintrust.dev

**What it does:**
- End-to-end LLM observability
- Evaluation suite for LLM outputs
- A/B testing for prompts
- Dataset management
- Automatic scoring (relevance, coherence, factual accuracy)

**Pros:**
- ✅ Built specifically for LLM testing
- ✅ TypeScript SDK available
- ✅ Free tier for development
- ✅ Real-time monitoring
- ✅ Experiment tracking
- ✅ Custom scoring functions
- ✅ Integration with OpenAI, Anthropic, etc.

**Cons:**
- ⚠️ Requires cloud service (self-hosted option available)
- ⚠️ Learning curve for advanced features

**Installation:**
```bash
npm install braintrust
```

**Example Usage:**
```typescript
import { Eval } from "braintrust";

Eval("Memory Compression Quality", {
  data: async () => [
    {
      input: "Long conversation about Python",
      expected: "User prefers Python for data science",
    },
  ],
  task: async (input) => {
    // Your compression logic
    return await compressMemory(input);
  },
  scores: [
    {
      name: "factual-accuracy",
      scorer: (args) => {
        // Custom scoring logic
        return semanticSimilarity(args.output, args.expected);
      },
    },
  ],
});
```

---

### Option B: **LangSmith** (from LangChain)

**Website:** https://smith.langchain.com

**What it does:**
- LLM application monitoring
- Tracing and debugging
- Dataset creation and testing
- Evaluation metrics

**Pros:**
- ✅ Deep integration with LangChain
- ✅ Excellent tracing UI
- ✅ Dataset management
- ✅ Prompt playground

**Cons:**
- ❌ Tied to LangChain ecosystem
- ❌ Requires paid plan for teams
- ❌ You're not using LangChain currently

**Use Case:** If you migrate to LangChain.

---

### Option C: **DeepEval by Confident AI** ⭐ RECOMMENDED FOR OPEN-SOURCE

**GitHub:** https://github.com/confident-ai/deepeval
**Website:** https://deepeval.ai

**What it does:**
- Open-source LLM evaluation framework
- 14+ built-in metrics (faithfulness, relevance, coherence, etc.)
- Custom metric creation
- Pytest integration
- **Fully local** - no cloud dependency required
- Optional web UI (self-hosted or cloud)

**Pros:**
- ✅ **100% open-source** (Apache 2.0 license)
- ✅ **Runs completely locally** - no external services needed
- ✅ Built-in LLM-as-a-judge metrics
- ✅ Pytest-style API (familiar)
- ✅ Supports all LLM providers
- ✅ Built-in benchmarking datasets
- ✅ Can use your own LLM for evaluation (cost-effective)
- ✅ **CI/CD friendly** - perfect for GitHub Actions
- ✅ TypeScript/Python support

**Cons:**
- ⚠️ Python-based (but can test TypeScript services via API)
- ⚠️ Slightly newer than OpenAI Evals

**Installation:**
```bash
pip install deepeval
# or if you want the optional UI
pip install deepeval[ui]
```

**Example Usage:**
```python
from deepeval import assert_test
from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric
from deepeval.test_case import LLMTestCase

def test_memory_compression():
    metric = FaithfulnessMetric(threshold=0.7)
    
    test_case = LLMTestCase(
        input="Long conversation about Python programming",
        actual_output="User prefers Python for data science",
        retrieval_context=["User discussed Python", "Mentioned data science"]
    )
    
    assert_test(test_case, [metric])
```

**Why DeepEval is Perfect for Your Use Case:**
- No cloud dependency (fully local)
- Runs in CI/CD with zero configuration
- Custom metrics for memory-specific evaluation
- Can evaluate using embeddings you already have

---

### Option D: **OpenAI Evals**

**GitHub:** https://github.com/openai/evals

**What it does:**
- Framework for evaluating LLM outputs
- Pre-built evaluation templates
- Custom eval creation

**Pros:**
- ✅ Open source
- ✅ No external service required
- ✅ Good for OpenAI models

**Cons:**
- ❌ OpenAI-focused
- ❌ Less polished than commercial tools
- ❌ Requires more manual setup

---

### Option D: **PromptLayer**

**Website:** https://promptlayer.com

**What it does:**
- Prompt management and versioning
- LLM request logging
- A/B testing

**Pros:**
- ✅ Simple to integrate
- ✅ Visual prompt editor
- ✅ Good analytics

**Cons:**
- ❌ Less focused on evaluation
- ❌ More about logging/monitoring

---

### Option E: **WhyLabs** (LangKit)

**Website:** https://whylabs.ai/langkit

**What it does:**
- LLM monitoring and guardrails
- Quality metrics
- Security scanning

**Pros:**
- ✅ Focus on safety and quality
- ✅ Good metrics dashboard

**Cons:**
- ❌ Enterprise-focused
- ❌ Heavier weight solution

---

## 3. Embedding & Similarity Testing Tools

### Option A: **Custom Similarity Tests** ⭐ RECOMMENDED

Since you're using `@xenova/transformers`, you can write custom tests:

```typescript
describe('Semantic Similarity', () => {
  const testCases = [
    {
      text1: "User prefers Python",
      text2: "User likes Python programming",
      expectedSimilarity: 0.85, // High similarity
    },
    {
      text1: "User lives in Sydney",
      text2: "User prefers Python",
      expectedSimilarity: 0.2, // Low similarity
    },
  ];

  it.each(testCases)('should calculate correct similarity', async ({ text1, text2, expectedSimilarity }) => {
    const similarity = await embeddingService.calculateSimilarity(text1, text2);
    expect(similarity).toBeCloseTo(expectedSimilarity, 1);
  });
});
```

---

### Option B: **Weights & Biases (W&B)**

**Website:** https://wandb.ai

**What it does:**
- ML experiment tracking
- Model versioning
- Embedding visualization (UMAP/t-SNE)

**Pros:**
- ✅ Excellent for ML workflows
- ✅ Embedding visualization
- ✅ Experiment tracking

**Cons:**
- ❌ Overkill for simple embedding tests
- ❌ Requires cloud service

**Use Case:** If you need to visualize and compare embeddings.

---

## 4. Performance Testing Tools

### Option A: **Vitest Benchmark** ⭐ RECOMMENDED

**Built into Vitest:**
```typescript
import { bench, describe } from 'vitest';
import { longTermMemory } from '../services/longTermMemory';

describe('Memory Compression Performance', () => {
  bench('compress 5 new facts with 20 existing', async () => {
    await longTermMemory.extractAndMergeKeyFacts(
      existingFacts,
      workingMemory,
      coreContext
    );
  });
  
  bench('compress 5 new facts with 50 existing', async () => {
    await longTermMemory.extractAndMergeKeyFacts(
      largeExistingFacts,
      workingMemory,
      coreContext
    );
  });
});
```

**Run with:** `vitest bench`

---

### Option B: **Benchmark.js**

**GitHub:** https://benchmarkjs.com

**Pros:**
- ✅ Very accurate benchmarking
- ✅ Statistical analysis
- ✅ Mature library

**Cons:**
- ❌ Older API style
- ❌ Separate tool (not integrated)

---

### Option C: **Clinic.js**

**Website:** https://clinicjs.org

**What it does:**
- Performance profiling for Node.js
- Flame graphs
- Memory leak detection

**Pros:**
- ✅ Deep Node.js insights
- ✅ Visual profiling

**Cons:**
- ❌ More for profiling than benchmarking
- ❌ Separate workflow

**Use Case:** When you need to debug performance issues.

---

## 5. Memory Quality Evaluation

### Why No Off-the-Shelf Memory Evaluation Frameworks?

**Short Answer:** Memory systems are domain-specific, so no general framework exists.

**Detailed Explanation:**

1. **Memory is application-specific**
   - Your hierarchical memory (core context + working memory + key facts) is unique
   - Generic frameworks can't understand your fact confidence system
   - Temporal decay, fact merging, and semantic deduplication are custom logic

2. **Existing frameworks focus on different problems**
   - DeepEval/OpenAI Evals: Evaluate LLM responses (faithfulness, relevance)
   - RAG frameworks: Test retrieval quality
   - None test "did my memory system retain the right information over time?"

3. **Your memory system needs custom metrics**
   - **Retention**: Did we keep facts user explicitly stated?
   - **Relevance**: Are stored facts relevant to the topic?
   - **Consistency**: Do facts contradict each other?
   - **Compression efficiency**: Did we reduce redundancy?
   - **Performance**: How fast is compression?

4. **Good news: Easy to build**
   - You have embeddings for semantic similarity
   - Simple comparisons against ground truth datasets
   - Integration with Vitest makes it seamless

### Custom Evaluation Framework ⭐ RECOMMENDED

Build a custom evaluation system for memory quality:

```typescript
interface MemoryEvaluation {
  retention: number;      // 0-1: Did we keep important facts?
  relevance: number;      // 0-1: Are facts relevant to topic?
  consistency: number;    // 0-1: Are facts consistent with each other?
  compression: number;    // 0-1: Did we reduce redundancy?
  performance: number;    // ms: How long did compression take?
}

class MemoryEvaluator {
  async evaluate(
    input: Conversation,
    expectedFacts: string[],
  ): Promise<MemoryEvaluation> {
    const startTime = Date.now();
    
    // Run compression
    const result = await compressMemory(input);
    
    // Calculate metrics
    return {
      retention: this.calculateRetention(result.facts, expectedFacts),
      relevance: this.calculateRelevance(result.facts, input.topic),
      consistency: this.calculateConsistency(result.facts),
      compression: this.calculateCompressionRatio(input, result),
      performance: Date.now() - startTime,
    };
  }
}
```

---

## Recommended Stack

### Option 1: Fully Open-Source & Local ⭐ RECOMMENDED FOR CI/CD

```
┌─────────────────────────────────────────────┐
│     Open-Source Testing Architecture        │
├─────────────────────────────────────────────┤
│                                             │
│  Unit Tests          → Vitest               │
│  Performance Tests   → Vitest Bench         │
│  LLM Evaluation      → DeepEval             │
│  Custom Memory Evals → Custom Framework     │
│  Coverage            → Vitest (c8)          │
│                                             │
│  ✅ 100% Open Source                        │
│  ✅ No Cloud Dependencies                   │
│  ✅ CI/CD Friendly                          │
│  ✅ Fully Local                             │
│                                             │
└─────────────────────────────────────────────┘
```

**Why This Stack?**
1. **Vitest** - Fast, modern, includes benchmarking, zero config for TS
2. **DeepEval** - Open-source LLM evaluation, runs locally, CI-friendly
3. **Custom Framework** - Domain-specific memory quality metrics

**Perfect for:**
- ✅ Running tests locally without internet
- ✅ GitHub Actions workflows
- ✅ No cloud service dependencies
- ✅ Cost-effective (no API costs for evaluation)
- ✅ Full control over data and privacy

---

### Option 2: Enhanced with Cloud Features (Optional)

```
┌─────────────────────────────────────────────┐
│    Cloud-Enhanced Testing Architecture      │
├─────────────────────────────────────────────┤
│                                             │
│  Unit Tests          → Vitest               │
│  Performance Tests   → Vitest Bench         │
│  LLM Evaluation      → Braintrust           │
│  Custom Memory Evals → Custom Framework     │
│  Coverage            → Vitest (c8)          │
│                                             │
│  ⚠️ Requires Cloud Service                  │
│  ✅ Better Visualization                    │
│  ✅ Team Collaboration                      │
│                                             │
└─────────────────────────────────────────────┘
```

**Why This Stack?**
1. **Vitest** - Same as Option 1
2. **Braintrust** - Best-in-class LLM evaluation with visualization
3. **Custom Framework** - Same as Option 1

**Perfect for:**
- Teams needing collaboration
- Advanced visualization needs
- When you can use cloud services

---

## Implementation Priority

### Phase 1: Core Testing (Week 1)
- [x] Set up Vitest
- [ ] Unit tests for embedding service
- [ ] Unit tests for similarity calculation
- [ ] Performance benchmarks for compression

### Phase 2: Memory Quality (Week 2)
- [ ] Build custom memory evaluator
- [ ] Create test datasets (conversation → expected facts)
- [ ] Measure retention, relevance, consistency

### Phase 3: LLMOps Integration (Week 3)
- [ ] Set up Braintrust
- [ ] Create evaluation suites
- [ ] Monitor fact extraction quality
- [ ] A/B test compression prompts

---

## Comparison Matrix

### Unit Testing Frameworks
| Feature | Vitest ⭐ | Jest | Node Test Runner |
|---------|---------|------|------------------|
| **Speed** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **TypeScript** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Benchmarking** | ✅ Built-in | ❌ | ❌ |
| **Coverage** | ✅ Built-in | ✅ | ❌ |
| **Next.js Compatible** | ✅ | ✅ | ✅ |
| **Cloud Dependency** | ❌ None | ❌ None | ❌ None |
| **CI/CD Friendly** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

### LLM Evaluation Tools
| Feature | DeepEval ⭐ | Braintrust | OpenAI Evals |
|---------|-----------|------------|--------------|
| **Open Source** | ✅ Apache 2.0 | ⚠️ Freemium | ✅ MIT |
| **Cloud Dependency** | ❌ None | ⚠️ Optional | ❌ None |
| **Local Execution** | ✅ | ⚠️ Limited | ✅ |
| **LLM Metrics** | ⭐⭐⭐⭐⭐ (14+) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Custom Metrics** | ✅ | ✅ | ✅ |
| **CI/CD Friendly** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **TypeScript** | ⚠️ Python | ⭐⭐⭐⭐⭐ | ⚠️ Python |
| **Cost** | Free | Free tier | Free |
| **Learning Curve** | Low | Medium | High |
| **GitHub Actions** | ✅ Perfect | ⚠️ Needs setup | ⚠️ Manual |

---

## Example Test Structure

```
apps/core-service/
  src/
    services/
      embedding.ts
      memory.ts
      longTermMemory.ts
  tests/
    unit/
      embedding.test.ts        # Vitest
      memory.test.ts           # Vitest
      similarity.test.ts       # Vitest
    benchmark/
      compression.bench.ts     # Vitest Bench
      embedding.bench.ts       # Vitest Bench
    evaluation/
      memory-quality.eval.ts   # Custom + Braintrust
      fact-retention.eval.ts   # Custom + Braintrust
    fixtures/
      conversations.json       # Test data
      expected-facts.json      # Ground truth
```

---

## Next Steps

1. **Decision**: Choose testing stack (recommended: Vitest + Braintrust + Custom)
2. **Setup**: Install tools and configure
3. **Create Tests**: Start with unit tests, then add evaluations
4. **CI Integration**: Add to GitHub Actions or CI/CD pipeline

Would you like me to proceed with implementing this recommended stack?
