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
    setSpotsMode(filter, chip);
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

// 카드: 마우스가 없는 휴대폰·태블릿은 탭하면 열리고, 한 번 더 탭하면 닫힘
// (하나를 열면 같은 섹션의 다른 카드는 닫힘)
allCards.forEach((card) => {
  card.addEventListener("click", () => {
    if (window.matchMedia("(hover: hover)").matches) return;
    const willOpen = !card.classList.contains("open");
    card.closest(".section").querySelectorAll(".card.open").forEach((c) => c.classList.remove("open"));
    card.classList.toggle("open", willOpen);
    if (!willOpen) card.blur();
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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- 삼척이 어디야?: 서울 → 삼척 경로 그리며 버스 이동 ----------
const routePath = document.getElementById("routePath");
const routeMaskPath = document.getElementById("routeMaskPath");
const routeBus = document.getElementById("routeBus");
const mapCard = document.querySelector(".map-card");
if (routePath && routeMaskPath && routeBus && mapCard) {
  const len = routePath.getTotalLength();
  routeMaskPath.style.strokeDasharray = len;
  routeMaskPath.style.strokeDashoffset = reduceMotion ? 0 : len;
  let running = false;

  const playRoute = () => {
    if (reduceMotion || running) return;
    running = true;
    const duration = 2200;
    const start = performance.now();
    routeBus.classList.add("moving");
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const p = routePath.getPointAtLength(len * eased);
      routeBus.setAttribute("x", p.x);
      routeBus.setAttribute("y", p.y - 9);
      routeMaskPath.style.strokeDashoffset = len * (1 - eased);
      if (t < 1) requestAnimationFrame(step);
      else setTimeout(() => { routeBus.classList.remove("moving"); running = false; }, 600);
    };
    requestAnimationFrame(step);
  };

  const mapObserver = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { setTimeout(playRoute, 400); mapObserver.disconnect(); }
  }, { threshold: 0.5 });
  mapObserver.observe(mapCard);
  // 지도를 누르면 다시 출발
  mapCard.addEventListener("click", () => {
    if (running) return;
    routeMaskPath.style.strokeDashoffset = len;
    playRoute();
  });
}

// ---------- 1박 2일 코스: 보이면 타임라인 그리기 ----------
const dayCards = document.querySelectorAll(".day-card");
const dayObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("drawn");
      dayObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.4 });
dayCards.forEach((card) => dayObserver.observe(card));

// ---------- 언제 가면 좋아?: 고른 계절 색으로 배경 바꾸기 ----------
const seasonSection = document.getElementById("season");
if (seasonSection) {
  const setTone = (tone) => {
    if (tone) seasonSection.dataset.tone = tone;
    else delete seasonSection.dataset.tone;
  };
  seasonSection.querySelectorAll("[data-season]").forEach((card) => {
    card.addEventListener("mouseenter", () => setTone(card.dataset.season));
    card.addEventListener("focus", () => setTone(card.dataset.season));
    card.addEventListener("click", () => {
      if (window.matchMedia("(hover: hover)").matches) return;
      // 휴대폰: 탭해서 열면 그 계절 색, 닫으면 원래대로
      setTimeout(() => setTone(card.classList.contains("open") ? card.dataset.season : seasonSection.querySelector(".card.open")?.dataset.season), 0);
    });
  });
  seasonSection.querySelector(".cards").addEventListener("mouseleave", () => setTone(null));
  seasonSection.addEventListener("focusout", (e) => {
    if (!seasonSection.contains(e.relatedTarget)) setTone(null);
  });
}

// ---------- 동굴 손전등: 커서(손가락) 위치를 따라 빛 이동 ----------
const spotsSection = document.getElementById("spots");
const caveDark = document.getElementById("caveDark");
if (spotsSection && caveDark) {
  if (!window.matchMedia("(hover: hover)").matches) {
    caveDark.querySelector(".cave-tip").textContent = "🔦 손가락으로 눌러서 동굴을 비춰봐";
  }
  const moveLight = (x, y) => {
    const r = spotsSection.getBoundingClientRect();
    caveDark.style.setProperty("--lx", `${x - r.left}px`);
    caveDark.style.setProperty("--ly", `${y - r.top}px`);
  };
  spotsSection.addEventListener("pointermove", (e) => moveLight(e.clientX, e.clientY));
  spotsSection.addEventListener("pointerdown", (e) => moveLight(e.clientX, e.clientY));
  spotsSection.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (t) moveLight(t.clientX, t.clientY);
  }, { passive: true });
}

// ---------- 첫 화면 패럴랙스: 사진은 천천히, 글씨는 빠르게 ----------
if (hero && !reduceMotion) {
  let ticking = false;
  const parallax = () => {
    const y = Math.min(window.scrollY, hero.offsetHeight);
    hero.style.setProperty("--bg-shift", `${y * 0.45}px`);
    hero.style.setProperty("--text-shift", `${y * -0.25}px`);
    hero.style.setProperty("--text-fade", Math.max(0, 1 - y / (hero.offsetHeight * 0.6)).toFixed(3));
    ticking = false;
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; requestAnimationFrame(parallax); }
  }, { passive: true });
  parallax();
}

// ---------- 가볼 곳 필터별 분위기: 동굴(손전등) · 바다(물속) · 역사(먹물) ----------
function setSpotsMode(filter, chip) {
  const section = document.getElementById("spots");
  section.classList.remove("cave-mode", "sea-mode", "history-mode");
  if (filter === "history") {
    // 누른 버튼 자리에서 먹물이 퍼지도록 시작점 지정
    const s = section.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    section.style.setProperty("--ix", `${c.left + c.width / 2 - s.left}px`);
    section.style.setProperty("--iy", `${c.top + c.height / 2 - s.top}px`);
    void section.offsetWidth; // 애니메이션 처음부터 다시
  }
  if (filter !== "all") section.classList.add(`${filter}-mode`);
}

// 물속 모드: 거품 만들기
const seaLayer = document.getElementById("seaLayer");
if (seaLayer && !reduceMotion) {
  for (let i = 0; i < 22; i++) {
    const b = document.createElement("span");
    b.className = "bubble";
    const size = 6 + Math.random() * 18;
    b.style.width = b.style.height = `${size}px`;
    b.style.left = `${Math.random() * 100}%`;
    b.style.animationDuration = `${6 + Math.random() * 7}s`;
    b.style.animationDelay = `${-Math.random() * 12}s`;
    seaLayer.appendChild(b);
  }
}

// 물속 모드: 마우스/손가락 자리에 물결
const rippleLayer = document.getElementById("rippleLayer");
if (spotsSection && rippleLayer && !reduceMotion) {
  let lastRipple = 0;
  const makeRipple = (x, y, force) => {
    if (!spotsSection.classList.contains("sea-mode")) return;
    const now = performance.now();
    if (!force && now - lastRipple < 140) return;
    lastRipple = now;
    const r = spotsSection.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.left = `${x - r.left}px`;
    dot.style.top = `${y - r.top}px`;
    dot.addEventListener("animationend", () => dot.remove());
    rippleLayer.appendChild(dot);
  };
  spotsSection.addEventListener("pointermove", (e) => makeRipple(e.clientX, e.clientY, false));
  spotsSection.addEventListener("pointerdown", (e) => makeRipple(e.clientX, e.clientY, true));
}

// ---------- 가볼 곳: 커진 카드가 섹션 밖으로 삐져나오지 않게 섹션을 같이 늘림 ----------
{
  const grid = document.querySelector("#spots .spots");
  const fit = () => {
    let lowest = 0;
    grid.querySelectorAll(".spot:not(.hide) .card").forEach((card) => {
      lowest = Math.max(lowest, card.getBoundingClientRect().bottom);
    });
    const overflow = lowest - grid.getBoundingClientRect().bottom;
    // 섹션 아래 여백(90px) 중 40px까지는 그냥 쓰고, 그보다 더 내려가면 그만큼 섹션을 늘림
    grid.style.marginBottom = `${Math.max(0, Math.ceil(overflow - 40))}px`;
  };
  const ro = new ResizeObserver(fit);
  grid.querySelectorAll(".card").forEach((card) => ro.observe(card));
}

// ---------- 먹거리: 이모지만 따로 흔들 수 있게 감싸기 ----------
const foodCards = [...document.querySelectorAll(".food-cards .card")];
foodCards.forEach((card) => {
  const icon = card.querySelector(".card-icon");
  if (icon) icon.innerHTML = `<span class="emo">${icon.textContent.trim()}</span>`;
});

// ---------- 먹거리: 오늘 뭐 먹지? 룰렛 ----------
const pickBtn = document.getElementById("pickBtn");
const pickResult = document.getElementById("pickResult");
const foodGrid = document.querySelector(".food-cards");
if (pickBtn && foodGrid && foodCards.length) {
  const finish = (card) => {
    foodGrid.classList.remove("spinning");
    foodCards.forEach((c) => c.classList.remove("lit"));
    card.classList.add("picked");
    card.insertAdjacentHTML("beforeend", '<span class="pick-badge">오늘은 너다!</span>');
    pickResult.textContent = `오늘은 ${card.querySelector("h3").textContent} 먹으러 가자 😋`;
    pickBtn.disabled = false;
    pickBtn.textContent = "🎲 다시 돌리기";
  };

  pickBtn.addEventListener("click", () => {
    // 지난 결과 지우기
    foodCards.forEach((c) => {
      c.classList.remove("picked", "lit");
      c.querySelector(".pick-badge")?.remove();
    });
    pickResult.textContent = "";
    const target = Math.floor(Math.random() * foodCards.length);
    if (reduceMotion) { finish(foodCards[target]); return; }

    pickBtn.disabled = true;
    pickBtn.textContent = "🎲 고르는 중...";
    foodGrid.classList.add("spinning");
    // 세 바퀴 돌고 target에서 멈추기, 끝으로 갈수록 느려짐
    const steps = foodCards.length * 3 + target;
    let i = 0;
    const tick = () => {
      foodCards.forEach((c) => c.classList.remove("lit"));
      foodCards[i % foodCards.length].classList.add("lit");
      if (i === steps) { setTimeout(() => finish(foodCards[target]), 350); return; }
      const progress = i / steps;
      i++;
      setTimeout(tick, 60 + Math.pow(progress, 3) * 380);
    };
    tick();
  });
}
