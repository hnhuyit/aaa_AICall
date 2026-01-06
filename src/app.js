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



/////////////////////

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "apptmh0D4kfxxCTn1";
const MEMBERS_TABLE = process.env.MEMBERS_TABLE || "Customers";

const FIELD_MEMBER_NAME = process.env.FIELD_MEMBER_NAME || "Name";
const FIELD_MEMBER_PHONE = process.env.FIELD_MEMBER_PHONE || "phone";
const FIELD_DELETED = process.env.FIELD_DELETED || "deleted_flag";
const FIELD_CREATED = process.env.FIELD_CREATED || "Created";


// ====== Airtable helpers ======
const AIRTABLE_API = "https://api.airtable.com/v0";

function airtableHeaders() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

// Normalize phone: keep digits, convert +84... -> 0...
function normalizePhone(raw = "") {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) return "0" + digits.slice(2);
  return digits;
}

function normalizeName(raw = "") {
  return String(raw).trim().replace(/\s+/g, " ");
}

function mustISO(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO datetime: ${s}`);
  return s;
}

function addMinutes(iso, minutes) {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

function toTime(v) {
  const t = new Date(v || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}
// ===== Helpers =====
function ok(id, result, headers = {}) {
  return { status: 200, body: { jsonrpc: "2.0", id, result }, headers };
}
function err(id, code, message, headers = {}) {
  return { status: 200, body: { jsonrpc: "2.0", id, error: { code, message } }, headers };
}

// ===== MCP TOOLS =====
const TOOLS = [
  {
    name: "lookupByPhone",
    description:
      "Lookup a member by phone number. Normalizes phone input, filters deleted_flag=false. If multiple records exist, returns the newest record. Returns found=false if no matching member is found.",
    inputSchema: {
      type: "object",
      properties: { phone: { type: "string" } },
      required: ["phone"],
      additionalProperties: false,
    },
  },
  {
    name: "lookupByName",
    description:
      "Lookup members by name (partial match). Filters deleted_flag=false, returns up to 5 newest matches with phone_last4.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  ////////////////////
  {
    name: "calendarCheckAvailability",
    description:
      "Check calendar availability for a service/time range. Returns available=true/false and optional conflicts.",
    inputSchema: {
      type: "object",
      properties: {
        // location_id: { type: "string", description: "Location / business unit id" },
        service_id: { type: "string", description: "Service identifier" },
        staff_id: { type: "string", description: "Staff/agent identifier (optional if not required)" },
        start_iso: { type: "string", description: "ISO datetime with timezone, e.g. 2026-01-06T14:00:00+07:00" },
        end_iso: { type: "string", description: "ISO datetime with timezone" },
      },
      required: ["service_id", "start_iso", "end_iso"],
      additionalProperties: false,
    },
  },

  {
    name: "calendarSuggestAlternatives",
    description:
      "Suggest alternative available slots near a desired time. Returns up to N slot options.",
    inputSchema: {
      type: "object",
      properties: {
        // location_id: { type: "string" },
        service_id: { type: "string" },
        staff_id: { type: "string" },
        desired_start_iso: { type: "string" },
        duration_minutes: { type: "integer", minimum: 5, maximum: 600 },
        window_hours: { type: "integer", minimum: 1, maximum: 168, description: "Search window around desired time" },
        limit: { type: "integer", minimum: 1, maximum: 10 },
      },
      required: ["service_id", "desired_start_iso", "duration_minutes"],
      additionalProperties: false,
    },
  },

  {
    name: "calendarConfirmBooking",
    description:
      "Create/confirm a booking. Requires verified availability. Returns booking_id and confirmed details.",
    inputSchema: {
      type: "object",
      properties: {
        // location_id: { type: "string" },
        service_id: { type: "string" },
        staff_id: { type: "string" },
        start_iso: { type: "string" },
        end_iso: { type: "string" },

        // customer identity
        phone: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },

        // optional notes / tags
        note: { type: "string" },
        source: { type: "string", description: "e.g. voice_call, sms, chat" },
      },
      required: ["service_id", "start_iso", "end_iso", "phone", "name"],
      additionalProperties: false,
    },
  },

  {
    name: "calendarCancelOrChange",
    description:
      "Cancel or reschedule an existing booking. Provide booking_id. For reschedule, include new_start_iso/new_end_iso.",
    inputSchema: {
      type: "object",
      properties: {
        booking_id: { type: "string" },
        action: { type: "string", enum: ["cancel", "reschedule"] },
        new_start_iso: { type: "string" },
        new_end_iso: { type: "string" },
        reason: { type: "string" },
      },
      required: ["booking_id", "action"],
      additionalProperties: false,
    },
  },
];

async function airtableList({ tableName, filterByFormula, fields = [], pageSize = 100 }) {
  const params = new URLSearchParams();
  if (filterByFormula) params.set("filterByFormula", filterByFormula);
  for (const f of fields) params.append("fields[]", f);
  params.set("pageSize", String(pageSize));

  const url = `${AIRTABLE_API}/${AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}?${params.toString()}`;
  const r = await fetch(url, { headers: airtableHeaders() });
  const data = await r.json();
  if (!r.ok) throw new Error(`Airtable error (${r.status}): ${JSON.stringify(data)}`);
  return data.records || [];
}

// ===== TOOL IMPLEMENTATION =====
async function lookupByPhone({ phone }) {
  console.log("lookupByPhone")
  const p = normalizePhone(phone);
  if (!p) {
    return { content: [{ type: "text", text: JSON.stringify({ found: false, count: 0, members: [] }) }] };
  }

  // Airtable formula: AND({Phone}="0987...", NOT({deleted}))
  // Checkbox deleted: TRUE/blank
  const formula = `AND({${FIELD_MEMBER_PHONE}}="${p}", NOT({${FIELD_DELETED}}))`;

  const records = await airtableList({
    tableName: MEMBERS_TABLE,
    filterByFormula: formula,
    fields: [
      FIELD_MEMBER_NAME,
      FIELD_MEMBER_PHONE,
      // "Chapter",
      // "Department",
      "member_status",
      FIELD_DELETED,
      FIELD_CREATED,
    ],
  });

  // newest first
  records.sort((a, b) => toTime(b.fields?.[FIELD_CREATED]) - toTime(a.fields?.[FIELD_CREATED]));

  const top = records[0];
  const members = top
    ? [
        {
          member_id: top.id,
          Name: top.fields?.[FIELD_MEMBER_NAME] || "",
          // chapter: top.fields?.["Chapter"] || "",
          // department: top.fields?.["Department"] || "",
          member_status: top.fields?.["member_status"] || "",
        },
      ]
    : [];

  const payload = { found: members.length > 0, count: records.length, members };

  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

async function lookupByName({ name }) {
  console.log("lookupByName")
  const n = normalizeName(name);
  if (!n) {
    return { content: [{ type: "text", text: JSON.stringify({ found: false, count: 0, members: [] }) }] };
  }

  // SEARCH("Nguyễn Văn A",{FullName}) is case-insensitive
  // Escape quotes for formula safety
  const safe = n.replace(/"/g, '\\"');

  const formula = `AND(SEARCH("${safe}", {${FIELD_MEMBER_NAME}}), NOT({${FIELD_DELETED}}))`;

  const records = await airtableList({
    tableName: MEMBERS_TABLE,
    filterByFormula: formula,
    fields: [
      FIELD_MEMBER_NAME,
      FIELD_MEMBER_PHONE,
      // "Chapter",
      // "Department",
      "member_status",
      FIELD_DELETED,
      FIELD_CREATED,
    ],
  });

  // newest first
  records.sort((a, b) => toTime(b.fields?.[FIELD_CREATED]) - toTime(a.fields?.[FIELD_CREATED]));

  const members = records.slice(0, 5).map((r) => {
    const last4 = normalizePhone(r.fields?.[FIELD_MEMBER_PHONE] || "").slice(-4);
    return {
      member_id: r.id,
      Name: r.fields?.[FIELD_MEMBER_NAME] || "",
      phone_last4: last4,
      // chapter: r.fields?.["Chapter"] || "",
      // department: r.fields?.["Department"] || "",
      member_status: r.fields?.["member_status"] || "",
    };
  });

  const payload = { found: members.length > 0, count: records.length, members };

  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

async function calendarCheckAvailability(args) {
  const {
    // location_id,
    service_id,
    staff_id,
    start_iso,
    end_iso,
  } = args;

  mustISO(start_iso);
  mustISO(end_iso);

  // TODO: Replace with real check (GHL Calendar / your DB)
  // Example stub: assume business hours 09:00-18:00 and no conflicts
  const available = true;

  return {
    ok: true,
    available,
    // location_id,
    service_id,
    staff_id: staff_id || null,
    start_iso,
    end_iso,
    message: available
      ? "Slot is available."
      : "Slot is not available.",
  };
}

async function calendarSuggestAlternatives(args) {
  const {
    // location_id,
    service_id,
    staff_id,
    desired_start_iso,
    duration_minutes,
    window_hours = 24,
    limit = 5,
  } = args;

  mustISO(desired_start_iso);

  // TODO: Replace with real slot search
  // Very simple stub: suggest next N slots every 60 minutes
  const suggestions = [];
  let cursor = new Date(desired_start_iso);

  for (let i = 0; i < limit; i++) {
    cursor.setHours(cursor.getHours() + 1);
    const start = cursor.toISOString();
    const end = new Date(cursor);
    end.setMinutes(end.getMinutes() + duration_minutes);
    suggestions.push({ start_iso: start, end_iso: end.toISOString() });
  }

  return {
    ok: true,
    // location_id,
    service_id,
    staff_id: staff_id || null,
    desired_start_iso,
    duration_minutes,
    window_hours,
    suggestions,
    message: suggestions.length
      ? "Here are alternative slots."
      : "No alternatives found.",
  };
}

async function calendarConfirmBooking(args) {
  const {
    // location_id,
    service_id,
    staff_id,
    start_iso,
    end_iso,
    phone,
    name,
    email,
    note,
    source,
  } = args;

  mustISO(start_iso);
  mustISO(end_iso);

  // 1) Always re-check availability before creating booking (important)
  const check = await calendarCheckAvailability({
    // location_id,
    service_id,
    staff_id,
    start_iso,
    end_iso,
  });

  if (!check.available) {
    return {
      ok: true,
      confirmed: false,
      available: false,
      booking_id: null,
      start_iso,
      end_iso,
      message: "That time is not available. Please choose another slot.",
    };
  }

  // 2) TODO: Create booking in real system
  // Replace with GHL booking creation / DB insert.
  const booking_id = `bk_${Date.now()}`;

  return {
    ok: true,
    confirmed: true,
    available: true,
    booking_id,
    // location_id,
    service_id,
    staff_id: staff_id || null,
    start_iso,
    end_iso,
    customer: {
      phone,
      name,
      email: email || null,
    },
    note: note || null,
    source: source || "voice_call",
    message: "Booking confirmed.",
  };
}

async function calendarCancelOrChange(args) {
  const { booking_id, action, new_start_iso, new_end_iso, reason } = args;

  if (action === "reschedule") {
    mustISO(new_start_iso);
    mustISO(new_end_iso);

    // TODO: check availability + update booking
    const available = true;

    if (!available) {
      return {
        ok: true,
        updated: false,
        booking_id,
        action,
        message: "New time is not available.",
      };
    }

    // TODO: update booking in your system
    return {
      ok: true,
      updated: true,
      booking_id,
      action,
      new_start_iso,
      new_end_iso,
      reason: reason || null,
      message: "Booking rescheduled.",
    };
  }

  // action === "cancel"
  // TODO: cancel booking in your system
  return {
    ok: true,
    updated: true,
    booking_id,
    action,
    reason: reason || null,
    message: "Booking cancelled.",
  };
}


// ====== POST /mcp (JSON-RPC) ======
async function handler(req, res) {
  console.log("handler", 111)
  try {
    const { id, method, params } = req.body || {};

    if (!method) {
      const out = err(id ?? null, 32600, "Invalid Request");
      return res.status(out.status).json(out.body);
    }

    if (method === "initialize") {
      const out = ok(id, {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "jci-mcp", version: "1.0.0" },
        capabilities: { tools: {} },
      });
      return res.status(out.status).json(out.body);
    }

    if (method === "tools/list") {
      const out = ok(id, { tools: TOOLS });
      return res.status(out.status).json(out.body);
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (!toolName) {
        const out = err(id, 32602, "Missing tool name");
        return res.status(out.status).json(out.body);
      }

      if (toolName === "lookupByPhone") {
        const result = await lookupByPhone(args);
        const out = ok(id, result);
        return res.status(out.status).json(out.body);
      }

      if (toolName === "lookupByName") {
        const result = await lookupByName(args);
        const out = ok(id, result);
        return res.status(out.status).json(out.body);
      }

      if (toolName === "calendarCheckAvailability") {
        const result = await calendarCheckAvailability(args);
        const out = ok(id, result);
        return res.status(out.status).json(out.body);
      }

      if (toolName === "calendarSuggestAlternatives") {
        const result = await calendarSuggestAlternatives(args);
        const out = ok(id, result);
        return res.status(out.status).json(out.body);
      }

      if (toolName === "calendarConfirmBooking") {
        const result = await calendarConfirmBooking(args);
        const out = ok(id, result);
        return res.status(out.status).json(out.body);
      }

      if (toolName === "calendarCancelOrChange") {
        const result = await calendarCancelOrChange(args);
        const out = ok(id, result);
        return res.status(out.status).json(out.body);
      }

      const out = err(id, 32601, `Unknown tool: ${toolName}`);
      return res.status(out.status).json(out.body);
    }

    const out = err(id, 32601, `Method not found: ${method}`);
    return res.status(out.status).json(out.body);

  } catch (e) {
    console.error("MCP error:", e);
    return res.status(200).json({
      jsonrpc: "2.0",
      id: req.body?.id ?? null,
      error: { code: 32000, message: String(e?.message || e) },
    });
  }
}

// ===== GET /mcp  (SSE keep-alive) =====
function handlerOrSSE(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // ping mỗi 15s để giữ kết nối
  const timer = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(timer);
  });
}

// ===== ROUTES =====
app.post("/mcp", handler);
app.get("/mcp", handlerOrSSE);

function requireAuth(req, res, next) {
  if (NO_AUTH) return next();

  const auth = req.headers["authorization"] || "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : null;

  const apiKey = req.headers["x-api-key"] ? String(req.headers["x-api-key"]) : null;
  const token = bearer || apiKey;

  if (!token || token !== process.env.MCP_ACCESS_TOKEN) {
    return res.status(401).json({ error: { message: "Unauthorized" } });
  }
  next();
}

const NO_AUTH = String(process.env.MCP_NO_AUTH || "").toLowerCase() === "true";
app.use("/mcp", (req, res, next) => {
  if (true) return next();     // ✅ bypass auth
  return requireAuth(req, res, next);
});
/////////////////////////


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
