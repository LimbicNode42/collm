"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageStatus = exports.FactSource = void 0;
var FactSource;
(function (FactSource) {
    FactSource["USER_STATED"] = "USER_STATED";
    FactSource["USER_CONFIRMED"] = "USER_CONFIRMED";
    FactSource["LLM_INFERRED"] = "LLM_INFERRED";
    FactSource["IMPLICIT"] = "IMPLICIT";
})(FactSource || (exports.FactSource = FactSource = {}));
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "PENDING";
    MessageStatus["ADJUDICATING"] = "ADJUDICATING";
    MessageStatus["ACCEPTED"] = "ACCEPTED";
    MessageStatus["REJECTED"] = "REJECTED";
    MessageStatus["STALE"] = "STALE";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
//# sourceMappingURL=domain.js.map