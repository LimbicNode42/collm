import { AdjudicationResult, Node, Message } from '../types';

export interface IAdjudicationEngine {
  /**
   * Evaluates a message against the current state of a node to determine if it is relevant and not stale.
   * @param message The message to evaluate
   * @param node The node (conversation thread) context
   */
  adjudicate(message: Message, node: Node): Promise<AdjudicationResult>;
}

export class MockAdjudicationEngine implements IAdjudicationEngine {
  async adjudicate(message: Message, node: Node): Promise<AdjudicationResult> {
    // Placeholder logic:
    // In a real implementation, this would call an LLM to compare the message content
    // with the node.state (summary) to check for semantic overlap or staleness.
    
    console.log(`[AdjudicationEngine] Evaluating message ${message.id} against node ${node.id}`);

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Randomly decide if relevant for the mock
    const isRelevant = Math.random() > 0.3;
    const isStale = Math.random() > 0.8;

    return {
      messageId: message.id,
      isRelevant,
      isStale,
      score: Math.random(),
      reason: isRelevant ? "Message adds new information." : "Message is redundant or off-topic."
    };
  }
}

export const adjudicationEngine = new MockAdjudicationEngine();
