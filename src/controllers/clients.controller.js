// src/controllers/zalo.controller.js
// import { handleIGMessage, handleIGPostback } from "../services/instagramService.js";
// import { handleAIReply } from "../services/aiResponder.js";
// import { replyMessenger  } from "../services/zaloService.js";
// import { replyToComment  } from "../services/facebookService.js";
// import { fetchConfigFromAirtable, updateLastInteractionOnlyIfNewDay } from "../config/index.js"; // Nếu bạn có gói logic refresh token vào config hoặc service riêng
// import { saveMessage, getRecentMessages } from "../services/airtableService.js";
// Các hàm lưu lịch sử, cập nhật Airtable, … có thể được chuyển vào một module riêng (ví dụ airtableService)

// export async function verifyWebhookIG(req, res) {
//   // // Đơn giản trả về echostr nếu có logic xác thực cho GET webhook
//   // const { hub: { challenge } } = req.query;
//   // return res.status(200).send(challenge || "IG Webhook verified");

//   // Parse the query params
//   let mode = req.query["hub.mode"];
//   let token = req.query["hub.verify_token"];
//   let challenge = req.query["hub.challenge"];

//   // Check if a token and mode is in the query string of the request
//   if (mode && token) {
//     // Check the mode and token sent is correct
//     if (mode === "subscribe" && token === "1234567890") {
//       // Respond with the challenge token from the request
//       console.log("WEBHOOK_VERIFIED");
//       res.status(200).send(challenge);
//     } else {
//       // Respond with '403 Forbidden' if verify tokens do not match
//       res.status(403).send("Forbidden – Token mismatch");
//     }
//   }

// }

export async function verifyWebhookAnnaFB(req, res) {
  // // Đơn giản trả về echostr nếu có logic xác thực cho GET webhook
  // const { hub: { challenge } } = req.query;
  // return res.status(200).send(challenge || "FB Webhook verified");

  // Parse the query params
  let mode = req.query["hub.mode"];
  let token = req.query["hub.verify_token"];
  let challenge = req.query["hub.challenge"];

  // Check if a token and mode is in the query string of the request
  if (mode && token) {
    // Check the mode and token sent is correct
    if (mode === "subscribe" && token === "1234567890") {
      // Respond with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Respond with '403 Forbidden' if verify tokens do not match
      res.status(403).send("Forbidden – Token mismatch");
    }
  }
}

// export async function verifyWebhookMessager(req, res) {
  
//   // Parse the query params
//   let mode = req.query["hub.mode"];
//   let token = req.query["hub.verify_token"];
//   let challenge = req.query["hub.challenge"];

//   // Check if a token and mode is in the query string of the request
//   if (mode && token) {
//     // Check the mode and token sent is correct
//     if (mode === "subscribe" && token === "1234567890") {
//       // Respond with the challenge token from the request
//       console.log("WEBHOOK_VERIFIED");
//       res.status(200).send(challenge);
//     } else {
//       // Respond with '403 Forbidden' if verify tokens do not match
//       res.status(403).send("Forbidden – Token mismatch");
//     }
//   }
// }

// export async function handleFacebookWebhook(req, res, next) {
//   try {
//     const body = req.body;

//     if (body.object !== "page") {
//       return res.sendStatus(404);
//     }

//     const token = process.env.PAGE_ACCESS_TOKEN; // Facebook Page Token (hoặc dùng process.env.PAGE_ACCESS_TOKEN)
//     const config = await fetchConfigFromAirtable();
    
//     // Kiểm tra trạng thái bot
//     if (config.bot_status !== "active") {
//       console.log("🚫 Bot đang tắt, không xử lý phản hồi.");
//       return res.sendStatus(200);
//     }

//     const SYSTEM_PROMPT = config.SYSTEM_PROMPT;
//     const platform = "facebook";

//     for (const entry of body.entry) {
//       const webhook_event = entry.messaging?.[0];
//       const changes = entry.changes || [];


      
//       // ✅ Xử lý tin nhắn Messenger như trước
//       if (webhook_event) {
//         const sender_psid = webhook_event?.sender?.id;
//         // const recipient_id = webhook_event?.recipient?.id;
//         const message = webhook_event?.message;

//         // ❌ Bỏ qua nếu không có sender hoặc sender là chính page bot
//         if (!sender_psid || sender_psid === "543096242213723") {
//           console.log("⏭️ Bỏ qua event từ chính page bot hoặc thiếu sender.");
//           continue;
//         }

//         // if (!sender_psid) continue;

//         // ✅ Chỉ xử lý nếu là tin nhắn dạng text
//         if (message?.text) {
//           const userMessage = message.text;
//           console.log(`📥 Messenger > User gửi: "${userMessage}"`);

//           // Lưu tin nhắn người dùng
//           await saveMessage({
//             userId: sender_psid,
//             role: "user",
//             message: userMessage,
//             platform
//           });

//           // ✅ Lưu lần tương tác gần nhất
//           await updateLastInteractionOnlyIfNewDay(sender_psid, "message_received", platform);

//           // Lấy lịch sử
//           const history = await getRecentMessages(sender_psid, platform);

//           // Gọi AI và gửi phản hồi
//           const aiReply = await handleAIReply(
//             sender_psid,
//             userMessage,
//             SYSTEM_PROMPT,
//             history,
//             token,
//             platform
//           );

//           // Lưu phản hồi AI
//           await saveMessage({
//             userId: sender_psid,
//             role: "assistant",
//             message: aiReply,
//             platform
//           });
//         } else {
//           // 🛑 Bỏ qua các loại tin nhắn không phải text
//           console.log("📎 Bỏ qua message không phải text:", message);
//           // await replyMessenger(
//           //   sender_psid,
//           //   "❗ Hiện tại Hair Consulting chỉ hỗ trợ tin nhắn văn bản.",
//           //   token
//           // );
//         }
//       }

//       // ✅ Xử lý comment từ bài viết (feed webhook)
//       for (const change of changes) {
//         const value = change.value;

//         if (change.field === "feed" && value.item === "comment" && value.verb === "add") {
//           const commentId = value.comment_id;
//           const postId = value.post_id;
//           const parentId = value.parent_id;

//           const senderId = value.from?.id;
//           // const senderName = value.from?.name;
//           const message = value.message;

          
//           // ❌ Nếu là comment trả lời (reply) → bỏ qua
//           if (parentId !== postId) {
//             console.log("⏭️ Bỏ qua comment reply (comment cấp 2):", commentId);
//             continue;
//           }

//           if (!senderId) {
//             console.warn("❌ Không xác định được senderId từ comment:", value);
//             continue;
//           }
          
//           // 🚫 Nếu senderId là ID của chính page → bỏ qua
//           const PAGE_ID = entry.id; // từ entry.id chính là ID page
//           if (senderId === PAGE_ID) {
//             console.log("⏭️ Bỏ qua comment do chính Page đăng.");
//             continue;
//           }

//           // ✅ Còn lại là comment từ người dùng
//           // console.log("💬 Comment người dùng:", message, PAGE_ID, senderId, value);

//           console.log("💬 Comment mới:", {
//             senderId,
//             commentId,
//             postId,
//             message
//           });

//           await saveMessage({
//             userId: senderId,
//             role: "user",
//             message,
//             platform
//           });

//           await updateLastInteractionOnlyIfNewDay(senderId, "comment_received", platform);

//           // Lấy lịch sử
//           const history = await getRecentMessages(senderId, platform);

//           // 👉 Nếu bạn muốn phản hồi comment bằng AI hoặc gửi comment lại:
//           const aiCommentReply = await handleAIReply(senderId, message, SYSTEM_PROMPT, history, token, platform);

//           // Lưu phản hồi AI
//           await saveMessage({
//             userId: senderId,
//             role: "assistant",
//             message: aiCommentReply,
//             platform
//           });

//           await replyToComment(commentId, aiCommentReply, token); // cần viết thêm hàm này nếu cần
//         }
//       }

//     }
//     res.status(200).send("EVENT_RECEIVED");
//   } catch (err) {
//     console.error("🔥 Lỗi webhook Messenger:", err);
//     next(err);
//   }
// }
