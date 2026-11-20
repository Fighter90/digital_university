// DIG-116: Contest presentation builder (RU + EN, PPTX + PDF).
// Outputs: docs/presentation/presentation-{ru,en}.{pptx,pdf}
// Style: white background, accent gradient #2563eb -> #1d4ed8, Inter (system fallback),
// bordered screenshots. Run: node scripts/presentation.mjs
import pptxgen from "pptxgenjs";
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "docs/presentation");
const RU = resolve(ROOT, "docs/shots/ru");
const EN = resolve(ROOT, "docs/shots/en");
const DESIGN = resolve(ROOT, "docs/design/screenshots");
mkdirSync(OUT, { recursive: true });

// ---------- palette ----------
const BLUE1 = "2563eb";
const BLUE2 = "1d4ed8";
const NAVY = "0f172a";
const SLATE = "475569";
const MUTED = "94a3b8";
const CARD_BG = "f8fafc";
const CARD_LINE = "e2e8f0";
const CHIP_BG = "eff6ff";
const WHITE = "FFFFFF";
const FONT = "Inter";

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function mix(c1, c2, t) {
  const p = (c) => [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [r1, g1, b1] = p(c1);
  const [r2, g2, b2] = p(c2);
  return [lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
// css gradient helper for HTML
const cssGrad = `linear-gradient(90deg,#${BLUE1},#${BLUE2})`;

// ---------- deck data ----------
const W = 13.33,
  H = 7.5,
  MX = 0.6,
  CW = W - 2 * MX;

const decks = {
  ru: {
    file: "presentation-ru",
    dir: RU,
    pill: "Концепт для конкурса",
    footer: "Цифровой деканат · ostrovok.store",
    slides: [
      {
        kind: "title",
        kicker: "Концепт для конкурса · 2026",
        title: "Цифровой деканат",
        sub: "Digital Deanery — личный кабинет студента: всё об учёбе в одном окне",
        url: "https://ostrovok.store",
        note: "Прототип, не официальный сервис вуза. Все данные вымышленные.",
        img: "landing.png",
      },
      {
        kind: "cards",
        kicker: "Проблема",
        title: "Учёба разорвана по сервисам",
        cards: [
          ["Расписание", "в одном приложении, переносы теряются"],
          ["Оценки и зачётка", "в другом месте, без общей картины"],
          ["Заявки и справки", "только лично, в часы приёма"],
          ["Объявления", "в чатах и на сайте, всё вперемешку"],
        ],
        punch: "Студент ищет информацию вместо учёбы, деканат десятки раз отвечает на одно и то же.",
      },
      {
        kind: "shot",
        kicker: "Решение",
        title: "«Всё в одном окне»",
        bullets: [
          "Один вход: расписание, оценки, заявки, справки, уведомления, обращения",
          "Телефон (от 360 px) и компьютер (1440 px) — один и тот же кабинет",
          "Плашка «Концепт для конкурса» на каждом экране, данные вымышленные",
        ],
        img: "dashboard.png",
      },
      {
        kind: "shot",
        kicker: "Ядро · 1/4",
        title: "Расписание: день, неделя, месяц",
        bullets: [
          "Переносы, отмены и окна видны сразу, «Сегодня» — на главной",
          "Экспорт расписания в PDF / XLSX / Markdown",
        ],
        img: "schedule-week.png",
      },
      {
        kind: "shot",
        kicker: "Ядро · 2/4",
        title: "Успеваемость + AI-подсказки",
        bullets: [
          "Зачётка, сессия и «как у меня дела»: средний балл, кредиты, долги",
          "AI объясняет, что подтянуть и какие дедлайны близко",
        ],
        img: "grades.png",
      },
      {
        kind: "twoShots",
        kicker: "Ядро · 3/4",
        title: "Заявки и справки с QR-проверкой",
        bullets: [
          "Заявка онлайн: справка, перезачёт, практика — статус виден всегда",
          "Справка с QR-кодом: подлинность проверяется по ссылке",
        ],
        imgs: ["requests.png", "request-card.png"],
      },
      {
        kind: "shot",
        kicker: "Ядро · 4/4",
        title: "Уведомления и объявления",
        bullets: [
          "Персональные уведомления и новости деканата — в одном списке",
          "Непрочитанные видны на главной — ничего не теряется",
        ],
        img: "notifications.png",
      },
      {
        kind: "shot",
        kicker: "Сверх ядра",
        title: "События, МСП, ДПО, финансы, люди",
        bullets: [
          "Мероприятия и доп. образование (ДПО) с записью в один клик",
          "Финансы, справочник, «люди деканата», поиск ⌘K",
        ],
        img: "msp.png",
      },
      {
        kind: "twoShots",
        kicker: "AI + MCP",
        title: "AI-ассистент и MCP-сервер деканата",
        bullets: [
          "Ассистент отвечает по данным студента: расписание, оценки, дедлайны",
          "Настоящий MCP-сервер: Claude / Cursor / Codex по личному токену, только чтение",
        ],
        imgs: ["assistant.png", "settings-mcp.png"],
      },
      {
        kind: "shot",
        kicker: "Деканат",
        title: "Кабинет сотрудника",
        bullets: [
          "Очередь заявок, согласование справок, объявления — рабочее место деканата",
          "Сотрудник видит статус каждой заявки и отвечает студенту",
        ],
        img: "staff-queue.png",
      },
      {
        kind: "secCards",
        kicker: "Безопасность",
        title: "Безопасность по умолчанию",
        cards: [
          ["argon2id", "пароли — только хэши, открытых паролей нет"],
          ["__Host-cookie", "сессия — защищённая cookie с строгими флагами"],
          ["Owner-scope", "чужие данные недоступны: IDOR-тесты на каждый роут"],
          ["Rate-limit", "вход ограничен, секреты — только в окружении"],
        ],
        img: "verify.png",
        caption: "Проверка подлинности справки по QR",
      },
      {
        kind: "pipeline",
        kicker: "Процесс",
        title: "Как это построено: рой ИИ-агентов",
        steps: ["Задача в Linear", "executor", "гейты: lint · типы · тесты", "ревью", "security", "PR → merge"],
        stats: [
          ["95+", "задач Linear прошёл рой"],
          ["80+", "PR с гейтами и ревью"],
          ["1", "человек ставит задачи и принимает merge"],
        ],
      },
      {
        kind: "a11y",
        kicker: "Языки и доступность",
        title: "RU / EN и доступность",
        bullets: [
          "Интерфейс и документация — на русском и английском",
          "Plain-версия для слабовидящих: крупный текст, без стилей",
          "Мобильный 360 px и десктоп 1440 px — один и тот же Shell",
        ],
        img: "design-full-mobile-360.png",
      },
      {
        kind: "final",
        kicker: "Итоги",
        title: "Цифры и ссылки",
        stats: [
          ["95+", "задач Linear"],
          ["80+", "PR"],
          ["2", "языка интерфейса"],
        ],
        rows: [
          ["Работает", "https://ostrovok.store — до 28.11.2026"],
          ["Аккаунты жюри", "anna.smirnova · ilya.petrov · dean.kovaleva (пароли — в README)"],
          ["Код", "github.com/Fighter90/digital_university"],
          ["MCP-сервер", "ostrovok.store/api/mcp — для любого MCP-ассистента"],
        ],
      },
    ],
  },
  en: {
    file: "presentation-en",
    dir: EN,
    pill: "Concept entry",
    footer: "Digital Deanery · ostrovok.store",
    slides: [
      {
        kind: "title",
        kicker: "Concept entry · 2026",
        title: "Digital Deanery",
        sub: "Цифровой деканат — a student self-service portal: every study-related thing in one window",
        url: "https://ostrovok.store",
        note: "A contest prototype, not a real university service. All data is fictional.",
        img: "landing.png",
      },
      {
        kind: "cards",
        kicker: "Problem",
        title: "Studies are scattered across services",
        cards: [
          ["Schedule", "in one app, room changes get lost"],
          ["Grades & transcript", "somewhere else, no big picture"],
          ["Requests & certificates", "in person only, office hours only"],
          ["Announcements", "in chats and on a website, all mixed up"],
        ],
        punch: "Students search for information instead of studying; the office answers the same questions dozens of times a day.",
      },
      {
        kind: "shot",
        kicker: "Solution",
        title: "Everything in one window",
        bullets: [
          "One login: schedule, grades, requests, certificates, notifications, appeals",
          "Phone (from 360 px) and desktop (1440 px) — the same cabinet",
          "A “concept entry” banner on every screen, all data fictional",
        ],
        img: "dashboard.png",
      },
      {
        kind: "shot",
        kicker: "Core · 1/4",
        title: "Schedule: day, week, month",
        bullets: [
          "Room changes, cancellations and gaps are visible at once; “Today” is on the home screen",
          "Export the schedule to PDF / XLSX / Markdown",
        ],
        img: "schedule-week.png",
      },
      {
        kind: "shot",
        kicker: "Core · 2/4",
        title: "Grades + AI hints",
        bullets: [
          "Transcript, exam session and “how am I doing”: GPA, credits, debts",
          "AI explains what to improve and which deadlines are close",
        ],
        img: "grades.png",
      },
      {
        kind: "twoShots",
        kicker: "Core · 3/4",
        title: "Requests & QR-verified certificates",
        bullets: [
          "Online requests: certificate, credit transfer, practice — status always visible",
          "Certificate with a QR code: authenticity verified via a link",
        ],
        imgs: ["requests.png", "request-card.png"],
      },
      {
        kind: "shot",
        kicker: "Core · 4/4",
        title: "Notifications & announcements",
        bullets: [
          "Personal notifications and office news — in a single list",
          "Unread items are visible on the home screen — nothing gets lost",
        ],
        img: "notifications.png",
      },
      {
        kind: "shot",
        kicker: "Beyond the core",
        title: "Events, electives, CPD, finance, people",
        bullets: [
          "Events and extra education (CPD) with one-click sign-up",
          "Finance, directory, “office people”, ⌘K search",
        ],
        img: "msp.png",
      },
      {
        kind: "twoShots",
        kicker: "AI + MCP",
        title: "AI assistant & MCP server",
        bullets: [
          "The assistant answers from the student's own data: schedule, grades, deadlines",
          "A real MCP server: Claude / Cursor / Codex connect with a personal token, read-only",
        ],
        imgs: ["assistant.png", "settings-mcp.png"],
      },
      {
        kind: "shot",
        kicker: "Staff",
        title: "Staff workplace",
        bullets: [
          "Request queue, certificate approvals, announcements — the deanery workspace",
          "The staff member sees the status of every request and replies to students",
        ],
        img: "staff-queue.png",
      },
      {
        kind: "secCards",
        kicker: "Security",
        title: "Security by default",
        cards: [
          ["argon2id", "passwords are stored only as hashes"],
          ["__Host-cookie", "sessions use a hard-flagged secure cookie"],
          ["Owner-scope", "no access to other people's data: IDOR tests on every route"],
          ["Rate-limit", "login is throttled, secrets live only in the environment"],
        ],
        img: "verify.png",
        caption: "Certificate authenticity check via QR",
      },
      {
        kind: "pipeline",
        kicker: "Process",
        title: "How it was built: an AI agent swarm",
        steps: ["Linear issue", "executor", "gates: lint · types · tests", "review", "security", "PR → merge"],
        stats: [
          ["95+", "Linear issues handled by the swarm"],
          ["80+", "PRs gated and reviewed"],
          ["1", "human files issues and approves merges"],
        ],
      },
      {
        kind: "a11y",
        kicker: "Languages & accessibility",
        title: "RU / EN & accessibility",
        bullets: [
          "UI and docs in Russian and English",
          "Plain version for low vision: large text, no styles",
          "Mobile 360 px and desktop 1440 px — the same Shell",
        ],
        img: "design-full-mobile-360.png",
      },
      {
        kind: "final",
        kicker: "Summary",
        title: "Numbers & links",
        stats: [
          ["95+", "Linear issues"],
          ["80+", "PRs"],
          ["2", "UI languages"],
        ],
        rows: [
          ["Live demo", "https://ostrovok.store — available until Nov 28, 2026"],
          ["Jury accounts", "anna.smirnova · ilya.petrov · dean.kovaleva (passwords in README)"],
          ["Source code", "github.com/Fighter90/digital_university"],
          ["MCP server", "ostrovok.store/api/mcp — for any MCP assistant"],
        ],
      },
    ],
  },
};

// ---------- shared drawing helpers (pptx) ----------
function gradientStrip(slide, x, y, w, h, segs = 18) {
  const sw = w / segs;
  for (let i = 0; i < segs; i++) {
    slide.addShape("rect", {
      x: x + i * sw,
      y,
      w: sw + 0.005,
      h,
      fill: { color: mix(BLUE1, BLUE2, i / (segs - 1)) },
      line: { type: "none" },
    });
  }
}

function header(slide, d, s, idx) {
  slide.background = { color: WHITE };
  slide.addText(s.kicker.toUpperCase(), {
    x: MX, y: 0.42, w: 9.5, h: 0.32, fontFace: FONT, fontSize: 11,
    color: BLUE1, bold: true, charSpacing: 2,
  });
  slide.addText(s.title, {
    x: MX, y: 0.72, w: 10.2, h: 0.75, fontFace: FONT, fontSize: 27,
    color: NAVY, bold: true, valign: "middle",
  });
  gradientStrip(slide, MX, 1.52, 2.6, 0.07);
  // concept pill
  slide.addShape("roundRect", {
    x: W - MX - 2.5, y: 0.45, w: 2.5, h: 0.42, rectRadius: 0.21,
    fill: { color: CHIP_BG }, line: { color: BLUE1, width: 0.75 },
  });
  slide.addText(d.pill, {
    x: W - MX - 2.5, y: 0.45, w: 2.5, h: 0.42, fontFace: FONT, fontSize: 9.5,
    color: BLUE2, bold: true, align: "center", valign: "middle",
  });
  footer(slide, d, idx);
}

function footer(slide, d, idx) {
  slide.addText(d.footer, {
    x: MX, y: H - 0.42, w: 6, h: 0.3, fontFace: FONT, fontSize: 8.5, color: MUTED,
  });
  slide.addText(`${idx + 1} / ${d.slides.length}`, {
    x: W - MX - 1.2, y: H - 0.42, w: 1.2, h: 0.3, fontFace: FONT, fontSize: 8.5,
    color: MUTED, align: "right",
  });
}

function card(slide, x, y, w, h, head, body, headSize = 14, bodySize = 11.5) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.09,
    fill: { color: CARD_BG }, line: { color: CARD_LINE, width: 1 },
  });
  slide.addText(head, {
    x: x + 0.22, y: y + 0.1, w: w - 0.44, h: 0.4, fontFace: FONT,
    fontSize: headSize, color: BLUE2, bold: true, valign: "middle",
  });
  slide.addText(body, {
    x: x + 0.22, y: y + 0.5, w: w - 0.44, h: h - 0.62, fontFace: FONT,
    fontSize: bodySize, color: SLATE, valign: "top",
  });
}

function borderedImage(slide, imgPath, x, y, w, h) {
  slide.addShape("roundRect", {
    x: x - 0.045, y: y - 0.045, w: w + 0.09, h: h + 0.09, rectRadius: 0.06,
    fill: { color: WHITE }, line: { color: "d5dbe3", width: 1.25 },
  });
  slide.addImage({ path: imgPath, x, y, w, h });
}

function bullets(slide, items, x, y, w, size = 14.5) {
  slide.addText(
    items.map((t) => ({
      text: t,
      options: { bullet: { code: "2022", indent: 14 }, color: NAVY, breakLine: true },
    })),
    {
      x, y, w, h: 1.9, fontFace: FONT, fontSize: size, valign: "top",
      paraSpaceAfter: 10, lineSpacingMultiple: 1.12,
    },
  );
}

function statChip(slide, x, y, w, h, num, label) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.1,
    fill: { color: CHIP_BG }, line: { color: CARD_LINE, width: 1 },
  });
  slide.addText(num, {
    x: x + 0.25, y: y + 0.12, w: w - 0.5, h: h * 0.52, fontFace: FONT,
    fontSize: 30, bold: true, color: BLUE1, valign: "middle",
  });
  slide.addText(label, {
    x: x + 0.25, y: y + h * 0.55, w: w - 0.5, h: h * 0.4, fontFace: FONT,
    fontSize: 11, color: SLATE, valign: "top",
  });
}

// ---------- slide renderers (pptx) ----------
function renderPptx(lang) {
  const d = decks[lang];
  const pptx = new pptxgen();
  pptx.defineLayout({ name: "WIDE", width: W, height: H });
  pptx.layout = "WIDE";
  pptx.author = "Digital Deanery team";
  pptx.title = lang === "ru" ? "Цифровой деканат — презентация" : "Digital Deanery — presentation";
  pptx.subject = "Концепт для конкурса · ostrovok.store";

  d.slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    const top = 1.85;

    if (s.kind === "title") {
      slide.background = { color: WHITE };
      slide.addText(s.kicker.toUpperCase(), {
        x: MX, y: 1.15, w: 7, h: 0.35, fontFace: FONT, fontSize: 12,
        color: BLUE1, bold: true, charSpacing: 2,
      });
      slide.addText(s.title, {
        x: MX, y: 1.55, w: 7.3, h: 1.35, fontFace: FONT, fontSize: 46,
        color: NAVY, bold: true, valign: "middle",
      });
      gradientStrip(slide, MX, 2.95, 3.2, 0.1);
      slide.addText(s.sub, {
        x: MX, y: 3.2, w: 7.1, h: 1.0, fontFace: FONT, fontSize: 16.5,
        color: SLATE, valign: "top", lineSpacingMultiple: 1.15,
      });
      slide.addShape("roundRect", {
        x: MX, y: 4.45, w: 3.6, h: 0.52, rectRadius: 0.26,
        fill: { color: CHIP_BG }, line: { color: BLUE1, width: 1 },
      });
      slide.addText(s.url, {
        x: MX, y: 4.45, w: 3.6, h: 0.52, fontFace: FONT, fontSize: 13.5,
        color: BLUE2, bold: true, align: "center", valign: "middle",
      });
      slide.addText(s.note, {
        x: MX, y: 5.15, w: 7, h: 0.65, fontFace: FONT, fontSize: 11,
        color: MUTED, valign: "top", lineSpacingMultiple: 1.15,
      });
      // screenshot right
      const iw = 5.15, ih = iw / 1.6;
      borderedImage(slide, `${d.dir}/${s.img}`, W - MX - iw, (H - ih) / 2, iw, ih);
      gradientStrip(slide, 0, 0, W, 0.14, 24);
      slide.addText(d.pill, {
        x: MX, y: H - 0.55, w: 6, h: 0.35, fontFace: FONT, fontSize: 10.5,
        color: BLUE2, bold: true,
      });
      return;
    }

    header(slide, d, s, idx);

    if (s.kind === "cards") {
      const gw = (CW - 0.4) / 2, gh = 1.55;
      s.cards.forEach(([h1, b1], i) => {
        const cx = MX + (i % 2) * (gw + 0.4);
        const cy = top + Math.floor(i / 2) * (gh + 0.35);
        card(slide, cx, cy, gw, gh, h1, b1, 15, 12);
      });
      const py = top + 2 * (gh + 0.35) + 0.1;
      slide.addShape("roundRect", {
        x: MX, y: py, w: CW, h: 0.85, rectRadius: 0.1,
        fill: { color: CHIP_BG }, line: { color: BLUE1, width: 0.75 },
      });
      slide.addText(s.punch, {
        x: MX + 0.3, y: py, w: CW - 0.6, h: 0.85, fontFace: FONT, fontSize: 14.5,
        color: NAVY, bold: true, valign: "middle",
      });
      return;
    }

    if (s.kind === "shot") {
      bullets(slide, s.bullets, MX, top + 0.15, 5.35);
      const iw = 6.35, ih = iw / 1.6;
      borderedImage(slide, `${d.dir}/${s.img}`, W - MX - iw, top + 0.25, iw, ih);
      return;
    }

    if (s.kind === "twoShots") {
      bullets(slide, s.bullets, MX, top - 0.15, CW, 13.5);
      const iw = 5.9, ih = iw / 1.6, iy = top + 1.35;
      borderedImage(slide, `${d.dir}/${s.imgs[0]}`, MX, iy, iw, ih);
      borderedImage(slide, `${d.dir}/${s.imgs[1]}`, MX + iw + 0.33, iy, iw, ih);
      return;
    }

    if (s.kind === "secCards") {
      const cw = 5.5, ch = 1.02, gap = 0.22;
      s.cards.forEach(([h1, b1], i) => {
        card(slide, MX, top + 0.1 + i * (ch + gap), cw, ch, h1, b1, 13.5, 10.5);
      });
      const iw = 6.15, ih = iw / 1.6;
      const ix = W - MX - iw, iy = top + 0.25;
      borderedImage(slide, `${d.dir}/${s.img}`, ix, iy, iw, ih);
      slide.addText(s.caption, {
        x: ix, y: iy + ih + 0.12, w: iw, h: 0.3, fontFace: FONT, fontSize: 10,
        color: SLATE, align: "center",
      });
      return;
    }

    if (s.kind === "pipeline") {
      const bw = 1.78, gap = (CW - 6 * bw) / 5, by = top + 0.55, bh = 0.95;
      s.steps.forEach((st, i) => {
        const bx = MX + i * (bw + gap);
        const accentStep = i === s.steps.length - 1;
        slide.addShape("roundRect", {
          x: bx, y: by, w: bw, h: bh, rectRadius: 0.09,
          fill: { color: accentStep ? BLUE2 : CHIP_BG },
          line: { color: accentStep ? BLUE2 : BLUE1, width: 1 },
        });
        slide.addText(st, {
          x: bx + 0.06, y: by, w: bw - 0.12, h: bh, fontFace: FONT, fontSize: 10.5,
          bold: true, color: accentStep ? WHITE : NAVY, align: "center", valign: "middle",
        });
        if (i < s.steps.length - 1) {
          slide.addText("→", {
            x: bx + bw - 0.02, y: by + 0.22, w: gap + 0.08, h: 0.5,
            fontFace: FONT, fontSize: 15, color: BLUE1, align: "center", valign: "middle",
          });
        }
      });
      const sw = (CW - 0.8) / 3, sy = by + 1.5, sh = 1.35;
      s.stats.forEach(([n, l], i) => statChip(slide, MX + i * (sw + 0.4), sy, sw, sh, n, l));
      return;
    }

    if (s.kind === "a11y") {
      bullets(slide, s.bullets, MX, top + 0.35, 8.6, 15);
      const ih = 4.55, iw = ih * (990 / 2324);
      borderedImage(slide, `${DESIGN}/${s.img}`, W - MX - iw - 1.1, top - 0.15, iw, ih);
      return;
    }

    if (s.kind === "final") {
      const sw = (CW - 0.8) / 3;
      s.stats.forEach(([n, l], i) => statChip(slide, MX + i * (sw + 0.4), top + 0.05, sw, 1.3, n, l));
      const ry = top + 1.7;
      s.rows.forEach(([k, v], i) => {
        const y = ry + i * 0.78;
        slide.addShape("roundRect", {
          x: MX, y, w: CW, h: 0.66, rectRadius: 0.09,
          fill: { color: CARD_BG }, line: { color: CARD_LINE, width: 1 },
        });
        slide.addText(k, {
          x: MX + 0.28, y, w: 2.6, h: 0.66, fontFace: FONT, fontSize: 12.5,
          bold: true, color: NAVY, valign: "middle",
        });
        slide.addText(v, {
          x: MX + 3.0, y, w: CW - 3.2, h: 0.66, fontFace: FONT, fontSize: 12.5,
          color: BLUE2, valign: "middle",
        });
      });
      return;
    }
  });

  return pptx.writeFile({ fileName: `${OUT}/${d.file}.pptx` });
}

// ---------- HTML + PDF ----------
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// relative src so the committed HTML opens from the repo
const rel = (p) => relative(OUT, p);

function slideHtml(d, s, idx) {
  const pill = `<div class="pill">${esc(d.pill)}</div>`;
  const hdr = (sub) =>
    `<div class="hdr"><div class="kick">${esc(s.kicker.toUpperCase())}</div>` +
    `<div class="ttl">${esc(s.title)}</div><div class="grad"></div>${sub || ""}${pill}</div>`;
  const foot = `<div class="foot"><span>${esc(d.footer)}</span><span>${idx + 1} / ${d.slides.length}</span></div>`;
  const img = (src, cls = "") => `<div class="shot ${cls}"><img src="${src}"></div>`;

  switch (s.kind) {
    case "title":
      return `<section class="slide title-slide"><div class="topgrad"></div>` +
        `<div class="twocol"><div class="tleft"><div class="kick">${esc(s.kicker.toUpperCase())}</div>` +
        `<h1>${esc(s.title)}</h1><div class="grad wide"></div>` +
        `<p class="sub">${esc(s.sub)}</p>` +
        `<div class="urlchip">${esc(s.url)}</div>` +
        `<p class="note">${esc(s.note)}</p></div>` +
        `<div class="shot title-shot"><img src="${rel(`${d.dir}/${s.img}`)}"></div></div>` +
        `<div class="foot"><b class="acc">${esc(d.pill)}</b></div></section>`;
    case "cards": {
      const cards = s.cards
        .map(([h1, b1]) => `<div class="card"><div class="ch">${esc(h1)}</div><div class="cb">${esc(b1)}</div></div>`)
        .join("");
      return `<section class="slide">${hdr()}<div class="grid2">${cards}</div>` +
        `<div class="punch">${esc(s.punch)}</div>${foot}</section>`;
    }
    case "shot":
      return `<section class="slide">${hdr()}<div class="twocol">` +
        `<ul class="bl">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` +
        `${img(rel(`${d.dir}/${s.img}`))}</div>${foot}</section>`;
    case "twoShots":
      return `<section class="slide">${hdr()}<ul class="bl wide">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` +
        `<div class="gridshots">${img(rel(`${d.dir}/${s.imgs[0]}`))}${img(rel(`${d.dir}/${s.imgs[1]}`))}</div>${foot}</section>`;
    case "secCards": {
      const cards = s.cards
        .map(([h1, b1]) => `<div class="card slim"><div class="ch">${esc(h1)}</div><div class="cb">${esc(b1)}</div></div>`)
        .join("");
      return `<section class="slide">${hdr()}<div class="twocol"><div class="stack">${cards}</div>` +
        `<div class="rcol">${img(rel(`${d.dir}/${s.img}`))}<div class="cap">${esc(s.caption)}</div></div></div>${foot}</section>`;
    }
    case "pipeline": {
      const steps = s.steps
        .map((st, i) => {
          const last = i === s.steps.length - 1;
          return `<div class="pstep${last ? " last" : ""}">${esc(st)}</div>` +
            (last ? "" : `<div class="parrow">→</div>`);
        })
        .join("");
      const stats = s.stats
        .map(([n, l]) => `<div class="stat"><div class="sn">${esc(n)}</div><div class="sl">${esc(l)}</div></div>`)
        .join("");
      return `<section class="slide">${hdr()}<div class="pipe">${steps}</div><div class="stats">${stats}</div>${foot}</section>`;
    }
    case "a11y":
      return `<section class="slide">${hdr()}<div class="twocol">` +
        `<ul class="bl big">${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` +
        `${img(rel(`${DESIGN}/${s.img}`), "portrait")}</div>${foot}</section>`;
    case "final": {
      const stats = s.stats
        .map(([n, l]) => `<div class="stat"><div class="sn">${esc(n)}</div><div class="sl">${esc(l)}</div></div>`)
        .join("");
      const rows = s.rows
        .map(([k, v]) => `<div class="row"><span class="rk">${esc(k)}</span><span class="rv">${esc(v)}</span></div>`)
        .join("");
      return `<section class="slide">${hdr()}<div class="stats">${stats}</div><div class="rows">${rows}</div>${foot}</section>`;
    }
    default:
      return "";
  }
}

function buildHtml(lang) {
  const d = decks[lang];
  const body = d.slides.map((s, i) => slideHtml(d, s, i)).join("\n");
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<style>
  @page { size: 1280px 720px; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Inter, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  .slide { width: 1280px; height: 720px; position: relative; overflow: hidden;
           background: #fff; page-break-after: always; padding: 34px 46px 44px; }
  .kick { color: #2563eb; font-weight: 700; font-size: 13px; letter-spacing: 2px; }
  .ttl { color: #0f172a; font-weight: 700; font-size: 33px; margin: 4px 0 10px; }
  .grad { height: 6px; width: 250px; background: ${cssGrad}; border-radius: 3px; }
  .grad.wide { width: 300px; height: 8px; }
  .hdr { position: relative; }
  .pill { position: absolute; top: 2px; right: 0; border: 1.5px solid #2563eb; color: #1d4ed8;
          background: #eff6ff; font-weight: 700; font-size: 12px; padding: 7px 18px; border-radius: 999px; }
  .foot { position: absolute; left: 46px; right: 46px; bottom: 18px; display: flex;
          justify-content: space-between; color: #94a3b8; font-size: 11px; }
  .foot b.acc { color: #1d4ed8; }
  .twocol { display: flex; gap: 28px; margin-top: 22px; align-items: flex-start; }
  .bl { color: #0f172a; font-size: 18px; line-height: 1.45; padding-left: 22px; width: 470px; }
  .bl li { margin-bottom: 14px; }
  .bl.wide { width: auto; font-size: 16.5px; }
  .bl.big { width: auto; flex: 1; font-size: 20px; }
  .shot { border: 1.5px solid #d5dbe3; border-radius: 10px; padding: 5px; background: #fff; }
  .shot img { width: 100%; display: block; border-radius: 5px; }
  .twocol .shot { width: 585px; }
  .shot.portrait { width: 240px; margin: 0 auto; }
  .gridshots { display: flex; gap: 28px; margin-top: 20px; }
  .gridshots .shot { width: 575px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; margin-top: 24px; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; }
  .card .ch { color: #1d4ed8; font-weight: 700; font-size: 18px; margin-bottom: 6px; }
  .card .cb { color: #475569; font-size: 14.5px; line-height: 1.35; }
  .card.slim { padding: 12px 18px; margin-bottom: 16px; }
  .card.slim .ch { font-size: 16px; margin-bottom: 3px; }
  .card.slim .cb { font-size: 13px; }
  .stack { width: 470px; }
  .rcol { flex: 1; }
  .cap { text-align: center; color: #475569; font-size: 12.5px; margin-top: 8px; }
  .punch { margin-top: 26px; background: #eff6ff; border: 1px solid #2563eb; border-radius: 12px;
           padding: 16px 24px; color: #0f172a; font-weight: 700; font-size: 18px; }
  .title-slide { padding-top: 60px; }
  .topgrad { position: absolute; top: 0; left: 0; right: 0; height: 12px; background: ${cssGrad}; }
  .twocol.title-row {}
  .title-slide .twocol { margin-top: 0; }
  .tleft { width: 620px; padding-top: 46px; }
  .tleft h1 { font-size: 58px; color: #0f172a; margin: 12px 0 16px; }
  .tleft .sub { color: #475569; font-size: 20px; line-height: 1.4; margin-top: 22px; }
  .urlchip { display: inline-block; margin-top: 28px; border: 1.5px solid #2563eb; color: #1d4ed8;
             background: #eff6ff; font-weight: 700; font-size: 17px; padding: 10px 26px; border-radius: 999px; }
  .tleft .note { color: #94a3b8; font-size: 13.5px; margin-top: 22px; line-height: 1.4; }
  .title-shot { width: 500px; margin-top: 40px; }
  .pipe { display: flex; align-items: center; gap: 10px; margin-top: 42px; }
  .pstep { flex: 1; border: 1px solid #2563eb; background: #eff6ff; color: #0f172a;
           font-weight: 700; font-size: 13.5px; text-align: center; padding: 20px 6px; border-radius: 10px; }
  .pstep.last { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
  .parrow { color: #2563eb; font-size: 20px; font-weight: 700; }
  .stats { display: flex; gap: 30px; margin-top: 34px; }
  .stat { flex: 1; background: #eff6ff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 22px; }
  .sn { color: #2563eb; font-weight: 700; font-size: 36px; }
  .sl { color: #475569; font-size: 13.5px; margin-top: 2px; }
  .rows { margin-top: 26px; display: flex; flex-direction: column; gap: 12px; }
  .row { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
         padding: 13px 22px; display: flex; gap: 26px; font-size: 15.5px; }
  .rk { color: #0f172a; font-weight: 700; width: 210px; }
  .rv { color: #1d4ed8; }
</style></head><body>${body}</body></html>`;
  const p = `${OUT}/${d.file}.html`;
  writeFileSync(p, html);
  return p;
}

async function htmlToPdf(htmlPath, pdfPath) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto("file://" + htmlPath, { waitUntil: "networkidle" });
    await page.pdf({
      path: pdfPath,
      width: "1280px",
      height: "720px",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
  } finally {
    await browser.close();
  }
}

// ---------- main ----------
for (const lang of ["ru", "en"]) {
  const d = decks[lang];
  await renderPptx(lang);
  console.log(`pptx ok: ${d.file}.pptx`);
  const htmlPath = buildHtml(lang);
  await htmlToPdf(htmlPath, `${OUT}/${d.file}.pdf`);
  console.log(`pdf ok: ${d.file}.pdf`);
}
console.log("done");
