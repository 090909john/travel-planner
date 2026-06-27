const DEFAULT_DAYS = 5;
const MIN_DAYS = 1;
const MAX_DAYS = 30;
const STORAGE_KEY = "github-pages-trip-planner-v1";
const DEFAULT_PAGE_TITLE = "旅遊行程規劃";
const SHARE_URL_WARNING_LENGTH = 7000;

const initialParams = new URLSearchParams(window.location.search);

if (initialParams.get("fresh") === "1") {
  localStorage.removeItem(STORAGE_KEY);
  window.history.replaceState({}, document.title, window.location.pathname);
}

const typeLabels = {
  place: "景點",
  food: "美食",
  link: "連結",
  youtube: "YouTube",
  note: "文字"
};

const typeFallbacks = {
  place: "景點",
  food: "美食",
  link: "LINK",
  youtube: "YT",
  note: "NOTE"
};

const defaultState = {
  title: "",
  startDate: "",
  budget: "",
  packingList: "",
  activeDay: 0,
  selectedType: "place",
  days: Array.from({ length: DEFAULT_DAYS }, () => [])
};

loadPlanFromUrl();

let state = loadState();
let dragIndex = null;

const els = {
  tripTitle: document.querySelector("#tripTitle"),
  pageTitle: document.querySelector("#pageTitle"),
  startDate: document.querySelector("#startDate"),
  budget: document.querySelector("#budget"),
  packingList: document.querySelector("#packingList"),
  tripStats: document.querySelector("#tripStats"),
  dayTabs: document.querySelector("#dayTabs"),
  activeDayTitle: document.querySelector("#activeDayTitle"),
  activeDayDate: document.querySelector("#activeDayDate"),
  itemForm: document.querySelector("#itemForm"),
  itemTitle: document.querySelector("#itemTitle"),
  itemTime: document.querySelector("#itemTime"),
  itemUrl: document.querySelector("#itemUrl"),
  itemNote: document.querySelector("#itemNote"),
  dayCount: document.querySelector("#dayCount"),
  decreaseDaysBtn: document.querySelector("#decreaseDaysBtn"),
  increaseDaysBtn: document.querySelector("#increaseDaysBtn"),
  timeline: document.querySelector("#timeline"),
  sharePlanBtn: document.querySelector("#sharePlanBtn"),
  shareBlankBtn: document.querySelector("#shareBlankBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  importInput: document.querySelector("#importInput"),
  resetBtn: document.querySelector("#resetBtn"),
  template: document.querySelector("#itemTemplate")
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.days)) return structuredClone(defaultState);
    return {
      ...structuredClone(defaultState),
      ...saved,
      days: normalizeDays(saved.days)
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function loadPlanFromUrl() {
  const encodedPlan = initialParams.get("plan");
  if (!encodedPlan) return;

  try {
    const imported = sanitizeImportedState(decodePlan(encodedPlan));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(imported));
    window.history.replaceState({}, document.title, window.location.pathname);
  } catch {
    alert("分享連結載入失敗，可能是網址不完整或資料已損壞。");
  }
}

function sanitizeImportedState(imported) {
  if (!imported || !Array.isArray(imported.days)) throw new Error("Invalid plan");
  const nextState = {
    ...structuredClone(defaultState),
    ...imported,
    days: normalizeDays(imported.days)
  };
  nextState.activeDay = Math.min(Math.max(Number(nextState.activeDay) || 0, 0), nextState.days.length - 1);
  return nextState;
}

function encodePlan(plan) {
  const json = JSON.stringify(plan);
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodePlan(encodedPlan) {
  const base64 = encodedPlan.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function normalizeDays(days) {
  const safeDays = Array.isArray(days) && days.length ? days : defaultState.days;
  const dayCount = Math.min(Math.max(safeDays.length, MIN_DAYS), MAX_DAYS);
  return Array.from({ length: dayCount }, (_, index) => safeDays[index] || []);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderStats();
}

function toDateLabel(dayIndex) {
  if (!state.startDate) return "尚未設定日期";
  const date = new Date(`${state.startDate}T00:00:00`);
  date.setDate(date.getDate() + dayIndex);
  return new Intl.DateTimeFormat("zh-Hant", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function getYouTubeId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return parsed.pathname.slice(1);
    if (parsed.hostname.includes("youtube.com")) {
      if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
      const shortsMatch = parsed.pathname.match(/\/shorts\/([^/?]+)/);
      if (shortsMatch) return shortsMatch[1];
    }
  } catch {
    return "";
  }
  return "";
}

function getPreview(item) {
  const url = item.url?.trim();
  if (!url) return { text: typeFallbacks[item.type] || "ITEM" };

  const youtubeId = getYouTubeId(url);
  if (youtubeId) {
    return {
      image: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      text: "YouTube"
    };
  }

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    return {
      image: `https://s.wordpress.com/mshots/v1/${encodeURIComponent(parsed.href)}?w=600`,
      text: host
    };
  } catch {
    return { text: typeFallbacks[item.type] || "ITEM" };
  }
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function syncInputs() {
  els.tripTitle.value = state.title;
  els.startDate.value = state.startDate;
  els.budget.value = state.budget;
  els.packingList.value = state.packingList;
  els.dayCount.value = state.days.length;
  syncPageTitle();
}

function syncPageTitle() {
  const title = state.title.trim() || DEFAULT_PAGE_TITLE;
  els.pageTitle.textContent = title;
  document.title = title;
}

function renderDayTabs() {
  els.dayTabs.innerHTML = "";
  state.days.forEach((items, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `day-tab${index === state.activeDay ? " active" : ""}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(index === state.activeDay));
    button.innerHTML = `<strong>Day ${index + 1}</strong><span>${toDateLabel(index)} · ${items.length} 項</span>`;
    button.addEventListener("click", () => {
      state.activeDay = index;
      saveState();
      render();
    });
    els.dayTabs.append(button);
  });
}

function renderStats() {
  const totalItems = state.days.reduce((sum, day) => sum + day.length, 0);
  const links = state.days.flat().filter((item) => item.url).length;
  els.tripStats.innerHTML = `
    <div class="stat"><strong>${totalItems}</strong><span>行程項目</span></div>
    <div class="stat"><strong>${links}</strong><span>已存連結</span></div>
    <div class="stat"><strong>${state.days.length}</strong><span>旅遊天數</span></div>
  `;
}

function renderActiveDay() {
  els.activeDayTitle.textContent = `Day ${state.activeDay + 1}`;
  els.activeDayDate.textContent = toDateLabel(state.activeDay);
  document.querySelectorAll(".type-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.type === state.selectedType);
  });
}

function renderTimeline() {
  const items = state.days[state.activeDay];
  els.timeline.innerHTML = "";

  if (!items.length) {
    els.timeline.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>這一天還沒有行程</strong>
          <p>新增景點、美食、網頁連結、YouTube 影片或純文字筆記。</p>
        </div>
      </div>
    `;
    return;
  }

  items.forEach((item, index) => {
    const node = els.template.content.firstElementChild.cloneNode(true);
    node.dataset.index = index;
    const media = node.querySelector(".item-media");
    const preview = getPreview(item);

    if (preview.image) {
      const img = document.createElement("img");
      img.src = preview.image;
      img.alt = item.title || preview.text;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        media.textContent = preview.text;
      });
      media.append(img);
    } else {
      media.textContent = preview.text;
    }

    node.querySelector(".item-type").textContent = typeLabels[item.type] || "項目";
    const timeInput = node.querySelector(".item-time");
    const titleInput = node.querySelector(".item-title");
    const noteInput = node.querySelector(".item-note");
    const link = node.querySelector(".item-url");

    timeInput.value = item.time || "";
    titleInput.value = item.title || "";
    noteInput.value = item.note || "";

    if (item.url) {
      link.href = item.url;
      link.textContent = item.url;
    } else {
      link.remove();
    }

    timeInput.addEventListener("input", () => updateItem(index, { time: timeInput.value }));
    titleInput.addEventListener("input", () => updateItem(index, { title: titleInput.value }));
    noteInput.addEventListener("input", () => updateItem(index, { note: noteInput.value }));
    node.querySelector(".delete-item").addEventListener("click", () => deleteItem(index));
    node.querySelector(".move-up").addEventListener("click", () => moveItem(index, index - 1));
    node.querySelector(".move-down").addEventListener("click", () => moveItem(index, index + 1));

    node.addEventListener("dragstart", () => {
      dragIndex = index;
      node.classList.add("dragging");
    });
    node.addEventListener("dragend", () => {
      dragIndex = null;
      node.classList.remove("dragging");
    });
    node.addEventListener("dragover", (event) => event.preventDefault());
    node.addEventListener("drop", () => {
      if (dragIndex === null || dragIndex === index) return;
      moveItem(dragIndex, index);
    });

    els.timeline.append(node);
  });
}

function updateItem(index, patch) {
  state.days[state.activeDay][index] = {
    ...state.days[state.activeDay][index],
    ...patch
  };
  saveState();
}

function deleteItem(index) {
  state.days[state.activeDay].splice(index, 1);
  saveState();
  render();
}

function moveItem(from, to) {
  const items = state.days[state.activeDay];
  if (to < 0 || to >= items.length) return;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);
  saveState();
  render();
}

function setDayCount(nextCount) {
  const count = Math.min(Math.max(Number(nextCount) || DEFAULT_DAYS, MIN_DAYS), MAX_DAYS);
  if (count === state.days.length) {
    els.dayCount.value = state.days.length;
    return;
  }

  if (count < state.days.length) {
    const removedDays = state.days.slice(count);
    const removedItems = removedDays.reduce((sum, day) => sum + day.length, 0);
    if (removedItems > 0 && !confirm(`減少天數會刪除後面 ${removedItems} 個行程項目，確定要繼續嗎？`)) {
      els.dayCount.value = state.days.length;
      return;
    }
    state.days = state.days.slice(0, count);
    state.activeDay = Math.min(state.activeDay, count - 1);
  } else {
    state.days = [
      ...state.days,
      ...Array.from({ length: count - state.days.length }, () => [])
    ];
  }

  els.dayCount.value = state.days.length;
  saveState();
  render();
}

function addItem(event) {
  event.preventDefault();
  const title = els.itemTitle.value.trim();
  if (!title) return;

  const url = els.itemUrl.value.trim();
  const youtubeId = getYouTubeId(url);
  const type = youtubeId ? "youtube" : state.selectedType;

  state.days[state.activeDay].push({
    id: createId(),
    type,
    title,
    time: els.itemTime.value,
    url,
    note: els.itemNote.value.trim()
  });

  els.itemForm.reset();
  saveState();
  render();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.title || "trip-plan"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      state = sanitizeImportedState(imported);
      saveState();
      syncInputs();
      render();
    } catch {
      alert("匯入失敗，請確認是這個行程工具匯出的 JSON 檔。");
    }
  });
  reader.readAsText(file);
}

function resetTrip() {
  if (!confirm("確定要清空目前所有行程嗎？")) return;
  state = structuredClone(defaultState);
  localStorage.removeItem(STORAGE_KEY);
  syncInputs();
  render();
}

async function shareBlankLink() {
  const blankUrl = new URL(window.location.href);
  blankUrl.search = "?fresh=1";
  blankUrl.hash = "";

  try {
    await navigator.clipboard.writeText(blankUrl.href);
    els.shareBlankBtn.textContent = "已複製空白連結";
    setTimeout(() => {
      els.shareBlankBtn.textContent = "複製空白分享連結";
    }, 1800);
  } catch {
    prompt("請複製這個空白分享連結：", blankUrl.href);
  }
}

async function shareCurrentPlanLink() {
  const planUrl = new URL(window.location.href);
  planUrl.search = `?plan=${encodePlan(state)}`;
  planUrl.hash = "";

  if (planUrl.href.length > SHARE_URL_WARNING_LENGTH) {
    alert("這份行程資料較多，分享網址可能太長。仍會嘗試複製；如果聊天軟體無法傳送，請改用「匯出 JSON」。");
  }

  await copyShareLink(planUrl.href, els.sharePlanBtn, "已複製目前行程連結", "產生目前行程分享連結");
}

async function copyShareLink(url, button, successText, defaultText) {
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = successText;
    setTimeout(() => {
      button.textContent = defaultText;
    }, 1800);
  } catch {
    prompt("請複製這個分享連結：", url);
  }
}

function bindEvents() {
  els.tripTitle.addEventListener("input", () => {
    state.title = els.tripTitle.value;
    syncPageTitle();
    saveState();
  });
  els.startDate.addEventListener("input", () => {
    state.startDate = els.startDate.value;
    saveState();
    render();
  });
  els.budget.addEventListener("input", () => {
    state.budget = els.budget.value;
    saveState();
  });
  els.packingList.addEventListener("input", () => {
    state.packingList = els.packingList.value;
    saveState();
  });
  els.dayCount.addEventListener("change", () => setDayCount(els.dayCount.value));
  els.decreaseDaysBtn.addEventListener("click", () => setDayCount(state.days.length - 1));
  els.increaseDaysBtn.addEventListener("click", () => setDayCount(state.days.length + 1));
  document.querySelectorAll(".type-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedType = button.dataset.type;
      saveState();
      renderActiveDay();
    });
  });
  els.itemForm.addEventListener("submit", addItem);
  els.sharePlanBtn.addEventListener("click", shareCurrentPlanLink);
  els.shareBlankBtn.addEventListener("click", shareBlankLink);
  els.exportBtn.addEventListener("click", exportJson);
  els.importInput.addEventListener("change", (event) => importJson(event.target.files[0]));
  els.resetBtn.addEventListener("click", resetTrip);
}

function render() {
  renderDayTabs();
  renderActiveDay();
  renderTimeline();
  renderStats();
}

syncInputs();
bindEvents();
render();
