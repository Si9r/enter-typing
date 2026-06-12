const rankingConfig = window.RANKING_CONFIG || {};
const rankingState = {
  mode: rankingConfig.defaultMode || "all",
  contentId: new URLSearchParams(window.location.search).get("content_id") || "",
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function typeLabel(type) {
  return type === "typing" ? "타이핑" : "퀴즈";
}

function renderRows(rows) {
  const tbody = document.getElementById("ranking-body");
  const empty = document.getElementById("ranking-empty");
  if (!tbody || !empty) return;

  if (!rows.length) {
    tbody.innerHTML = "";
    empty.style.display = "block";
    return;
  }

  empty.style.display = "none";
  tbody.innerHTML = rows.map((row) => {
    const metric = row.type === "typing"
      ? `${row.wpm || 0} WPM`
      : `콤보 ${row.max_combo || 0}`;
    return `
      <tr>
        <td class="rank-cell">${row.rank}</td>
        <td><span class="mode-pill ${row.type}">${typeLabel(row.type)}</span></td>
        <td>
          <div class="rank-title">${escapeHTML(row.title || "-")}</div>
          <div class="rank-sub">${escapeHTML(row.genre || "-")}</div>
        </td>
        <td>${escapeHTML(row.nickname || "-")}</td>
        <td class="score-cell">${row.score || 0}</td>
        <td>${Math.round(row.accuracy || 0)}%</td>
        <td>${metric}</td>
        <td>${formatDate(row.played_at)}</td>
      </tr>
    `;
  }).join("");
}

function updateTabs() {
  document.querySelectorAll("[data-ranking-mode]").forEach((button) => {
    const active = button.dataset.rankingMode === rankingState.mode;
    button.classList.toggle("active", active);
  });
}

async function loadRankings() {
  const status = document.getElementById("ranking-status");
  if (status) status.textContent = "불러오는 중...";

  const params = new URLSearchParams({
    mode: rankingState.mode,
    limit: "50",
  });
  if (rankingConfig.contentScoped && rankingState.contentId) {
    params.set("content_id", rankingState.contentId);
  }

  try {
    const response = await fetch(`/api/rankings?${params.toString()}`);
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.detail || "랭킹을 불러오지 못했습니다.");
    }
    renderRows(data.data || []);
    if (status) status.textContent = `${(data.data || []).length}개 기록`;
  } catch (error) {
    console.error(error);
    renderRows([]);
    if (status) status.textContent = error.message || "오류가 발생했습니다.";
  }
}

function bindRankingControls() {
  document.querySelectorAll("[data-ranking-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      rankingState.mode = button.dataset.rankingMode || "all";
      updateTabs();
      loadRankings();
    });
  });

  const contentInput = document.getElementById("ranking-content-id");
  const contentButton = document.getElementById("ranking-content-apply");
  if (contentInput) contentInput.value = rankingState.contentId;
  if (contentButton && contentInput) {
    contentButton.addEventListener("click", () => {
      rankingState.contentId = contentInput.value.trim();
      loadRankings();
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindRankingControls();
  updateTabs();
  loadRankings();
});
