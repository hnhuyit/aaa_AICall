// src/services/posBooking.js

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

// POS của bạn đang dùng MM/DD/YYYY HH:mm (theo code bạn)
function toMMDDYYYY_HHMM(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}`;
}

// TODO: thay bằng bảng mapping thật (Airtable/DB)
export const DEFAULTS = {
  customers: [137554, 137552, 137553],
  services: [6137, 6138],
  staffs: [1643, 1650, 1656]
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}



export async function createBookingPOS({
  datetime_iso,
  datetime_text, // optional
  note,
  service,        // optional nhưng nên có
  customerId,
  staffId,
  serviceId,
  durationMin
}) {
  const missing = [];
  if (!note) missing.push("note");
  if (!datetime_iso && !datetime_text) missing.push("datetime");

  if (missing.length) {
    return {
      ok: false,
      need: missing,
      message: missing.includes("datetime")
        ? "Bạn muốn đặt lịch ngày giờ nào ạ?"
        : "Bạn cho mình xin thông tin note nhé."
    };
  }

  // Parse datetime
  if (!datetime_iso) {
    return {
      ok: false,
      need: ["datetime_iso"],
      message: "Bạn cho mình xin ngày giờ cụ thể (VD: 2025-12-15T18:30:00+07:00) nhé."
    };
  }

  const start = new Date(datetime_iso);
  if (isNaN(start.getTime())) {
    return { ok: false, need: ["datetime_iso"], message: "Thời gian chưa đúng định dạng. Bạn gửi lại giúp mình nhé." };
  }

//   // Resolve service mapping (nếu bạn muốn dùng service name)
//   let resolved = null;
//   if (service && !serviceId) {
//     const key = String(service).trim().toLowerCase();
//     resolved = SERVICE_MAP[key] || null;
//   }

const finalCustomerId = customerId ? Number(customerId) : pickRandom(DEFAULTS.customers);
const finalStaffId = staffId ? Number(staffId) : pickRandom(DEFAULTS.staffs);
const finalServiceId = serviceId ? Number(serviceId) : pickRandom(DEFAULTS.services);

    // duration
    const finalDurationMin = Number(durationMin || process.env.BOOKING_DEFAULT_DURATION_MIN || 60);
    const end = addMinutes(start, finalDurationMin);

  // Nếu POS bắt buộc serviceId mà bạn chưa có mapping
  if (!finalServiceId) {
    return {
      ok: false,
      need: ["service"],
      message: "Bạn muốn đặt dịch vụ nào ạ? (Mình cần dịch vụ để tạo lịch trên POS)"
    };
  }

  const payload = {
    customerId: finalCustomerId,
    group: Number(process.env.POS_DEFAULT_GROUP_ID || 1656),
    items: [
      {
        startTime: toMMDDYYYY_HHMM(start),
        endTime: toMMDDYYYY_HHMM(end),
        requestStaff: true,
        serviceIds: [finalServiceId],
        staffId: finalStaffId
      }
    ],
    note: String(note || "Booking từ AI.").trim(),
    referenceId: `ai_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    sourceType: "ai_chat"
  };

  const url = "https://api.ontiloo.com/api/v1/open-api/appointments";

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.POS_API_KEY,
        "Authorization": `Bearer ${process.env.POS_BEARER_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const data = await r.json().catch(() => ({}));
    const isAuth = r.status === 401 || r.status === 403;

    if (!r.ok || data?.statusCode !== 200) {
      return {
        ok: false,
        error: isAuth ? "POS_AUTH_FAILED" : "POS_BOOKING_FAILED",
        detail: { status: r.status, data },
        message: isAuth
          ? "Mình chưa đặt được trên POS do lỗi xác thực. Bạn nhắn mình thử lại sau 1–2 phút nhé."
          : "Khung giờ này có thể đang bận hoặc dữ liệu chưa hợp lệ. Bạn chọn giúp mình khung giờ khác được không?"
      };
    }

    const bookingId = data?.data || data?.id || data?.bookingId || payload.referenceId;

    return {
      ok: true,
      booking_id: bookingId,
      result: `✅ Đã ghi nhận lịch lúc ${toMMDDYYYY_HHMM(start)}. Mã lịch: ${bookingId}`,
      data
    };
  } catch (e) {
    return { ok: false, error: "POS_BOOKING_EXCEPTION", detail: String(e), message: "Hệ thống gặp lỗi khi tạo lịch. Bạn thử lại giúp mình nhé." };
  }
}
