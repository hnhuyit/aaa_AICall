import axios from "axios";

/**
 * Trả lời 1 comment trên Facebook
 * @param {string} commentId - ID của comment gốc
 * @param {string} message - Nội dung phản hồi
 * @param {string} accessToken - Page Access Token
 */
export async function replyToComment(commentId, message, accessToken) {
  try {
    const res = await axios.post(
      `https://graph.facebook.com/v22.0/${commentId}/comments`,
      { message },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    console.log("✅ Đã phản hồi comment:", res.data);
    return res.data;
  } catch (err) {
    console.error("❌ Lỗi khi phản hồi comment:", err.response?.data || err.message);
  }
}
