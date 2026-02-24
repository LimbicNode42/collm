# Core Service Tests

Comprehensive test suite for the memory system, focusing on embedding-based fact compression and semantic similarity.

## Test Stack

- **Vitest** - Fast unit testing framework with built-in benchmarking
- **@xenova/transformers** - Local embeddings for semantic similarity
- **100% Open Source** - No cloud dependencies, runs locally and in CI/CD

## Test Structure

```
tests/
├── unit/                      # Unit tests
│   ├── embedding.test.ts      # Embedding service tests
│   ├── longTermMemory.test.ts # Long-term memory & fact management
│   └── memory.test.ts         # (TODO) Memory manager tests
├── benchmark/                 # Performance benchmarks
│   └── compression.bench.ts   # Memory compression performance
├── fixtures/                  # Test data
│   └── test-data.ts          # Mock facts and scenarios
└── README.md                 # This file
```

## Running Tests

### Locally

```bash
# Navigate to core-service
cd apps/core-service

# Run all tests (watch mode)
npm test

# Run tests once (CI mode)
npm run test:run

# Run with UI
npm run test:ui

# Run specific test file
npm test embedding

# Run with coverage
npm run test:coverage
```

### Benchmarks

```bash
# Run performance benchmarks (watch mode)
npm run bench

# Run benchmarks once (CI mode)
npm run bench:run
```

### In CI/CD

Tests automatically run on:
- Push to `master`, `main`, or `develop` branches
- Pull requests to these branches
- Only when `apps/core-service/**` files change

See `.github/workflows/test-core-service.yml`

## Test Coverage

### Embedding Service (`embedding.test.ts`)

- ✅ Initialization and model loading
- ✅ Embedding generation (384-dimensional vectors)
- ✅ Consistency (same text → same embedding)
- ✅ Cosine similarity calculation
- ✅ Semantic similarity detection
- ✅ Batch embedding processing
- ✅ Edge cases (empty strings, long texts)

### Long-Term Memory (`longTermMemory.test.ts`)

- ✅ Semantic similarity using embeddings
- ✅ Confidence score updates (user confirmation, time decay, etc.)
- ✅ Fact pruning and sorting
- ✅ MAX_FACTS limit enforcement (50 facts)
- ✅ Embedding caching for performance
- ⚠️  Fact extraction (requires LLM API - skipped in CI)

### Performance Benchmarks (`compression.bench.ts`)

- ⏱️  Embedding generation speed
- ⏱️  Similarity calculation (cached vs fresh)
- ⏱️  Fact comparison at scale (5 new vs 20/50 existing)
- ⏱️  Confidence updates
- ⏱️  Fact pruning performance
- ⏱️  Full compression workflow (without LLM)

## Expected Performance

Based on benchmarks, you should see:

| Operation | Expected Time |
|-----------|--------------|
| Generate single embedding | ~10-30ms |
| Generate 5 embeddings (batch) | ~50-150ms |
| Cosine similarity (cached) | <1ms |
| Compare 5 vs 20 facts (cached) | ~1-5ms |
| Compare 5 vs 50 facts (cached) | ~2-10ms |
| Prune 60 facts to 50 | <5ms |

**Full compression workflow** (without LLM calls):
- With cached embeddings: **<100ms**
- With fresh embedding generation: **~500ms-2s** (first time)

Compare to old system: **2-5 minutes** with 100+ LLM API calls!

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { embeddingService } from '../../src/services/embedding';

describe('Your Feature', () => {
  beforeAll(async () => {
    await embeddingService.initialize();
  }, 60000);

  it('should do something', async () => {
    const result = await yourFunction();
    expect(result).toBe(expected);
  });
});
```

### Benchmark Example

```typescript
import { bench, describe } from 'vitest';

describe('Your Feature Performance', () => {
  bench('operation name', async () => {
    await yourExpensiveOperation();
  });
});
```

## Test Data

### Fixtures (`fixtures/test-data.ts`)

Pre-defined test data includes:
- `mockFacts` - Sample facts with varying confidence
- `mockWorkingMemory` - Example conversation text
- `mockCoreContext` - Topic and context
- `similarTextPairs` - Pairs for similarity testing
- `conversationScenarios` - Full conversation examples

Feel free to add more fixtures as needed!

## Debugging Tests

### Run specific test

```bash
npm test -- embedding
npm test -- longTermMemory
```

### Run with verbose output

```bash
npm test -- --reporter=verbose
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["test"],
  "cwd": "${workspaceFolder}/apps/core-service",
  "console": "integratedTerminal"
}
```

## CI/CD Integration

### GitHub Actions

The workflow `.github/workflows/test-core-service.yml`:
1. Runs on push/PR to main branches
2. Installs dependencies
3. Runs unit tests
4. Runs benchmarks
5. Generates coverage report
6. Uploads coverage as artifact

### Local CI Simulation

```bash
# Simulate CI environment
CI=true npm run test:run
CI=true npm run bench:run
```

## Coverage Reports

After running `npm run test:coverage`:
- **Text**: Printed to console
- **HTML**: `coverage/index.html` - open in browser
- **JSON**: `coverage/coverage-final.json` - for tools

## Known Limitations

### Tests Requiring LLM API

Some tests are marked with `.skip` because they require LLM API calls:

```typescript
it.skip('should extract facts from working memory', async () => {
  // Requires OPENAI_API_KEY or similar
});
```

To run these tests:
1. Set up LLM API keys in environment
2. Remove `.skip` from test
3. Run tests (will incur API costs)

### First Run Performance

The first test run downloads the embedding model (~23 MB):
- **First run**: 30-60 seconds for model download
- **Subsequent runs**: Instant (model cached)

Cache location:
- Windows: `C:\Users\<user>\AppData\Local\transformers\cache`
- Linux/Mac: `~/.cache/huggingface/transformers`

## Troubleshooting

### Model Download Fails

```bash
# Clear cache and retry
rm -rf ~/.cache/huggingface/transformers  # Linux/Mac
# or
Remove-Item -Recurse $env:APPDATA\Local\transformers  # Windows PowerShell

npm test
```

### Tests Timeout

Increase timeout in `vitest.config.ts`:

```typescript
test: {
  testTimeout: 60000, // 60 seconds
}
```

### Out of Memory

The embedding model uses ~200MB RAM. If running many tests in parallel:

```bash
# Run tests sequentially
npm test -- --no-threads
```

## Future Enhancements

- [ ] Memory manager tests (`memory.test.ts`)
- [ ] Integration tests with real LLM API (optional)
- [ ] Custom memory evaluation framework
- [ ] Fact retention accuracy tests
- [ ] Relevance scoring tests
- [ ] Visual regression testing for embeddings

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Xenova/transformers](https://github.com/xenova/transformers.js)
- [Testing Best Practices](../../../docs/TESTING_TOOLS_EVALUATION.md)
