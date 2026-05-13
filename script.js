const positions = ["調理", "接客", "レジ", "呼び込み"];
const scheduleSection = document.getElementById("scheduleSection");
const daySelect = document.getElementById("daySelect");
const viewModeSelect = document.getElementById("viewModeSelect");
const positionSelect = document.getElementById("positionSelect");
const staffIdSelect = document.getElementById("staffIdSelect");
const assignButton = document.getElementById("assignButton");
const clearButton = document.getElementById("clearButton");
const openAdminButton = document.getElementById("openAdminButton");
const adminPanel = document.getElementById("adminPanel");
const loginSection = document.getElementById("loginSection");
const adminControlsSection = document.getElementById("adminControlsSection");
const adminPasswordInput = document.getElementById("adminPasswordInput");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const saveButton = document.getElementById("saveButton");
const exportCsvButton = document.getElementById("exportCsvButton");
const statusText = document.getElementById("statusText");
const requestsSection = document.getElementById("requestsSection");
const requestsList = document.getElementById("requestsList");
const historySection = document.getElementById("historySection");
const historyList = document.getElementById("historyList");
const requestStaffId = document.getElementById("requestStaffId");
const requestText = document.getElementById("requestText");
const sendRequestButton = document.getElementById("sendRequestButton");
const requestStatus = document.getElementById("requestStatus");
const shareLink = document.getElementById("shareLink");
const copyLinkButton = document.getElementById("copyLinkButton");
const adminControls = document.getElementById("adminControls");

const state = {
  selectedCell: null,
  schedule: null,
  isAdmin: false,
  adminPassword: "",
  unsaved: false,
  lastUpdated: "",
  staffNames: {},
  history: [],
  lastRequestCount: 0,
};

async function loadSchedule(showError = true) {
  try {
    const response = await fetch("/api/schedule");
    if (!response.ok) {
      throw new Error("サーバーからスケジュールを取得できませんでした。");
    }
    const data = await response.json();
    state.schedule = data.schedule;
    state.lastUpdated = data.updatedAt;
    state.unsaved = false;
    statusText.textContent = `最新データ取得: ${new Date(state.lastUpdated).toLocaleString()}  (${state.isAdmin ? "管理者" : "閲覧"})`;
  } catch (error) {
    if (showError) {
      statusText.textContent = "サーバー接続に失敗しました。ローカル表示を使用しています。";
    }
    if (!state.schedule) {
      state.schedule = {
        1: createScheduleSlots("9:00", "12:00"),
        2: createScheduleSlots("9:00", "15:00"),
      };
    }
  }
  render();
  loadStaffNames();
  loadHistory();
  loadRequests();
  renderHistory();
}

async function loadStaffNames() {
  try {
    const response = await fetch("/api/staff-names");
    if (response.ok) {
      const data = await response.json();
      state.staffNames = data.names;
    }
  } catch (error) {
    console.error("スタッフ名取得失敗:", error);
  }
}

async function loadHistory() {
  try {
    const response = await fetch("/api/history");
    if (response.ok) {
      const data = await response.json();
      state.history = data.history;
    }
  } catch (error) {
    console.error("履歴取得失敗:", error);
  }
}

async function loadRequests() {
  try {
    const response = await fetch("/api/requests");
    if (response.ok) {
      const data = await response.json();
      const requests = data.requests;
      requestsList.innerHTML = "";
      if (requests.length === 0) {
        requestsList.innerHTML = "<p>リクエストはありません。</p>";
      } else {
        requests.forEach((req) => {
          const item = document.createElement("div");
          item.className = "request-item";
          const name = state.staffNames[req.staffId] || '名前未設定';
          item.innerHTML = `
            <strong>${req.staffId}番 (${name})</strong><br>
            ${req.message}<br>
            <small>${new Date(req.createdAt).toLocaleString()}</small>
          `;
          requestsList.appendChild(item);
        });
      }
      requestsSection.classList.remove("hidden");

      // 通知: 新しいリクエストがあれば
      if (requests.length > state.lastRequestCount && state.lastRequestCount > 0) {
        showNotification("新しいリクエストが届きました。");
      }
      state.lastRequestCount = requests.length;
    }
  } catch (error) {
    console.error("リクエスト取得失敗:", error);
  }
}

function renderHistory() {
  if (!state.isAdmin) return;
  historyList.innerHTML = "";
  if (state.history.length === 0) {
    historyList.innerHTML = "<p>履歴はありません。</p>";
  } else {
    state.history.slice(-10).reverse().forEach((entry) => { // 最新10件
      const item = document.createElement("div");
      item.className = "history-item";
      item.innerHTML = `
        ${entry.description}<br>
        <small>${new Date(entry.timestamp).toLocaleString()}</small>
      `;
      historyList.appendChild(item);
    });
  }
  historySection.classList.remove("hidden");
}

function exportCsv() {
  if (!state.schedule) {
    alert("スケジュールデータがありません。");
    return;
  }

  let csv = "日,時間,調理,接客,レジ,呼び込み\n";

  [1, 2].forEach((day) => {
    state.schedule[day].forEach((slot) => {
      const row = [
        day,
        slot.label,
        (slot.assignments["調理"] || []).join("|"),
        (slot.assignments["接客"] || []).join("|"),
        (slot.assignments["レジ"] || []).join("|"),
        (slot.assignments["呼び込み"] || []).join("|"),
      ];
      csv += row.join(",") + "\n";
    });
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `shift_schedule_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function showNotification(message) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("シフト管理", { body: message });
  } else if ("Notification" in window && Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification("シフト管理", { body: message });
      }
    });
  }
}

function updateShareLink() {
  if (!shareLink) return;
  const url = window.location.href;
  shareLink.href = url;
  shareLink.textContent = url;
}

function copyShareLink() {
  if (!shareLink) return;
  const url = shareLink.href;
  if (!navigator.clipboard) {
    prompt("以下のリンクをコピーしてください:", url);
    return;
  }
  navigator.clipboard.writeText(url).then(
    () => alert("公開リンクをコピーしました。"),
    () => prompt("以下のリンクをコピーしてください:", url)
  );
}

function createScheduleSlots(start, end) {
  const slots = [];
  const [startHour, startMin] = start.split(":").map(Number);
  const [endHour, endMin] = end.split(":").map(Number);

  let current = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  while (current < endMinutes) {
    const next = current + 30;
    slots.push({
      label: formatTime(current) + "〜" + formatTime(next),
      assignments: positions.reduce((acc, position) => {
        acc[position] = null;
        return acc;
      }, {}),
    });
    current = next;
  }

  return slots;
}

function formatTime(minutes) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${hour}:${minute.toString().padStart(2, "0")}`;
}

function render() {
  scheduleSection.innerHTML = "";
  saveButton.disabled = !state.isAdmin || !state.unsaved;

  if (viewModeSelect.value === "position") {
    renderByPosition();
  } else {
    renderByNumber();
  }
}

function renderByPosition() {
  [1, 2].forEach((day) => {
    const card = document.createElement("div");
    card.className = "schedule-card";

    const title = document.createElement("h2");
    title.textContent = `${day}日目 (${day === 1 ? "9:00〜12:00" : "9:00〜15:00"})`;
    card.appendChild(title);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>時間</th>${positions.map((position) => `<th>${position}</th>`).join("")}`;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    state.schedule[day].forEach((slot, slotIndex) => {
      const row = document.createElement("tr");
      const timeCell = document.createElement("td");
      timeCell.textContent = slot.label;
      row.appendChild(timeCell);

      positions.forEach((position) => {
        const cell = document.createElement("td");
        cell.className = "assignable";
        const assignedList = slot.assignments[position] || [];
        if (assignedList.length === 0) {
          cell.textContent = "未割り当て";
          cell.classList.add("empty");
        } else {
          const container = document.createElement("div");
          assignedList.forEach((id) => {
            const staffDiv = document.createElement("div");
            staffDiv.className = "staff-item";
            const text = document.createElement("span");
            text.textContent = `${id}番 (${state.staffNames[id] || '名前未設定'})`;
            staffDiv.appendChild(text);
            if (state.isAdmin) {
              const deleteBtn = document.createElement("button");
              deleteBtn.className = "remove-staff";
              deleteBtn.textContent = "×";
              deleteBtn.dataset.staffId = id;
              deleteBtn.dataset.day = day;
              deleteBtn.dataset.slot = slotIndex;
              deleteBtn.dataset.position = position;
              staffDiv.appendChild(deleteBtn);
            }
            container.appendChild(staffDiv);
          });
          cell.innerHTML = "";
          cell.appendChild(container);
        }

        cell.dataset.day = day;
        cell.dataset.slot = slotIndex;
        cell.dataset.position = position;

        if (
          state.selectedCell &&
          state.selectedCell.day === day.toString() &&
          state.selectedCell.slot === slotIndex.toString() &&
          state.selectedCell.position === position
        ) {
          cell.classList.add("selected");
        }

        // 削除ボタンのイベントリスナー
        const deleteButtons = cell.querySelectorAll(".remove-staff");
        deleteButtons.forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            const staffId = Number(btn.dataset.staffId);
            const dayNum = Number(btn.dataset.day);
            const slotNum = Number(btn.dataset.slot);
            const pos = btn.dataset.position;
            const assignedList = state.schedule[dayNum][slotNum].assignments[pos];
            const idx = assignedList.indexOf(staffId);
            if (idx >= 0) {
              assignedList.splice(idx, 1);
              state.unsaved = true;
              render();
            }
          });
        });

        cell.addEventListener("click", () => selectCell(cell));
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    card.appendChild(table);
    scheduleSection.appendChild(card);
  });
}

function renderByNumber() {
  [1, 2].forEach((day) => {
    const card = document.createElement("div");
    card.className = "schedule-card";

    const title = document.createElement("h2");
    title.textContent = `${day}日目 (${day === 1 ? "9:00〜12:00" : "9:00〜15:00"})`;
    card.appendChild(title);

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const slotHeaders = state.schedule[day]
      .map((slot) => `<th>${slot.label}</th>`)
      .join("");
    headerRow.innerHTML = `<th>番号</th>${slotHeaders}`;
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    for (let number = 1; number <= 44; number += 1) {
      const row = document.createElement("tr");
      const numberCell = document.createElement("td");
      numberCell.textContent = `${number}番`;
      row.appendChild(numberCell);

      state.schedule[day].forEach((slot) => {
        const cell = document.createElement("td");
        const assignedPosition = positions.find((position) => {
          const list = slot.assignments[position] || [];
          return list.includes(number);
        });
        cell.textContent = assignedPosition ? assignedPosition : "";
        if (!assignedPosition) cell.classList.add("empty");
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    card.appendChild(table);
    scheduleSection.appendChild(card);
  });
}

function selectCell(cell) {
  if (!state.isAdmin) {
    alert("編集するには管理者ログインが必要です。パスワードを入力してください。");
    return;
  }

  state.selectedCell = {
    day: cell.dataset.day,
    slot: cell.dataset.slot,
    position: cell.dataset.position,
  };
  render();
}

function assignSelected() {
  if (!state.isAdmin) {
    alert("管理者ログインしてから、編集を行ってください。");
    return;
  }

  if (!state.selectedCell) {
    alert("まずセルを選択してください。");
    return;
  }

  const value = Number(staffIdSelect.value);
  if (!staffIdSelect.value || !Number.isInteger(value) || value < 1 || value > 44) {
    alert("スタッフ番号は 1番〜44番の中から選択してください。");
    return;
  }

  const { day, slot, position } = state.selectedCell;
  const assignedList = state.schedule[Number(day)][Number(slot)].assignments[position];
  if (!Array.isArray(assignedList)) {
    state.schedule[Number(day)][Number(slot)].assignments[position] = [];
  }
  if (assignedList.length >= 4) {
    alert("このセルは最大4人までしか追加できません。");
    return;
  }
  if (assignedList.includes(value)) {
    alert("このスタッフはすでに割り当てられています。");
    return;
  }
  assignedList.push(value);
  state.unsaved = true;
  render();
}

function clearSelection() {
  state.selectedCell = null;
  render();
}

function toggleAdminPanel() {
  adminPanel.classList.toggle("hidden");
  openAdminButton.textContent = adminPanel.classList.contains("hidden") ? "管理者ログイン" : "閉じる";
}

function setAdminUIVisibility(isAdmin) {
  if (adminControls) {
    adminControls.classList.toggle("hidden", !isAdmin);
  }
}

function handleLogout() {
  state.isAdmin = false;
  state.adminPassword = "";
  state.selectedCell = null;
  state.unsaved = false;
  loginSection.classList.remove("hidden");
  adminControlsSection.classList.add("hidden");
  openAdminButton.textContent = "管理者ログイン";
  setAdminUIVisibility(false);
  statusText.textContent = `閲覧モード: 最新データ ${state.lastUpdated ? new Date(state.lastUpdated).toLocaleString() : "未取得"}`;
  render();
}

async function sendRequest() {
  const staffId = requestStaffId.value;
  const message = requestText.value.trim();
  if (!staffId || !message) {
    requestStatus.textContent = "スタッフ番号とリクエスト内容を入力してください。";
    return;
  }

  try {
    const response = await fetch("/api/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staffId, message }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message || "送信に失敗しました。");
    }
    requestStaffId.value = "";
    requestText.value = "";
    requestStatus.textContent = "リクエストを送信しました。管理者が確認できます。";
  } catch (error) {
    requestStatus.textContent = error.message || "送信に失敗しました。";
  }
}

async function handleLogin() {
  const password = adminPasswordInput.value.trim();
  if (!password) {
    alert("管理者パスワードを入力してください。");
    return;
  }

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.message || "ログインに失敗しました。");
    }
    const result = await response.json();
    if (result.ok && result.admin) {
      state.isAdmin = true;
      state.adminPassword = password;
      adminPasswordInput.value = "";
      openAdminButton.textContent = "管理者モード";
      loginSection.classList.add("hidden");
      adminControlsSection.classList.remove("hidden");
      setAdminUIVisibility(true);
      statusText.textContent = `管理者モード: 有効 (${new Date(state.lastUpdated || Date.now()).toLocaleString()})`;
      render();
      loadRequests();
      renderHistory();
      return;
    }
    throw new Error(result.message || "パスワードが違います。");
  } catch (error) {
    alert(error.message || "管理者ログインに失敗しました。");
  }
}

async function saveSchedule() {
  if (!state.isAdmin) {
    alert("管理者でログインしてから保存してください。");
    return;
  }

  try {
    const response = await fetch("/api/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: state.adminPassword, schedule: state.schedule }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.message || "保存に失敗しました。");
    }
    const result = await response.json();
    state.unsaved = false;
    state.lastUpdated = result.updatedAt;
    statusText.textContent = `保存完了: ${new Date(state.lastUpdated).toLocaleString()}`;
    render();
  } catch (error) {
    alert(error.message || "保存に失敗しました。");
  }
}

assignButton.addEventListener("click", assignSelected);
clearButton.addEventListener("click", clearSelection);
viewModeSelect.addEventListener("change", render);
openAdminButton.addEventListener("click", toggleAdminPanel);
loginButton.addEventListener("click", handleLogin);
logoutButton.addEventListener("click", handleLogout);
saveButton.addEventListener("click", saveSchedule);
exportCsvButton.addEventListener("click", exportCsv);
sendRequestButton.addEventListener("click", sendRequest);
copyLinkButton?.addEventListener("click", copyShareLink);

loadSchedule();
updateShareLink();
setInterval(() => {
  if (!state.isAdmin || !state.unsaved) {
    loadSchedule(false);
  }
  loadRequests();
}, 15000);
