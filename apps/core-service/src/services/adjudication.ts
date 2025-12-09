import { AdjudicationResult, Node, Message } from '../types/domain';
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
    console.log(`[AdjudicationEngine] Evaluating message ${message.id} against node ${node.id} (v${node.version}) using model "${node.model}"`);

    const prompt = `
You are an impartial adjudicator for a collaborative conversation.
Your goal is to determine if a new message is relevant to the current state of the conversation and if it provides new information (is not stale).

Core Topic Context:
${node.memory.coreContext}

Current Working Memory:
${node.memory.workingMemory}

Key Facts Known:
${node.memory.keyFacts.join('\n- ')}

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

    const systemPrompt = "You are an expert conversation moderator. Always respond with valid JSON in the exact format requested.";

    try {
      const response = await llmService.generateCompletion(prompt, systemPrompt, node.model);
      // Basic parsing - in production, use a more robust JSON parser or structured output mode
      const cleanedResponse = response.content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim();
      const result = JSON.parse(cleanedResponse);

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
