"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initiateProviderPayment = initiateProviderPayment;
exports.verifySSLCommerzPayment = verifySSLCommerzPayment;
exports.verifyWebhookSignature = verifyWebhookSignature;
const env_1 = require("../config/env");
const crypto_1 = require("crypto");
const sslcommerz_config_1 = require("./sslcommerz/sslcommerz.config");

function gatewayTxn(bookingId) {
    return `TM-SSL-${Date.now()}-${bookingId.slice(-6)}`;
}

function buildSandboxSession(bookingId, tx, amount) {
    const appBase = env_1.env.APP_BASE_URL;
    return {
        checkoutUrl: `${appBase}/payment/simulate?provider=sslcommerz&transactionId=${encodeURIComponent(tx)}&bookingId=${encodeURIComponent(bookingId)}&amount=${encodeURIComponent(amount)}`,
        transactionId: tx,
        providerPaymentId: tx,
        mode: "sandbox",
    };
}

async function initiateProviderPayment({ bookingId, amount, userId }) {
    const tx = gatewayTxn(bookingId);
    const backendBase = env_1.env.BACKEND_BASE_URL;
    if (!(0, sslcommerz_config_1.useSslCommerzLive)()) {
        return buildSandboxSession(bookingId, tx, amount);
    }
    try {
        const initUrl = `${env_1.env.SSLCOMMERZ_API_URL}/gwprocess/v4/api.php`;
        const params = new URLSearchParams({
            store_id: env_1.env.SSLCOMMERZ_STORE_ID,
            store_passwd: env_1.env.SSLCOMMERZ_STORE_PASSWORD,
            total_amount: String(amount),
            currency: "BDT",
            tran_id: tx,
            success_url: `${backendBase}/api/payments/callback/sslcommerz/success`,
            fail_url: `${backendBase}/api/payments/callback/sslcommerz/fail`,
            cancel_url: `${backendBase}/api/payments/callback/sslcommerz/cancel`,
            ipn_url: `${backendBase}/api/payments/webhook/sslcommerz`,
            product_name: "Turf Booking",
            product_category: "Sports",
            product_profile: "service",
            cus_name: "Customer",
            cus_email: "customer@example.com",
            cus_add1: "Dhaka",
            cus_city: "Dhaka",
            cus_country: "Bangladesh",
            cus_phone: "01700000000",
            shipping_method: "NO",
            value_a: String(userId),
            value_b: String(bookingId),
        });
        const initRes = await fetch(initUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
        });
        const initText = await initRes.text();
        let initData = {};
        try {
            initData = JSON.parse(initText);
        }
        catch {
            initData = { raw: initText };
        }
        if (!initRes.ok || initData?.status === "FAILED") {
            throw new Error(initData?.failedreason ?? "SSLCommerz init failed");
        }
        return {
            checkoutUrl: initData?.GatewayPageURL ?? buildSandboxSession(bookingId, tx, amount).checkoutUrl,
            transactionId: tx,
            providerPaymentId: tx,
            mode: initData?.GatewayPageURL ? "live" : "sandbox",
        };
    }
    catch (error) {
        console.warn("SSLCommerz live init failed, using sandbox:", error?.message ?? error);
        return buildSandboxSession(bookingId, tx, amount);
    }
}

async function verifySSLCommerzPayment(valId) {
    if (!(0, sslcommerz_config_1.useSslCommerzLive)()) {
        return { success: true, transactionId: valId, payload: { sandbox: true } };
    }
    const validateUrl = `${env_1.env.SSLCOMMERZ_API_URL}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(env_1.env.SSLCOMMERZ_STORE_ID)}&store_passwd=${encodeURIComponent(env_1.env.SSLCOMMERZ_STORE_PASSWORD)}&v=1&format=json`;
    const validateRes = await fetch(validateUrl);
    if (!validateRes.ok) {
        return { success: false, transactionId: valId, payload: { error: "validate_failed" } };
    }
    const payload = await validateRes.json();
    const status = String(payload?.status ?? "").toUpperCase();
    const success = status === "VALID" || status === "VALIDATED";
    return {
        success,
        transactionId: payload?.tran_id ?? valId,
        payload,
    };
}

function verifyWebhookSignature(rawBody, incomingSignature, secret) {
    if (!secret || !rawBody || !incomingSignature) {
        return false;
    }
    const expected = (0, crypto_1.createHmac)("sha256", secret).update(rawBody).digest("hex");
    try {
        return (0, crypto_1.timingSafeEqual)(Buffer.from(expected), Buffer.from(incomingSignature));
    }
    catch {
        return false;
    }
}
