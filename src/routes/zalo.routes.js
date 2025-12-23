// src/controllers/zalo.controller.js
import { handleAIReply } from "../services/aiResponder.js";
import { replyZalo } from "../services/zaloService.js";
import { getOAToken, fetchConfigFromAirtable } from "../config/index.js"; // Nếu bạn có gói logic refresh token vào config hoặc service riêng
// Các hàm lưu lịch sử, cập nhật Airtable, … có thể được chuyển vào một module riêng (ví dụ airtableService)

// export async function verifyWebhook(req, res) {
//   // Đơn giản trả về echostr nếu có logic xác thực cho GET webhook
//   const { hub: { challenge } } = req.query;
//   return res.status(200).send(challenge || "Webhook verified");
// }

// export async function handleZaloWebhook(req, res, next) {
//   try {
//     const { event_name, sender, message } = req.body;
//     const userId = sender.id;
//     const userMessage = message.text;
//     // Giả sử bạn có hàm fetchConfigFromAirtable để lấy SYSTEM_PROMPT và các cấu hình khác
//     const config = await fetchConfigFromAirtable();
//     const SYSTEM_PROMPT = config.SYSTEM_PROMPT;
//     const token = getOAToken(); // Token đã được refresh theo cron

//     // Lưu lịch sử tin nhắn, cập nhật interaction nếu cần (bạn có thể tách riêng sang airtableService)
//     // await saveMessage({ userId, role: "user", message: userMessage });
//     // await updateLastInteractionOnlyIfNewDay(userId, event_name);
    
//     if (event_name === "user_send_text") {
//       console.log(`Bạn vừa gửi: "${userMessage}"`);
//       const aiReply = await handleAIReply(userId, userMessage, SYSTEM_PROMPT, /* history */ [], token);
//       // await saveMessage({ userId, role: "assistant", message: aiReply });
//     } else {
//       // Xử lý các loại nội dung khác:
//       const unsupportedTypes = [
//         "user_send_image",
//         "user_send_video",
//         "user_send_audio",
//         "user_send_file",
//         "user_send_sticker",
//         "user_send_location",
//         "user_send_business_card"
//       ];
//       if (unsupportedTypes.includes(event_name)) {
//         await replyZalo(userId, `❗ Trợ lý AI hiện tại chưa hỗ trợ xử lý loại nội dung này.\n\n📌 Vui lòng gửi tin nhắn văn bản để được phản hồi chính xác nhé.`, token);
//       } else {
//         await replyZalo(userId, `Chào bạn, rất vui được kết nối! Mình có thể hỗ trợ gì cho kế hoạch áp dụng AI và Automation cho bạn không?`, token);
//         console.log("❓ Loại event chưa xử lý:", event_name);
//       }
//     }

//     console.log("✅ Webhook nhận được:", event_name, req.body);
//     res.sendStatus(200);
//   } catch (err) {
//     console.error("🔥 Lỗi webhook:", err);
//     next(err);
//   }
// }
