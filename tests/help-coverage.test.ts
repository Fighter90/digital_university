// DIG-112+113 — «максимальная полнота» справки (red-first). Приёмка:
// у КАЖДОГО раздела меню кабинета (студент + сотрудник /staff*) есть
// статья справки: раздел гайда «как пользоваться» (/guide, GUIDE_SECTIONS)
// и статья FAQ «частые вопросы» (/help, FAQ_ARTICLES с кнопкой-глубинкой
// в раздел). RU и EN каталоги параллельны (паттерн DIG-88: двуязычные
// поля — RU-канон + EN-тексты по тем же id). Поиск по словоформам
// находит новые статьи так же, как старые (стеммер faqStems).
import { describe, expect, it } from 'vitest';

import {
  CABINET_SECTIONS,
  MORE_SECTIONS,
  STAFF_SECTIONS,
  TAB_SECTIONS,
} from '@/components/shell/nav-items';
import { guideSections } from '@/lib/help-content';
import {
  FAQ_ARTICLES,
  FAQ_ARTICLES_EN_TEXT,
  faqArticles,
  searchFaqArticles,
} from '@/lib/faq-kb-catalog';

/** Мета-разделы меню: «Ещё» — агрегатор ссылок, /guide — сам гайд. */
const META_HREFS = new Set(['/more', '/guide']);

/** Уникальные href всех меню студента (полное, таб-бар, «Ещё») и сотрудника. */
function menuHrefs(): string[] {
  const all = [
    ...CABINET_SECTIONS,
    ...TAB_SECTIONS,
    ...MORE_SECTIONS,
    ...STAFF_SECTIONS,
  ].map((section) => section.href);
  return [...new Set(all)];
}

/** Экраны, у которых обязана быть FAQ-статья с глубинкой. */
function faqScreenHrefs(): string[] {
  // /help — сама база знаний: статья про неё в гайде, cta на себя не нужна.
  return menuHrefs().filter((href) => href !== '/help' && !META_HREFS.has(href));
}

/** Статья покрывает экран: cta ведёт точно в раздел или внутрь него. */
function coversScreen(ctaHref: string, screen: string): boolean {
  return ctaHref === screen || `${screen}/`.startsWith(`${ctaHref}/`);
}

describe('DIG-112: гайд «как пользоваться» — по разделу на каждый экран меню', () => {
  it('у каждого раздела меню есть раздел гайда с этим href (RU)', () => {
    const hrefs = GUIDE_SECTIONS_SEEN();
    const guideHrefs = guideSections('ru').map((section) => section.href);
    for (const href of hrefs) {
      expect(guideHrefs, `раздел гайда для ${href}`).toContain(href);
    }
  });

  it('у каждого раздела меню есть раздел гайда и на EN, с тем же id и шагами', () => {
    const ru = guideSections('ru');
    const en = guideSections('en');
    const enById = new Map(en.map((section) => [section.id, section]));
    for (const href of GUIDE_SECTIONS_SEEN()) {
      const ruMatches = ru.filter((section) => section.href === href);
      expect(ruMatches.length, `RU-разделы для ${href}`).toBeGreaterThanOrEqual(1);
      for (const ruSection of ruMatches) {
        const enSection = enById.get(ruSection.id);
        expect(enSection, `EN-раздел для ${ruSection.id}`).toBeTruthy();
        expect(enSection!.href, `href ${ruSection.id} совпадает`).toBe(ruSection.href);
        expect(enSection!.steps.length, `число шагов ${ruSection.id}`).toBe(
          ruSection.steps.length,
        );
        expect(enSection!.callouts?.length ?? 0).toBe(ruSection.callouts?.length ?? 0);
      }
    }
  });

  it('у каждого раздела гайда непустые заголовок, описание и шаги', () => {
    for (const section of guideSections('ru')) {
      expect(section.title.trim().length, `${section.id}: title`).toBeGreaterThan(3);
      expect(section.summary.trim().length, `${section.id}: summary`).toBeGreaterThan(10);
      expect(section.steps.length, `${section.id}: steps`).toBeGreaterThanOrEqual(2);
      for (const step of section.steps) expect(step.text.trim().length).toBeGreaterThan(10);
    }
  });
});

describe('DIG-112: FAQ «частые вопросы» — по статье на каждый экран меню', () => {
  it('у каждого экрана меню есть статья с кнопкой-глубинкой в этот экран', () => {
    for (const href of faqScreenHrefs()) {
      const hit = FAQ_ARTICLES.find(
        (article) => article.cta && coversScreen(article.cta.href, href),
      );
      expect(hit, `FAQ-статья с cta → ${href}`).toBeTruthy();
    }
  });

  it('RU/EN паритет: каждой RU-статье соответствует EN-текст по id', () => {
    for (const article of FAQ_ARTICLES) {
      const en = FAQ_ARTICLES_EN_TEXT[article.id];
      expect(en, `EN-тексты для ${article.id}`).toBeTruthy();
      expect(en!.question.trim().length, `${article.id}: EN question`).toBeGreaterThan(5);
      expect(en!.answer.trim().length, `${article.id}: EN answer`).toBeGreaterThan(20);
      if (article.cta) expect(en!.ctaLabel, `${article.id}: EN ctaLabel`).toBeTruthy();
    }
    expect(faqArticles('en').map((article) => article.id)).toEqual(
      FAQ_ARTICLES.map((article) => article.id),
    );
  });

  it('EN-тексты без кириллицы (паттерн DIG-88)', () => {
    const cyrillic = /[А-Яа-яЁё]/;
    for (const article of faqArticles('en')) {
      expect(article.question, `${article.id}: EN question`).not.toMatch(cyrillic);
      expect(article.answer, `${article.id}: EN answer`).not.toMatch(cyrillic);
      if (article.cta) expect(article.cta.label, `${article.id}: EN cta`).not.toMatch(cyrillic);
    }
  });
});

describe('DIG-112: поиск по словоформам находит новые статьи', () => {
  it.each([
    ['уведомления', 'cab-notifications'],
    ['уведомлений', 'cab-notifications'],
    ['профиле', 'cab-profile'],
    ['новости', 'cab-news'],
    ['новостей', 'cab-news'],
    ['рейтинг группы', 'cab-grades'],
    ['зачётка', 'cab-grades'],
    ['главная', 'cab-dashboard'],
    ['мероприятию', 'cab-events'],
    ['стартапом', 'cab-msp'],
    ['объявления', 'cab-staff'],
    ['ассистент голос', 'cab-ai-assistant'],
    ['стипендиальные договоры', 'cab-finance'],
  ])('RU-запрос «%s» находит %s', (query, id) => {
    expect(searchFaqArticles(query).map((article) => article.id)).toContain(id);
  });

  it.each([
    ['notifications', 'cab-notifications'],
    ['dashboard', 'cab-dashboard'],
    ['gradebook', 'cab-grades'],
    ['staff queue', 'cab-staff'],
  ])('EN-запрос «%s» находит %s', (query, id) => {
    expect(searchFaqArticles(query, 'en').map((article) => article.id)).toContain(id);
  });
});

/** href, для которых требуется раздел гайда (все меню минус мета). */
function GUIDE_SECTIONS_SEEN(): string[] {
  return menuHrefs().filter((href) => !META_HREFS.has(href));
}
