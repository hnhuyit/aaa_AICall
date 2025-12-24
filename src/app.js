// src/app.js
import express from "express";
import morgan from "morgan";
// import bodyParser from "body-parser";
import z from "zod";
import cors from "cors";
import webhookRoutes from "./routes/webhook.routes.js";
import { logRequest } from "./middlewares/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { createBookingPOS } from "./services/posBooking.js";


import { Retell } from "retell-sdk";

const app = express();

// Định nghĩa các endpoint không cần kiểm tra API key
// const allowedPaths = ["/webhook", "/fb-webhook", "/ig-webhook", "/messaging-webhook", "/public", "/health"];


// Static files (nếu có)
// app.use(express.static("public"));

// app.use((req, res, next) => {
//   // Nếu đường dẫn nằm trong danh sách allowedPaths thì bỏ qua kiểm tra token
//   if (allowedPaths.includes(req.path)) return next();

//   // Lấy giá trị API key từ header và biến môi trường (mặc định "your-secret-token" nếu chưa cài đặt)
//   const apiKeyHeader = req.headers["x-api-key"];
//   const expectedApiKey = process.env.API_KEY || "your-secret-token";

//   // Nếu không gửi API key
//   if (!apiKeyHeader) {
//     console.warn(`⚠️ Missing API key for ${req.method} ${req.path}`);
//     return res.status(401).json({ error: "No API key provided" });
//   }

//   // Kiểm tra API key có khớp không
//   if (apiKeyHeader !== expectedApiKey) {
//     console.warn(`⚠️ Unauthorized access on ${req.method} ${req.path} with API key: ${apiKeyHeader}`);
//     return res.status(401).json({ error: "Unauthorized" });
//   }

//   next();
// });


// Parse JSON và lưu raw body nếu cần xác thực chữ ký
// app.use(bodyParser.json({
//   verify: (req, res, buf) => { req.rawBody = buf.toString("utf8"); }
// }));
app.use(express.json({
  limit: "1mb",
  verify: (req, res, buf) => { req.rawBody = buf.toString("utf8"); }
}));
// Ghi log bằng morgan & middleware custom
app.use(cors());
// app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(logRequest);


// // Simple auth middleware (tùy cách Retell gửi secret; bạn chỉnh header cho khớp)
// function verifyRetell(req, res, next) {  
//   console.log("Verify retell", 222)
//   if (!RETELL_WEBHOOK_SECRET) return next(); // cho phép chạy dev

//   const token =
//     req.headers["x-retell-secret"] ||
//     req.headers["x-webhook-secret"] ||
//     req.headers["authorization"];

//   const normalized = Array.isArray(token) ? token[0] : token;
//   const value = (normalized || "").replace(/^Bearer\s+/i, "").trim();

//   if (value !== RETELL_WEBHOOK_SECRET) {
//     return res.status(401).json({
//       ok: false,
//       message: "Unauthorized webhook",
//       error: { code: "UNAUTHORIZED" },
//     });
//   }

//   next();
// }


// function verifyRetell(req, res, next) {
//   if (!process.env.RETELL_WEBHOOK_SECRET) return next(); // dev allow

//   const signature = req.header("X-Retell-Signature") || "";
//   const raw = req.rawBody || "";

//   const ok = Retell.verify(raw, process.env.RETELL_WEBHOOK_SECRET, signature);
//   if (!ok) {
//     return res.status(401).json({ ok: false, message: "Invalid signature" });
//   }
//   next();
// }

function verifyRetell(req, res, next) {
  if (process.env.NODE_ENV !== "production") return next();

  if (!process.env.RETELL_API_KEY) {
    return res.status(500).json({ ok: false, message: "Server misconfigured: missing RETELL_API_KEY" });
  }


  const signature = req.header("X-Retell-Signature");
  if (!signature) {
    return res.status(401).json({ ok: false, message: "Missing Retell signature" });
  }

  const raw = req.rawBody || "";
  const ok = Retell.verify(
    raw,
    process.env.RETELL_API_KEY,
    signature
  );

  if (!ok) {
    return res.status(401).json({ ok: false, message: "Invalid Retell signature" });
  }

  next();
}


// ====== SCHEMAS (bạn thay theo payload Retell thực tế) ======
const FunctionCallSchema = z.object({
  // Retell thường: name, args
  name: z.string().optional(),
  args: z.record(z.any()).optional(),

  // fallback kiểu bạn đang dùng: function, arguments
  function: z.string().optional(),
  arguments: z.record(z.any()).optional(),

  call_id: z.string().optional(),
  conversation_id: z.string().optional(),
  call: z.any().optional()
}).refine(d => (d.name || d.function), { message: "Missing function name" });


// ====== BUSINESS FUNCTION SCHEMAS ======
const UpdateApptDetailArgs = z.object({
  appointment_id: z.string().min(1),
  // ISO hoặc string, tuỳ bạn
  new_time_iso: z.string().min(1).optional(),
  note: z.string().optional(),
});

// ====== FUNCTION HANDLERS ======
async function updateApptDetail(args, context) {
  const parsed = UpdateApptDetailArgs.safeParse(args);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Missing/invalid fields for update_appt_detail",
      error: {
        code: "VALIDATION_ERROR",
        details: parsed.error.flatten(),
      },
    };
  }

  const { appointment_id, new_time_iso, note } = parsed.data;

  // TODO: Call POS / Airtable / DB ở đây
  // ví dụ giả lập:
  const updated = {
    appointment_id,
    updated_time: new_time_iso || null,
    note: note || null,
    status: "UPDATED",
  };

  return {
    ok: true,
    result: `Appointment ${appointment_id} updated successfully.`,
    data: updated,
  };
}

// async function createBooking(args) {
//   return { ok: true, result: "Booking created (stub).", data: args };
// }

async function createBooking(args, context) {
  // args là payload từ Retell function call
  // ví dụ mong muốn: { datetime_iso, note, service? ... }

  const result = await createBookingPOS({
    datetime_iso: args.datetime_iso,
    datetime_text: args.datetime_text,
    note: args.note,
    service: args.service,          // optional
    customerId: args.customerId,    // optional
    staffId: args.staffId,          // optional
    serviceId: args.serviceId,      // optional
    durationMin: args.durationMin   // optional
  });

  // Chuẩn hóa response để Agent dễ đọc
  if (!result.ok) {
    return {
      ok: false,
      need: result.need || [],
      result: result.message || "Mình chưa tạo được lịch. Bạn cho mình thêm thông tin nhé.",
      error: result.error,
      detail: result.detail
    };
  }

  return {
    ok: true,
    booking_id: result.booking_id,
    result: result.result, // string cho agent nói lại
    data: result.data
  };
}


// Map function name -> handler
const handlers = {
  update_appt_detail: updateApptDetail,
  create_booking: createBooking,
  // check_availability: checkAvailability,
  // cancel_appointment: cancelAppointment,
};

// ====== ENDPOINT ======
// Gợi ý: set URL này vào Retell function webhook
app.post("/retell/functions", verifyRetell, async (req, res) => {

  console.log("Gọi đào", 1111)
  // 1) parse payload chung
  const parsed = FunctionCallSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      message: "Invalid webhook payload",
      error: { code: "BAD_PAYLOAD", details: parsed.error.flatten() },
    });
  }

  // const { function: fnName, arguments: args, call_id, conversation_id } = parsed.data;
  const fnName = parsed.data.name || parsed.data.function;
  const args = parsed.data.args || parsed.data.arguments || {};
  const { call_id, conversation_id } = parsed.data;

  // 2) route theo function name
  const handler = handlers[fnName];
  if (!handler) {
    return res.status(404).json({
      ok: false,
      message: `Unknown function: ${fnName}`,
      error: { code: "FUNCTION_NOT_FOUND" },
    });
  }

  // 3) run business handler
  try {
    const result = await handler(args, { call_id, conversation_id });

    // IMPORTANT: Retell thường cần JSON “gọn & chắc”
    // Bạn giữ consistent fields để Agent dễ đọc
    return res.status(200).json(result);
  } catch (err) {
    console.error("Function error:", err);
    return res.status(500).json({
      ok: false,
      message: "Function execution failed",
      error: { code: "INTERNAL_ERROR" },
    });
  }
});

// Đăng ký route – các endpoint liên quan đến webhook và hash
app.use("/", webhookRoutes);

// Định nghĩa các endpoint khác
app.get('/health', (req, res) => {
  res.json({ status: "ok" });
});

// Các route khác (vd: homepage)
app.get("/", (req, res) => {
  res.send("This is homepagedd.");
});

// Centralized error handler
app.use(errorHandler);

export default app;
