"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageStatus = void 0;
var MessageStatus;
(function (MessageStatus) {
    MessageStatus["PENDING"] = "PENDING";
    MessageStatus["ADJUDICATING"] = "ADJUDICATING";
    MessageStatus["ACCEPTED"] = "ACCEPTED";
    MessageStatus["REJECTED"] = "REJECTED";
    MessageStatus["STALE"] = "STALE";
})(MessageStatus || (exports.MessageStatus = MessageStatus = {}));
