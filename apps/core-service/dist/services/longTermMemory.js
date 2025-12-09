"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.longTermMemory = exports.SemanticLongTermMemory = exports.ConfidenceEventType = void 0;
const domain_1 = require("../types/domain");
const llm_1 = require("./llm");
var ConfidenceEventType;
(function (ConfidenceEventType) {
    ConfidenceEventType["USER_CONFIRMED"] = "USER_CONFIRMED";
    ConfidenceEventType["MENTIONED_AGAIN"] = "MENTIONED_AGAIN";
    ConfidenceEventType["CONTRADICTED"] = "CONTRADICTED";
    ConfidenceEventType["TIME_DECAY"] = "TIME_DECAY";
    ConfidenceEventType["IMPLICIT_VALIDATION"] = "IMPLICIT_VALIDATION";
})(ConfidenceEventType || (exports.ConfidenceEventType = ConfidenceEventType = {}));
class SemanticLongTermMemory {
    constructor() {
        this.SIMILARITY_THRESHOLD = 0.8;
        this.MIN_CONFIDENCE_THRESHOLD = 0.2;
        this.CONFIDENCE_WEIGHTS = {
            [domain_1.FactSource.USER_STATED]: 0.9,
            [domain_1.FactSource.USER_CONFIRMED]: 1.0,
            [domain_1.FactSource.LLM_INFERRED]: 0.6,
            [domain_1.FactSource.IMPLICIT]: 0.4
        };
    }
    cleanJsonResponse(response) {
        const cleaned = response
            .trim()
            .replace(/^```(?:json)?\s*/, '')
            .replace(/\s*```$/, '')
            .trim();
        return cleaned;
    }
    async extractAndMergeKeyFacts(existingFacts, workingMemory, coreContext) {
        const candidateFacts = await this.extractCandidateFacts(workingMemory, coreContext);
        const mergedFacts = [...existingFacts];
        for (const candidate of candidateFacts) {
            const similarFact = await this.findSimilarFact(candidate, existingFacts);
            if (similarFact) {
                const updatedFact = this.mergeFacts(similarFact, candidate);
                const index = mergedFacts.findIndex(f => f.id === similarFact.id);
                mergedFacts[index] = updatedFact;
            }
            else {
                mergedFacts.push(Object.assign(Object.assign({}, candidate), { id: `fact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, extractedAt: Date.now() }));
            }
        }
        return this.pruneFactsByConfidence(mergedFacts.map(fact => this.updateFactConfidence(fact, {
            type: ConfidenceEventType.TIME_DECAY,
            timestamp: Date.now()
        })));
    }
    async calculateSimilarity(text1, text2) {
        try {
            const prompt = `Rate the semantic similarity between these two statements on a scale of 0.0 to 1.0:

Statement 1: "${text1}"
Statement 2: "${text2}"

Return only a number between 0.0 and 1.0, where:
- 0.0 = completely unrelated
- 0.5 = somewhat related
- 1.0 = essentially the same meaning

Similarity score:`;
            const response = await llm_1.llmService.generateCompletion(prompt, 'You are a semantic similarity analyzer. Return only a decimal number.');
            const score = parseFloat(response.content.trim());
            return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
        }
        catch (error) {
            console.error('Error calculating similarity:', error);
            return 0;
        }
    }
    updateFactConfidence(fact, event) {
        let newConfidence = fact.confidence;
        switch (event.type) {
            case ConfidenceEventType.USER_CONFIRMED:
                newConfidence = Math.min(1.0, newConfidence + 0.3);
                break;
            case ConfidenceEventType.MENTIONED_AGAIN:
                newConfidence = Math.min(1.0, newConfidence + 0.1);
                break;
            case ConfidenceEventType.CONTRADICTED:
                newConfidence = Math.max(0.1, newConfidence - 0.4);
                break;
            case ConfidenceEventType.TIME_DECAY:
                const weeksSinceConfirmed = fact.lastConfirmedAt
                    ? (Date.now() - fact.lastConfirmedAt) / (7 * 24 * 60 * 60 * 1000)
                    : (Date.now() - fact.extractedAt) / (7 * 24 * 60 * 60 * 1000);
                newConfidence *= Math.pow(0.95, weeksSinceConfirmed);
                break;
            case ConfidenceEventType.IMPLICIT_VALIDATION:
                newConfidence = Math.min(1.0, newConfidence + 0.05);
                break;
        }
        return Object.assign(Object.assign({}, fact), { confidence: newConfidence, lastConfirmedAt: event.type === ConfidenceEventType.USER_CONFIRMED ? event.timestamp : fact.lastConfirmedAt });
    }
    pruneFactsByConfidence(facts, minConfidence = this.MIN_CONFIDENCE_THRESHOLD) {
        return facts
            .filter(fact => fact.confidence >= minConfidence)
            .sort((a, b) => b.confidence - a.confidence);
    }
    async extractCandidateFacts(workingMemory, coreContext) {
        const prompt = `Extract key facts from the following conversation that are relevant to the core context.

CORE CONTEXT:
${coreContext}

CONVERSATION TO ANALYZE:
${workingMemory}

Extract facts that are:
1. Factual statements (not opinions or questions)
2. Relevant to the core topic
3. Worth remembering for future conversations
4. Specific and actionable

Return a JSON array of objects with this structure:
{
  "content": "The factual statement",
  "confidence": 0.6,
  "source": "LLM_INFERRED",
  "supportingEvidence": ["Quote or context that supports this fact"]
}

JSON array:`;
        try {
            const response = await llm_1.llmService.generateCompletion(prompt, 'You are a fact extraction system. Return only valid JSON.');
            const cleanedResponse = this.cleanJsonResponse(response.content);
            const facts = JSON.parse(cleanedResponse);
            return Array.isArray(facts) ? facts.map(fact => ({
                content: fact.content || '',
                confidence: Math.max(0, Math.min(1, fact.confidence || this.CONFIDENCE_WEIGHTS[domain_1.FactSource.LLM_INFERRED])),
                source: fact.source in domain_1.FactSource ? fact.source : domain_1.FactSource.LLM_INFERRED,
                supportingEvidence: Array.isArray(fact.supportingEvidence) ? fact.supportingEvidence : [],
                lastConfirmedAt: undefined,
                embedding: undefined
            })) : [];
        }
        catch (error) {
            console.error('Error extracting facts:', error);
            return [];
        }
    }
    async findSimilarFact(candidate, existingFacts) {
        for (const existing of existingFacts) {
            const similarity = await this.calculateSimilarity(candidate.content, existing.content);
            if (similarity >= this.SIMILARITY_THRESHOLD) {
                return existing;
            }
        }
        return null;
    }
    mergeFacts(existing, candidate) {
        return Object.assign(Object.assign({}, existing), { confidence: Math.min(1.0, existing.confidence + 0.1), supportingEvidence: [...existing.supportingEvidence, ...candidate.supportingEvidence], lastConfirmedAt: Date.now() });
    }
}
exports.SemanticLongTermMemory = SemanticLongTermMemory;
exports.longTermMemory = new SemanticLongTermMemory();
//# sourceMappingURL=longTermMemory.js.map