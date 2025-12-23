// src/routes/webhook.routes.js
import express from "express";
// import crypto from "crypto";
// import { verifyWebhook, handleZaloWebhook } from "../controllers/zalo.controller.js";
// import { verifyWebhookIG, verifyWebhookFB, verifyWebhookWA, handleIGWebhook, handleFacebookWebhook, handleWAWebhook, handleWithAIAgent } from "../controllers/meta.controller.js";
// import { verifyWebhookAnnaFB } from "../controllers/clients.controller.js";
// import { imageToVideo } from '../controllers/stability.controller.js';
// import { normalizePhone } from "../utils/hashUtil.js";

const router = express.Router();

// // GET xác thực webhook (nếu cần)
// router.get("/webhook", verifyWebhook);
// router.get("/ig-webhook", verifyWebhookIG);
// router.get("/fb-webhook", verifyWebhookFB);
// router.get("/wa-webhook", verifyWebhookWA);
// // router.get("/messaging-webhook", verifyWebhookMessager); //webhook cũ 


// // POST xử lý webhook từ Zalo
// router.post("/webhook", handleZaloWebhook);
// router.post("/ig-webhook", handleIGWebhook);
// // router.post("/fb-webhook", handleFacebookWebhook);
// router.post("/fb-webhook", handleWithAIAgent);
// router.post("/wa-webhook", handleWAWebhook);
// // router.post("/messaging-webhook", handleMessagerWebhook);


// router.get("/webhook-anna-fb", verifyWebhookAnnaFB);
// router.get("/webhook-anna", verifyWebhookAnna);


// // Route thêm ví dụ: hash người dùng
// router.post("/hash-users-daily", async (req, res) => {
//   // Bạn có thể chuyển logic này vào controller riêng nếu cần
//   const { phone } = req.body;
//   const formattedPhone = normalizePhone(phone);
//   if (!formattedPhone) {
//     return res.status(400).json({ error: "Invalid phone number format" });
//   }
//   const hash = crypto.createHash("sha256").update(formattedPhone).digest("hex");
//   res.json({ hashed_phone: hash, formatted_phone: formattedPhone });
// });

// router.post('/image-to-video', imageToVideo);

export default router;
