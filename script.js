// 가볼 곳: 카테고리 필터
const chips = document.querySelectorAll(".chip");
const spots = document.querySelectorAll("#spots .spot"); // 필터는 '가볼 곳' 카드에만
const spotsGrid = document.querySelector("#spots .spots");
const allCards = document.querySelectorAll(".card");

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    chips.forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");

    const filter = chip.dataset.filter;
    spots.forEach((spot) => {
      const match = filter === "all" || spot.dataset.cat === filter;
      spot.classList.toggle("hide", !match);
    });
    setGrowDirection();
  });
});

// 가볼 곳: 오른쪽 절반에 있는 카드는 왼쪽으로 커지게 (화면 밖으로 안 나가게)
function setGrowDirection() {
  const cols = getComputedStyle(spotsGrid).gridTemplateColumns.split(" ").length;
  const left = spotsGrid.getBoundingClientRect().left;
  spots.forEach((spot) => {
    if (spot.classList.contains("hide")) return;
    const r = spot.getBoundingClientRect();
    const gap = parseFloat(getComputedStyle(spotsGrid).columnGap) || 0;
    const col = Math.round((r.left - left) / (r.width + gap));
    spot.classList.toggle("grow-left", cols > 1 && col >= cols / 2);
  });
}
setGrowDirection();
new ResizeObserver(setGrowDirection).observe(spotsGrid);

// 카드: 마우스가 없는 휴대폰·태블릿은 탭해서 설명 열고 닫기
allCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (window.matchMedia("(hover: hover)").matches) return;
    card.classList.toggle("open");
  });
});

// ---------- 사이드바 접기 / 펼치기 ----------
const sidebarToggle = document.getElementById("sidebarToggle");
const backdrop = document.getElementById("sidebarBackdrop");
const smallScreen = window.matchMedia("(max-width: 768px)");

function setCollapsed(collapsed, remember = true) {
  document.body.classList.toggle("sb-collapsed", collapsed);
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.setAttribute("aria-label", collapsed ? "메뉴 펼치기" : "메뉴 접기");
  if (remember && !smallScreen.matches) {
    try { localStorage.setItem("sidebarCollapsed", collapsed ? "1" : "0"); } catch (e) {}
  }
}

// 처음 상태: 작은 화면은 접힌 채로, 큰 화면은 지난번 상태 기억
let saved = null;
try { saved = localStorage.getItem("sidebarCollapsed"); } catch (e) {}
setCollapsed(smallScreen.matches || saved === "1", false);

sidebarToggle.addEventListener("click", () => {
  setCollapsed(!document.body.classList.contains("sb-collapsed"));
});
backdrop.addEventListener("click", () => setCollapsed(true, false));
smallScreen.addEventListener("change", (e) => { if (e.matches) setCollapsed(true, false); });

// ---------- 선택한 메뉴 강조 ----------
const sideLinks = document.querySelectorAll(".side-link");

const topbarIcon = document.getElementById("topbarIcon");
const topbarTitle = document.getElementById("topbarTitle");

function setActive(id) {
  sideLinks.forEach((link) => {
    const on = link.getAttribute("href") === `#${id}`;
    link.classList.toggle("active", on);
    if (on) {
      link.setAttribute("aria-current", "true");
      // 고정 헤더에도 지금 섹션 이름 표시
      topbarIcon.textContent = link.querySelector(".side-icon").textContent;
      topbarTitle.textContent = link.dataset.label;
    } else link.removeAttribute("aria-current");
  });
}

sideLinks.forEach((link) => {
  link.addEventListener("click", () => {
    setActive(link.getAttribute("href").slice(1));
    if (smallScreen.matches) setCollapsed(true, false); // 작은 화면은 이동 후 자동으로 닫기
  });
});

// 스크롤 위치에 따라 지금 보고 있는 섹션의 메뉴를 강조
const spySections = [...sideLinks]
  .map((link) => document.querySelector(link.getAttribute("href")))
  .filter(Boolean);

const spy = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) setActive(entry.target.id);
    });
  },
  { rootMargin: "-45% 0px -50% 0px" }
);
spySections.forEach((section) => spy.observe(section));

// 스크롤하면 섹션이 부드럽게 나타나기
const revealTargets = document.querySelectorAll(".section");
revealTargets.forEach((el) => el.classList.add("reveal"));

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach((el) => observer.observe(el));

// ---------- 줄바꿈: 마지막 줄에 짧은 단어 하나만 남지 않게 ----------
// 문단 끝의 띄어쓰기 몇 개를 줄바꿈 안 되는 공백(nbsp)으로 바꿔서
// 마지막 줄에 최소 몇 글자가 함께 넘어가도록 묶는다.
function glueLastWords(el, minTail = 7) {
  // 글자와 <br>을 순서대로 모아서, <br>로 나뉜 줄마다 따로 처리
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  let tail = 0, glued = 0, started = false, done = false;
  for (let n = nodes.length - 1; n >= 0; n--) {
    const node = nodes[n];
    if (node.nodeType === 1) {
      if (node.tagName === "BR") { tail = 0; glued = 0; started = false; done = false; }
      continue;
    }
    if (done) continue;
    const t = node.nodeValue;
    for (let i = t.length - 1; i >= 0 && !done; i--) {
      if (t[i] === " ") {
        if (!started) continue;
        if (tail >= minTail || glued >= 3) { done = true; break; }
        node.nodeValue = node.nodeValue.slice(0, i) + " " + node.nodeValue.slice(i + 1);
        glued++;
      } else if (!/\s/.test(t[i])) {
        started = true;
        tail++;
      }
    }
  }
}
document
  .querySelectorAll("p, .card-summary, .fact span, .timeline span, h3")
  .forEach((el) => glueLastWords(el));

// ---------- 고정 헤더: 히어로를 지나면 나타나고, 읽은 만큼 막대가 참 ----------
const topbar = document.getElementById("topbar");
const topbarBar = document.getElementById("topbarBar");
const hero = document.getElementById("top");
let ticking = false;

function updateTopbar() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const show = y > hero.offsetHeight - 80;
  topbar.classList.toggle("visible", show);
  topbar.setAttribute("aria-hidden", String(!show));
  topbar.querySelector(".topbar-top").tabIndex = show ? 0 : -1;
  topbarBar.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;
  ticking = false;
}
window.addEventListener("scroll", () => {
  if (!ticking) { requestAnimationFrame(updateTopbar); ticking = true; }
}, { passive: true });
window.addEventListener("resize", updateTopbar);
updateTopbar();

// ---------- 언제 가면 좋아?: 오늘 날짜 기준 지금 계절 강조 ----------
const month = new Date().getMonth() + 1;
const nowSeason =
  month >= 3 && month <= 5 ? "spring" :
  month >= 6 && month <= 8 ? "summer" :
  month >= 9 && month <= 11 ? "autumn" : "winter";
const nowCard = document.querySelector(`[data-season="${nowSeason}"]`);
if (nowCard) {
  nowCard.classList.add("now");
  const badge = document.createElement("span");
  badge.className = "now-badge";
  badge.textContent = "지금 이 계절";
  nowCard.appendChild(badge);
}
