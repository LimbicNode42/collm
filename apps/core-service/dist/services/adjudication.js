"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjudicationEngine = exports.LLMAdjudicationEngine = void 0;
const llm_1 = require("./llm");
class LLMAdjudicationEngine {
    async adjudicate(message, node) {
        console.log(`[AdjudicationEngine] Evaluating message ${message.id} against node ${node.id} (v${node.version}) using model "${node.model}"`);
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
        const systemPrompt = "You are an expert conversation moderator. Always respond with valid JSON in the exact format requested.";
        try {
            const response = await llm_1.llmService.generateCompletion(prompt, systemPrompt, node.model);
            const result = JSON.parse(response.content);
            return {
                messageId: message.id,
                isRelevant: result.isRelevant,
                isStale: result.isStale,
                reason: result.reason,
                score: result.score,
            };
        }
        catch (error) {
            console.error("[AdjudicationEngine] Error calling LLM:", error);
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
exports.LLMAdjudicationEngine = LLMAdjudicationEngine;
exports.adjudicationEngine = new LLMAdjudicationEngine();
//# sourceMappingURL=adjudication.js.map