"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startPayoutWorker = startPayoutWorker;
// src/payments/workers/payout-worker.ts
var bullmq_1 = require("bullmq");
var common_1 = require("@nestjs/common");
var logger = new common_1.Logger('PayoutWorker');
function startPayoutWorker(redisOpts) {
    var _this = this;
    var worker = new bullmq_1.Worker('payouts', function (job) { return __awaiter(_this, void 0, void 0, function () {
        var _a, payoutId, userId, amountCents, currency, iban, reference, externalId, error_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = job.data, payoutId = _a.payoutId, userId = _a.userId, amountCents = _a.amountCents, currency = _a.currency, iban = _a.iban, reference = _a.reference;
                    logger.log("Processing payout ".concat(payoutId, " for user ").concat(userId));
                    logger.debug("Amount: ".concat(amountCents, " ").concat(currency, ", IBAN: ").concat(iban.slice(-4)));
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, , 4]);
                    // TODO: Integrate with actual payment provider (Stripe, GoCardless, etc.)
                    // For now, simulate a successful payout
                    // Simulate processing delay
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 2:
                    // TODO: Integrate with actual payment provider (Stripe, GoCardless, etc.)
                    // For now, simulate a successful payout
                    // Simulate processing delay
                    _b.sent();
                    externalId = "ext_".concat(Date.now(), "_").concat(payoutId.slice(0, 8));
                    logger.log("Payout ".concat(payoutId, " completed successfully. External ID: ").concat(externalId));
                    return [2 /*return*/, {
                            success: true,
                            payoutId: payoutId,
                            externalId: externalId,
                        }];
                case 3:
                    error_1 = _b.sent();
                    logger.error("Payout ".concat(payoutId, " failed: ").concat(error_1.message));
                    return [2 /*return*/, {
                            success: false,
                            payoutId: payoutId,
                            error: error_1.message,
                        }];
                case 4: return [2 /*return*/];
            }
        });
    }); }, {
        connection: redisOpts,
        concurrency: 5,
        limiter: {
            max: 100,
            duration: 60000, // 100 jobs per minute
        },
    });
    worker.on('error', function (err) {
        logger.error('Worker error:', err);
    });
    return worker;
}
exports.default = startPayoutWorker;
