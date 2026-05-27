"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const owner_routes_1 = __importDefault(require("./routes/owner.routes"));
const package_routes_1 = __importDefault(require("./routes/package.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const resource_routes_1 = __importDefault(require("./routes/resource.routes"));
const slot_routes_1 = __importDefault(require("./routes/slot.routes"));
const event_routes_1 = __importDefault(require("./routes/event.routes"));
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.urlencoded({ extended: false }));
exports.app.use(express_1.default.json({
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString("utf8");
    },
}));
exports.app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
exports.app.use("/api/auth", auth_routes_1.default);
exports.app.use("/api/admin", admin_routes_1.default);
exports.app.use("/api/owner", owner_routes_1.default);
exports.app.use("/api/packages", package_routes_1.default);
exports.app.use("/api/payments", payment_routes_1.default);
exports.app.use("/api/reviews", review_routes_1.default);
exports.app.use("/api/resources", resource_routes_1.default);
exports.app.use("/api/slots", slot_routes_1.default);
exports.app.use("/api/bookings", booking_routes_1.default);
exports.app.use("/api/events", event_routes_1.default);
