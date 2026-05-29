"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const paymentMethod_controller_1 = require("../controllers/paymentMethod.controller");
const router = (0, express_1.Router)();
router.get("/", paymentMethod_controller_1.listPublicPaymentMethods);
exports.default = router;
