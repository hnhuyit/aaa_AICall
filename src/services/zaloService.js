// src/services/zaloService.js
import axios from "axios";

export async function replyZalo(userId, message, token) {
  try {
    if (!token) {
      throw new Error("⚠️ OA_ACCESS_TOKEN chưa được thiết lập trong .env");
    }

    const res = await axios.post(
      "https://openapi.zalo.me/v3.0/oa/message/cs",
      {
        recipient: { user_id: userId },
        message: { text: message }
      },
      {
        headers: {
          "access_token": token,
          "Content-Type": "application/json"
        }
      }
    );
    console.log("📤 Đã gửi Zalo:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ Gửi Zalo thất bại:", err.response?.data || err.message);
    throw err;
  }
}

export async function replyMessenger(sender_psid, text, token) {
  const body = {
    recipient: { id: sender_psid },
    messaging_type: "RESPONSE",
    message: { text }
  };

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/me/messages?access_token=${token}`,
      body
    );
    console.log("📩 Đã gửi tin nhắn Messenger:", res.data);
    return res.data; // ✅ Trả về kết quả gửi
  } catch (err) {
    console.error("❌ Lỗi gửi tin nhắn Messenger:", err.response?.data || err.message);
    throw err;
  }
}