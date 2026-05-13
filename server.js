const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "schedule.json");
const REQUEST_FILE = path.join(__dirname, "requests.json");
const STAFF_NAMES_FILE = path.join(__dirname, "staffNames.json");
const HISTORY_FILE = path.join(__dirname, "history.json");
const ADMIN_PASSWORD = "passward";

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

function createSlots(start, end, positions) {
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);
  const slots = [];
  let current = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  while (current < endMinutes) {
    const next = current + 30;
    const label = `${formatTime(current)}〜${formatTime(next)}`;
    const assignments = positions.reduce((acc, position) => {
      acc[position] = [];
      return acc;
    }, {});
    slots.push({ label, assignments });
    current = next;
  }

  return slots;
}

function normalizeData(data) {
  if (!data.schedule) return data;
  ["1", "2"].forEach((day) => {
    if (data.schedule[day]) {
      data.schedule[day].forEach((slot) => {
        Object.keys(slot.assignments).forEach((position) => {
          const val = slot.assignments[position];
          if (val === null || val === undefined) {
            slot.assignments[position] = [];
          } else if (typeof val === "number") {
            slot.assignments[position] = [val];
          } else if (!Array.isArray(val)) {
            slot.assignments[position] = [];
          }
        });
      });
    }
  });
  return data;
}

function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour}:${minute.toString().padStart(2, "0")}`;
}

function initialData() {
  const positions = ["調理", "接客", "レジ", "呼び込み"];
  return {
    schedule: {
      "1": createSlots("9:00", "12:00", positions),
      "2": createSlots("9:00", "15:00", positions),
    },
    updatedAt: new Date().toISOString(),
  };
}

function loadData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return normalizeData(data);
  } catch (error) {
    return initialData();
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function loadRequests() {
  try {
    return JSON.parse(fs.readFileSync(REQUEST_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function saveRequests(requests) {
  fs.writeFileSync(REQUEST_FILE, JSON.stringify(requests, null, 2), "utf8");
}

function loadStaffNames() {
  try {
    return JSON.parse(fs.readFileSync(STAFF_NAMES_FILE, "utf8"));
  } catch (error) {
    return {};
  }
}

function saveStaffNames(names) {
  fs.writeFileSync(STAFF_NAMES_FILE, JSON.stringify(names, null, 2), "utf8");
}

function loadHistory() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, "utf8"));
  } catch (error) {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), "utf8");
}

app.get("/api/schedule", (req, res) => {
  res.json(loadData());
});

app.get("/api/requests", (req, res) => {
  res.json({ ok: true, requests: loadRequests() });
});

app.get("/api/staff-names", (req, res) => {
  res.json({ ok: true, names: loadStaffNames() });
});

app.get("/api/public-data", (req, res) => {
  const data = loadData();
  res.json({
    ok: true,
    schedule: data.schedule,
    staffNames: loadStaffNames(),
    updatedAt: data.updatedAt,
  });
});

app.get("/api/history", (req, res) => {
  res.json({ ok: true, history: loadHistory() });
});

app.post("/api/history", (req, res) => {
  const { password, change } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: "管理者権限が必要です" });
  }

  if (!change || !change.description) {
    return res.status(400).json({ ok: false, message: "変更内容を指定してください" });
  }

  const history = loadHistory();
  const newEntry = {
    id: history.length + 1,
    description: change.description,
    timestamp: new Date().toISOString(),
  };
  history.push(newEntry);
  saveHistory(history);
  res.json({ ok: true, entry: newEntry });
});

app.post("/api/request", (req, res) => {
  const { staffId, message } = req.body;
  if (!staffId || !message || typeof message !== "string") {
    return res.status(400).json({ ok: false, message: "スタッフ番号とリクエスト内容を入力してください。" });
  }

  const requests = loadRequests();
  const newRequest = {
    id: requests.length + 1,
    staffId,
    message,
    createdAt: new Date().toISOString(),
  };
  requests.push(newRequest);
  saveRequests(requests);
  res.json({ ok: true, request: newRequest });
});

app.post("/api/login", (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ ok: true, admin: true });
  }
  res.status(401).json({ ok: false, message: "パスワードが違います" });
});

app.post("/api/schedule", (req, res) => {
  const { password, schedule } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, message: "管理者権限が必要です" });
  }

  if (!schedule || !schedule["1"] || !schedule["2"]) {
    return res.status(400).json({ ok: false, message: "不正なスケジュール形式です" });
  }

  const payload = {
    schedule,
    updatedAt: new Date().toISOString(),
  };
  saveData(payload);

  // 履歴に追加
  const history = loadHistory();
  const newEntry = {
    id: history.length + 1,
    description: "スケジュールが更新されました",
    timestamp: new Date().toISOString(),
  };
  history.push(newEntry);
  saveHistory(history);

  res.json({ ok: true, updatedAt: payload.updatedAt });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
