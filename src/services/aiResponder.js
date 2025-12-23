// src/services/aiResponder.js
import { callAgentWithTools } from "./aiService.js";
import { createBooking, createBookingAirtable, createBookingPOS } from "./bookingService.js";
// import { lookupCustomer, createLead } from "./airtableService.js"; // hoặc crmService riêng

import { askAI } from "./aiService.js";
import { replyZalo, replyMessenger } from "./zaloService.js";

/**
 * Gửi phản hồi về user theo nền tảng
 * @param {string} platform - 'zalo' | 'messenger'
 * @param {string} userId - ID của người dùng
 * @param {string} message - Nội dung cần gửi
 * @param {string} token - Token tương ứng với platform
 * @returns {Promise<Object>} - Dữ liệu phản hồi từ API gốc
 */
export async function sendReplyToUser(platform, userId, message, token) {
  if (platform === "zalo") {
    return await replyZalo(userId, message, token);
  } else if (platform === "facebook") {
    return await replyMessenger(userId, message, token);
  } else {
    throw new Error(`❌ Nền tảng chưa hỗ trợ: ${platform}`);
  }
}

/**
 * Xử lý phản hồi từ AI và gửi lại cho người dùng
 * @param {string} userId - ID người dùng
 * @param {string} userMessage - Tin nhắn người dùng gửi
 * @param {string} prompt - System prompt cho AI
 * @param {Array} history - Lịch sử chat
 * @param {string} token - Token dùng để gửi tin nhắn
 * @param {string} platform - 'zalo' | 'messenger'
 * @returns {Promise<string>} - Phản hồi của AI
 */
export async function handleAIReply(userId, userMessage, prompt, history, token, platform = "zalo") {
  try {
    const aiReply = await askAI(userMessage, prompt, history, platform); // Gọi AI

    try {
      const res = await sendReplyToUser(platform, userId, aiReply, token);
      console.log("✅ AI Assistant phản hồi:", aiReply);
      return aiReply;
    } catch (sendErr) {
      console.error("❌ Lỗi khi gửi phản hồi:", sendErr.message);
    }

    return aiReply;
  } catch (err) {
    console.error("❌ Lỗi phản hồi AI:", err.message);

    const fallbackMsg = err.message.includes("429") || err.message.includes("quota")
      ? "⚠️ Hệ thống AI đang quá tải. Nhân viên sẽ hỗ trợ bạn trong ít phút."
      : "⚠️ Xin lỗi, hiện tại hệ thống đang gặp sự cố. Vui lòng thử lại sau.";

    // Gửi fallback cho user
    try {
      await sendReplyToUser(platform, userId, fallbackMsg, token);
    } catch (fallbackErr) {
      console.error("❌ Lỗi gửi fallback:", fallbackErr.message);
    }

    // Gửi cảnh báo cho admin Zalo
    try {
      const adminZaloId = "9187775818961242155";
      await replyZalo(adminZaloId, `⚠️ AI lỗi với user ${userId} (${platform}): ${userMessage}`, token);
    } catch (adminErr) {
      console.error("❌ Lỗi gửi cảnh báo admin:", adminErr.message);
    }
  }
}

const tools = [
  {
    type: "function",
    name: "create_booking_airtable",
    description: "Tạo booking khi đã có đủ tên, dịch vụ, giờ và số điện thoại",
    parameters: {
      type: "object",
      properties: {
        service: { type: "string" },
        datetime_iso: { type: "string", description: "ISO8601 (+07)" },
        phone: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        note: { type: "string" }
      },
      required: ["service", "phone"]
    }
  },
  {
    type: "function",
    name: "create_booking_pos",
    description: "Tạo booking trên POS khi thời gian",
    parameters: {
      type: "object",
      properties: {
        // service: { type: "string" },
        datetime_iso: { type: "string", description: "ISO8601 +07" },
        datetime_text: { type: "string" },
        // phone: { type: "string" },
        // name: { type: "string" },
        // email: { type: "string" },
        note: { type: "string" }
      },
      required: ["datetime_iso"]
    }
  }
];

export async function runAgent({ platform, userId, userMessage, systemPrompt, history }) {
  // Bạn nhét state ngữ cảnh vào đây cũng được: last_intent, missing_fields...
  // const input = buildInput({ platform, userId, userMessage, systemPrompt, history });

  // const normalizedHistory = (history ?? [])
  //   .slice(-10)
  //   .map(h => ({
  //     role: h.role,
  //     content: (h.content ?? h.message ?? "").trim()
  //   }))
  //   .filter(m => m.content);

  // const input = [
  //   { role: "system", content: "QUY TẮC ĐẶT LỊCH:\n" +
  //     "- Nếu khách muốn đặt lịch/hẹn tư vấn: thu thập service, thời gian, phone (tên/email/note optional).\n" +
  //     "- Khi có đủ service + phone + (datetime_iso hoặc datetime_text) => BẮT BUỘC gọi tool create_booking_pos.\n" +
  //     "- Nếu thiếu gì thì hỏi ngắn gọn 1-2 ý.\n" +
  //     "- Không trả lời chung chung kiểu 'chưa hiểu' nếu khách đang đặt lịch.\n"},
  //   ...(history ?? []).slice(-10).map(h => ({ role: h.role, content: h.content })),
  //   {
  //     role: "user",
  //     content: userMessage
  //   }
  // ];
  
  const input = [
    { role: "system", content: "QUY TẮC ĐẶT LỊCH:\n" +
      "- Nếu khách muốn đặt lịch/hẹn tư vấn: thời gian, phone (tên/email/note optional).\n" +
      "- Khi có (datetime_iso hoặc datetime_text) => BẮT BUỘC gọi tool create_booking_pos.\n" +
      "- Nếu thiếu gì thì hỏi ngắn gọn 1-2 ý.\n" +
      "- Không trả lời chung chung kiểu 'chưa hiểu' nếu khách đang đặt lịch.\n"},
    ...(history ?? []).slice(-10).map(h => ({ role: h.role, content: h.content })),
    {
      role: "user",
      content: userMessage
    }
  ];

  // console.log("input", input)
  const toolHandlers = {
    // lookup_customer: async (args) => lookupCustomer(args),
    create_booking_pos: async (args) => createBookingPOS(args),
    // create_booking_airtable: async (args) => createBookingAirtable({ platform, ...args })
  };

  const { finalText, toolTrace } = await callAgentWithTools({
    model: "gpt-5-mini",
    input,
    tools,
    toolHandlers
  });

  console.log("finalText by runAgent", finalText, toolTrace)

  return { replyText: finalText, toolTrace };
}

function buildInput({ platform, userId, userMessage, systemPrompt, history }) {
  const messages = [
    { role: "system", content: systemPrompt },
    ...(history ?? []).slice(-12).map(h => ({ role: h.role, content: h.content })),
    {
      role: "user",
      content: JSON.stringify({
        platform,
        userId,
        message: userMessage,
        instruction:
          "Nếu khách có ý định đặt lịch (book/đặt hẹn/đặt lịch), hãy thu thập thiếu thông tin (dịch vụ, ngày giờ, số điện thoại) và gọi create_booking khi đủ. Nếu thiếu datetime hoặc phone thì hỏi ngắn gọn."
      })
    }
  ];
  return messages;
}


// {
//   type: "function",
//   function: {
//     name: "lookup_customer",
//     description: "Tra cứu khách trong CRM theo userId (PSID) hoặc phone",
//     parameters: {
//       type: "object",
//       properties: {
//         userId: { type: "string" },
//         phone: { type: "string" }
//       },
//       required: ["userId"]
//     }
//   }
// },
// {
//   type: "function",
//   function: {
//     name: "create_booking",
//     description: "Tạo booking khi khách muốn đặt lịch",
//     parameters: {
//       type: "object",
//       properties: {
//         userId: { type: "string" },
//         service: { type: "string", description: "Ví dụ: nail, pedicure, headspa..." },
//         datetime_iso: { type: "string", description: "ISO8601. Nếu chưa rõ thì để trống và hỏi lại." },
//         phone: { type: "string" },
//         note: { type: "string" }
//       },
//       required: ["userId", "service"]
//     }
//   }
// },