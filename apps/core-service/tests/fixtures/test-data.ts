/**
 * Test fixtures for memory system tests
 */

import { KeyFact, FactSource, NodeMemory } from '../../src/types/domain';

export const mockFacts: KeyFact[] = [
  {
    id: 'fact-1',
    content: 'User prefers Python for data science',
    confidence: 0.9,
    source: FactSource.USER_STATED,
    extractedAt: Date.now() - 86400000, // 1 day ago
    supportingEvidence: ['User explicitly said: I prefer Python for data science'],
    embedding: undefined,
  },
  {
    id: 'fact-2',
    content: 'User is based in Sydney, Australia',
    confidence: 0.85,
    source: FactSource.USER_STATED,
    extractedAt: Date.now() - 172800000, // 2 days ago
    supportingEvidence: ['User mentioned Sydney'],
    embedding: undefined,
  },
  {
    id: 'fact-3',
    content: 'User works with TensorFlow and PyTorch',
    confidence: 0.7,
    source: FactSource.LLM_INFERRED,
    extractedAt: Date.now() - 259200000, // 3 days ago
    supportingEvidence: ['User discussed ML frameworks'],
    embedding: undefined,
  },
];

export const mockWorkingMemory = `
User: I've been working on a machine learning project lately
Assistant: That sounds interesting! What kind of project?
User: It's about image classification. I'm using Python and TensorFlow
Assistant: Great choice! Are you using any specific architecture?
User: Yes, I'm experimenting with ResNet and trying to fine-tune it
`;

export const mockCoreContext = 'Topic: Machine Learning Projects\nInitial Context: User is interested in machine learning and data science';

export const mockNodeMemory: NodeMemory = {
  coreContext: mockCoreContext,
  workingMemory: mockWorkingMemory,
  keyFacts: mockFacts,
  messageCount: 5,
  lastSummaryAt: 0,
};

export const similarTextPairs = [
  {
    text1: 'User prefers Python',
    text2: 'User likes Python programming',
    expectedSimilarity: 0.85, // High similarity
    description: 'Similar meaning, different phrasing',
  },
  {
    text1: 'User is a data scientist',
    text2: 'User works in data science',
    expectedSimilarity: 0.8,
    description: 'Same profession, different expression',
  },
  {
    text1: 'User lives in Sydney',
    text2: 'User prefers Python',
    expectedSimilarity: 0.2, // Low similarity
    description: 'Completely different topics',
  },
  {
    text1: 'User loves machine learning',
    text2: 'User enjoys artificial intelligence',
    expectedSimilarity: 0.75,
    description: 'Related but distinct concepts',
  },
];

export const conversationScenarios = [
  {
    name: 'Python programming discussion',
    workingMemory: `
User: I've been coding in Python for 5 years
Assistant: That's great experience!
User: I mainly use it for data analysis with pandas
Assistant: Pandas is excellent for that
User: I also use scikit-learn for machine learning
`,
    coreContext: 'Topic: Programming Experience',
    expectedFacts: [
      'User has 5 years of Python experience',
      'User uses pandas for data analysis',
      'User uses scikit-learn for machine learning',
    ],
  },
  {
    name: 'Location discussion',
    workingMemory: `
User: I'm based in Sydney, Australia
Assistant: Beautiful city!
User: Yes, I love the beaches here
Assistant: The weather must be nice
User: It's perfect for outdoor activities
`,
    coreContext: 'Topic: Personal Information',
    expectedFacts: [
      'User is based in Sydney, Australia',
      'User enjoys beaches',
      'User likes outdoor activities',
    ],
  },
];
