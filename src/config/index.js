// src/config/index.js
import dotenv from "dotenv";
import Airtable from "airtable";

dotenv.config();

// Cấu hình chung từ .env
const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  airtableApiKey: process.env.AIRTABLE_API_KEY,
  baseId: process.env.AIRTABLE_BASE_ID || "apptmh0D4kfxxCTn1",
  systemPrompt: process.env.SYSTEM_PROMPT || "Bạn là trợ lý OA.",
  oaAccessToken: process.env.OA_ACCESS_TOKEN,
};

// Thiết lập Airtable base
const base = new Airtable({ apiKey: config.airtableApiKey }).base(config.baseId);
const TABLE_NAME = "Customers";

// Lưu trữ token hiện tại (có thể khởi tạo từ biến môi trường)
let cachedToken = config.oaAccessToken || "";

/**
 * Lấy các cấu hình từ bảng Airtable (bảng Meta)
 * Giả sử bảng Meta có các trường:
 *   - name: tên cấu hình (ví dụ "OA_ACCESS_TOKEN")
 *   - key: giá trị của cấu hình đó.
 */

export async function fetchConfigFromAirtable() {
  try {
    const tableName = "Meta";
    const records = await base(tableName).select().all();
    const airtableConfig = {};
    records.forEach((record) => {
      const name = record.fields.name;
      const value = record.fields.key;
      if (name && typeof value !== "undefined") {
        airtableConfig[name] = value;
      }
    });
    return airtableConfig;
  } catch (error) {
    console.error("Error fetching config from Airtable:", error);
    return {};
  }
}

/**
 * Làm mới OA_ACCESS_TOKEN từ Airtable.
 * Nếu token mới khác với cachedToken thì cập nhật và log lại thời gian refresh.
 */
export async function refreshOAToken() {
  const airtableConfig = await fetchConfigFromAirtable();
  const newToken = airtableConfig.OA_ACCESS_TOKEN;
  if (newToken && newToken !== cachedToken) {
    cachedToken = newToken;
    console.log(`[TOKEN] OA Token refreshed at ${new Date().toISOString()}`);
  } else {
    console.log("[TOKEN] OA Token unchanged");
  }
  return cachedToken;
}

/**
 * Trả về token OA hiện tại từ cache.
 */
export function getOAToken() {
  return cachedToken;
}

export async function updateLastInteractionOnlyIfNewDay(userId, event_name, platform = "unknown") {
  try {
    const todayISOString = new Date().toISOString();
    const today = todayISOString.slice(0, 10); // yyyy-mm-dd
    const platformTag = platform.toLowerCase();

    const filterFormula = `AND(
      {ZaloUID} = '${userId}',
      {platform} = '${platformTag}'
    )`;

    const records = await base(TABLE_NAME)
      .select({
        filterByFormula: filterFormula,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length === 0) {
      console.warn("⚠️ Không tìm thấy user → tạo mới:", userId, platformTag);

      await base(TABLE_NAME).create([
        {
          fields: {
            ZaloUID: userId,
            // Name: userName,
            platform: platformTag,
            last_event: event_name,
            LastInteraction: todayISOString,
          },
        },
      ]);

      console.log("✅ Đã tạo mới user:", userId, platformTag);
      return;
    }

    const record = records[0];
    const oldDate = record.fields.LastInteraction;

    if (oldDate) {
      const lastDate = new Date(oldDate).toISOString().slice(0, 10);
      if (lastDate === today) {
        console.log("🟡 Đã tương tác hôm nay → không cần update:", userId);
        return;
      }
    }

    // ✅ Cập nhật nếu khác ngày
    await base(TABLE_NAME).update([
      {
        id: record.id,
        fields: {
          LastInteraction: todayISOString,
          last_event: event_name,
        },
      },
    ]);

    console.log("✅ Đã update LastInteraction mới cho:", userId, platformTag);
  } catch (err) {
    console.error("🔥 Lỗi khi xử lý LastInteraction:", err);
  }
}


// Thêm default export cho toàn bộ config nếu cần
// export default config;
export { config, base };