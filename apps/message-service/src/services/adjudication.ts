import { AdjudicationResult, Node, Message } from '@collm/types';
import { llmService } from './llm';

export interface IAdjudicationEngine {
  /**
   * Evaluates a message against the current state of a node to determine if it is relevant and not stale.
   * @param message The message to evaluate
   * @param node The node (conversation thread) context
   */
  adjudicate(message: Message, node: Node): Promise<AdjudicationResult>;
}

export class LLMAdjudicationEngine implements IAdjudicationEngine {
  async adjudicate(message: Message, node: Node): Promise<AdjudicationResult> {
    console.log(`[AdjudicationEngine] Evaluating message ${message.id} against node ${node.id} (v${node.version})`);

    const prompt = `
You are an impartial adjudicator for a collaborative conversation.
Your goal is to determine if a new message is relevant to the current state of the conversation and if it provides new information (is not stale).

Current Conversation State:
${node.state}

New Message:
${message.content}

Evaluate the message based on the following criteria:
1. Relevance: Does the message directly address the topic or the current state of the conversation?
2. Staleness: Does the message repeat information already present in the state?

Respond with a JSON object in the following format:
{
  "isRelevant": boolean,
  "isStale": boolean,
  "reason": "string explanation",
  "score": number (0-1 confidence score)
}
    `;

    try {
      const response = await llmService.generateCompletion(prompt);
      // Basic parsing - in production, use a more robust JSON parser or structured output mode
      const result = JSON.parse(response.content);

      return {
        messageId: message.id,
        isRelevant: result.isRelevant,
        isStale: result.isStale,
        reason: result.reason,
        score: result.score,
      };
    } catch (error) {
      console.error("[AdjudicationEngine] Error calling LLM:", error);
      // Fallback to rejection on error for safety
      return {
        messageId: message.id,
        isRelevant: false,
        isStale: true,
        reason: "Error during adjudication process.",
        score: 0,
      };
    }
  }
}

export const adjudicationEngine = new LLMAdjudicationEngine();
