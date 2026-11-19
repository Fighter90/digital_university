// DIG-89 — EN-локализация часть 3: все остальные разделы кабинета.
//
// Приёмка задачи: на локали en в видимом рендере перечисленных маршрутов
// НЕ должно быть кириллицы (демо-ФИО студентов/преподавателей допустимы).
// Красный-первый контур:
//  1) EN-словарь не содержит кириллицы, наборы ключей RU/EN совпадают;
//  2) EN-демо-контент каталогов (events/dpo/msp/news/notifications/deadlines)
//     полон и без кириллицы;
//  3) runtime-уведомления локализуются чтением по известным шаблонам;
//  4) EN-рендер компонентов маршрутов — без кириллицы;
//  5) страницы скоупа не содержат кириллических литералов вне комментариев
//     (все видимые строки — через словарь/маппинги).
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { createElement } from 'react';

// Client-островки с роутером — подменяем, как в tests/i18n-en-surfaces.test.tsx.
const replaceMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/staff',
}));

afterEach(cleanup);

import { en } from '@/lib/i18n/en';
import { ru as ruDict } from '@/lib/i18n/ru';
import {
  enDpoDocTitle,
  enDpoProgram,
  enEvent,
  enMspComment,
  enMspProject,
  enNewsItem,
  enNotificationSeed,
  enStudyDeadline,
  enStudentTask,
  localizeNotification,
} from '@/lib/en-demo-content';
import { eventKindLabel, eventsFilterLabel, spotsLeftLabel } from '@/lib/events';
import {
  FEEDBACK_RESPONSE_PROMISE_EN,
  feedbackAnonymousHint,
  feedbackDueLabel,
  feedbackOutcome,
  feedbackStatusLabel,
  feedbackTargetLabel,
  feedbackTypeLabel,
} from '@/lib/feedback';
import {
  financeDocKindLabel,
  financeDocKindPluralLabel,
  financeFilterEmptyLabel,
  financeFilterLabel,
  financePayStatusLabel,
  financePayoutKindLabel,
  formatFinanceDate,
} from '@/lib/finance-catalog';
import { newsScopeLabel, newsTopicLabel } from '@/lib/news-catalog';
import { notificationChannelLabel, notificationTypeLabel } from '@/lib/notification-labels';
import {
  NOTIFICATION_FILTERS_EN,
  groupNotificationsByDay,
  notificationFilterLabel,
} from '@/lib/notification-view';
import { requestTypeLabel } from '@/lib/request-labels';
import { appealTemplateList } from '@/lib/staff-appeal-templates';
import { controlLabel, elementKindLabel } from '@/lib/gradebook';
import { dashboardWidgetMeta } from '@/lib/dashboard-widgets';
import { creditWord } from '@/lib/performance-format';
import { TasksView } from '@/components/tasks/tasks-view';
import { NotificationItemRow } from '@/components/notifications/notification-item-row';
import { NotificationsScreen } from '@/components/notifications/notifications-screen';
import { TicketChat } from '@/components/deanery/ticket-chat';
import { TicketComposer } from '@/components/deanery/ticket-composer';
import { TicketList } from '@/components/deanery/ticket-list';
import { TicketReplyForm } from '@/components/deanery/ticket-reply-form';
import { TicketStatusBadge } from '@/components/deanery/ticket-status-badge';
import { FeedbackComposer } from '@/components/feedback/feedback-composer';
import { FeedbackList } from '@/components/feedback/feedback-list';
import { FeedbackOutcomes } from '@/components/feedback/feedback-outcomes';
import { FeedbackStatusBadge } from '@/components/feedback/feedback-status-badge';
import { FinanceDocumentsBrowser } from '@/components/finance/documents-browser';
import { EventCard } from '@/components/events/event-card';
import { EventRegisterButton } from '@/components/events/event-register-button';
import { EventsFilterChips } from '@/components/events/events-filter-chips';
import { NewsCard } from '@/components/news/news-card';
import { AnnouncementsStrip } from '@/components/news/announcements-strip';
import { NewsScopeTabs } from '@/components/news/news-scope-tabs';
import { NewsTopicPills } from '@/components/news/news-topic-pills';
import { ShareButton } from '@/components/news/share-button';
import { MspProjectCard } from '@/components/msp/msp-project-card';
import { MspSortTabs } from '@/components/msp/msp-sort-tabs';
import { MspVoteButton } from '@/components/msp/msp-vote-button';
import { MspCommentForm } from '@/components/msp/msp-comment-form';
import { MspCommentList } from '@/components/msp/msp-comment-list';
import { MspLaunchComposer } from '@/components/msp/msp-launch-composer';
import { MspLaunchOfDay } from '@/components/msp/msp-launch-of-day';
import { DpoTabs } from '@/components/dpo/dpo-tabs';
import { DpoFormatChips } from '@/components/dpo/dpo-format-chips';
import { DpoProgramCard } from '@/components/dpo/dpo-program-card';
import { DpoMyProgramCard } from '@/components/dpo/dpo-my-program-card';
import { DpoDocumentList } from '@/components/dpo/dpo-document-list';
import { PeopleBrowser } from '@/components/people/people-browser';
import { ServicesBrowser } from '@/components/services/services-browser';
import { ServiceCard } from '@/components/services/service-card';
import { ContactsForm } from '@/components/profile/contacts-form';
import { DataErrorReport } from '@/components/profile/data-error-report';
import { MaskedBadge } from '@/components/profile/masked-badge';
import { NotificationSettings } from '@/components/profile/notification-settings';
import { ThemePicker } from '@/components/profile/theme-picker';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { PasswordForm } from '@/components/settings/password-form';
import { QuietHoursSettings } from '@/components/settings/quiet-hours-settings';
import { SessionsList } from '@/components/settings/sessions-list';
import { VoiceSettings } from '@/components/settings/voice-settings';
import { WidgetsSettings } from '@/components/settings/widgets-settings';
import { McpSettings } from '@/components/settings/mcp-settings';
import { McpDeaneryServer } from '@/components/settings/mcp-deanery-server';
import { ConsultationList } from '@/components/session/consultation-list';
import { ExamTimeline } from '@/components/session/exam-timeline';
import { RetakeList } from '@/components/session/retake-list';
import { RetakeSignupForm } from '@/components/session/retake-signup-form';
import { CalendarSubscribeCard } from '@/components/session/calendar-subscribe-card';
import { GradebookList } from '@/components/gradebook/gradebook-list';
import { GradeFormula } from '@/components/gradebook/grade-formula';
import { GradeAppealForm } from '@/components/gradebook/grade-appeal-form';
import { StaffNav } from '@/components/staff/staff-nav';
import { RequestStatusForm } from '@/components/staff/request-status-form';
import { AppealForms } from '@/components/staff/appeal-forms';
import { AnnouncementForm } from '@/components/staff/announcement-form';
import type { NotificationFeedItem } from '@/lib/notification-view';

const CYRILLIC = /[А-Яа-яЁё]/;

function expectNoCyrillic(html: string, what: string) {
  const hit = CYRILLIC.exec(html);
  expect(
    hit,
    `${what}: кириллица в EN-рендере: …${html.slice(Math.max(0, (hit?.index ?? 0) - 40), (hit?.index ?? 0) + 60)}…`,
  ).toBeNull();
}

// ── 1. словари ────────────────────────────────────────────────────────────────

describe('DIG-89: EN-словарь без кириллицы', () => {
  it('ни одно EN-значение не содержит кириллицы', () => {
    for (const [key, value] of Object.entries(en)) {
      if (key.startsWith('locale.')) continue;
      expect(CYRILLIC.test(value), `ключ ${key}: «${value}»`).toBe(false);
    }
  });

  it('наборы ключей RU и EN идентичны', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ruDict).sort());
  });

  it('RU-строки новых ключей байт-в-байт равны прежним строкам интерфейса', () => {
    // задачи
    expect(ruDict['tasks.group.overdue']).toBe('Просрочено');
    expect(ruDict['tasks.group.today']).toBe('Сегодня');
    expect(ruDict['tasks.group.week']).toBe('На этой неделе');
    expect(ruDict['tasks.group.later']).toBe('Позже');
    expect(ruDict['tasks.empty.title']).toBe('Все дела сделаны 🎉');
    expect(ruDict['tasks.subtitle']).toContain('Единый список дел');
    expect(ruDict['tasks.openCount']).toBe('Открытых задач: {count}');
    expect(ruDict['tasks.errorTitle']).toBe('Задачи не загрузились');
    // уведомления
    expect(ruDict['notif.subtitle']).toContain('События кабинета');
    expect(ruDict['notif.openSettings']).toBe('Настроить уведомления');
    expect(ruDict['notif.markAllRead']).toBe('Отметить все прочитанными');
    expect(ruDict['notif.empty.title']).toBe('Новых уведомлений нет');
    expect(ruDict['notif.group.today']).toBe('Сегодня');
    expect(ruDict['notif.group.yesterday']).toBe('Вчера');
    expect(ruDict['notif.group.earlier']).toBe('Ранее');
    expect(ruDict['notif.filter.ALL']).toBe('Все');
    // деканат
    expect(ruDict['deanery.list.title']).toBe('Мои обращения');
    expect(ruDict['deanery.compose.title']).toBe('Новое обращение');
    expect(ruDict['deanery.chat.readAt']).toBe('Прочитано');
    // обратная связь
    expect(ruDict['feedback.type.SUGGESTION']).toBe('Предложение');
    expect(ruDict['feedback.target.DEANERY']).toBe('Деканат');
    // мероприятия
    expect(ruDict['events.title']).toBe('Мероприятия вуза');
    expect(ruDict['events.kind.LECTURE']).toBe('Лекция');
    expect(ruDict['events.filter.week']).toBe('На этой неделе');
    // персоналии
    expect(ruDict['staff.appealForm.replyTitle']).toBe('Ответить студенту');
    expect(ruDict['staff.queue.allDeadlines']).toBe('Все сроки');
  });
});

// ── 2. EN-демо-контент ────────────────────────────────────────────────────────

describe('DIG-89: EN-демо-контент без кириллицы', () => {
  it('мероприятия (ev-*): титул, описание, место — EN для каждой записи', () => {
    const ids = [
      'ev-lecture-ai',
      'ev-career-day',
      'ev-tour',
      'ev-hackathon',
      'ev-webinar',
      'ev-culture-night',
    ];
    for (const id of ids) {
      const item = enEvent(id);
      expect(item, id).not.toBeNull();
      expectNoCyrillic(`${item!.title} ${item!.description} ${item!.location}`, `event ${id}`);
    }
    expect(enEvent('ev-unknown')).toBeNull();
  });

  it('программы ДПО (dpo-*) и документы (dpo-doc-*) — EN', () => {
    for (const id of [
      'dpo-analytics',
      'dpo-uxui',
      'dpo-pm',
      'dpo-python',
      'dpo-pedagogy',
      'dpo-cybersec',
    ]) {
      const program = enDpoProgram(id);
      expect(program, id).not.toBeNull();
      expectNoCyrillic(
        `${program!.title} ${program!.description} ${program!.tags.join(' ')}`,
        `dpo ${id}`,
      );
    }
    for (const id of ['dpo-doc-1', 'dpo-doc-2', 'dpo-doc-3']) {
      const title = enDpoDocTitle(id);
      expect(title, id).not.toBeNull();
      expectNoCyrillic(title!, `dpo-doc ${id}`);
    }
  });

  it('проекты МСП (msp-*) и сид-комментарии — EN', () => {
    for (const id of [
      'msp-konspekt',
      'msp-repetitor',
      'msp-deadline',
      'msp-biblio',
      'msp-timlider',
      'msp-studcoffee',
      'msp-stipfond',
    ]) {
      const project = enMspProject(id);
      expect(project, id).not.toBeNull();
      expectNoCyrillic(
        `${project!.title} ${project!.tagline} ${project!.description} ${project!.tags.join(' ')}`,
        `msp ${id}`,
      );
    }
    expect(enMspComment('msp-cmt-1')).not.toBeNull();
    expectNoCyrillic(enMspComment('msp-cmt-1')!, 'msp comment');
  });

  it('новости каталога — EN титул и лид для каждой записи', () => {
    // ids каталога новостей из lib/news-catalog (фиксированные).
    for (const id of [
      'news-schedule-moved',
      'news-scholarship-november',
      'news-dormitory-deadline',
      'news-faculty-it-hackathon',
      'news-exam-week',
    ]) {
      const item = enNewsItem(id);
      if (item === null) continue; // id из теста не входит в каталог — пропускаем
      expectNoCyrillic(`${item.title} ${item.excerpt}`, `news ${id}`);
    }
  });

  it('seed-уведомления (ntf-*) — EN титул и текст', () => {
    for (const id of [
      'ntf-anna-1',
      'ntf-anna-2',
      'ntf-anna-3',
      'ntf-anna-4',
      'ntf-anna-5',
      'ntf-anna-6',
      'ntf-anna-7',
      'ntf-anna-8',
      'ntf-anna-9',
      'ntf-ilya-1',
      'ntf-ilya-2',
      'ntf-ilya-3',
      'ntf-ilya-4',
      'ntf-ilya-5',
      'ntf-ilya-6',
    ]) {
      const seed = enNotificationSeed(id);
      expect(seed, id).not.toBeNull();
      expectNoCyrillic(`${seed!.title} ${seed!.body}`, `notification ${id}`);
    }
  });

  it('сид-дедлайны (dl-*) и ручные задачи (task-*) — EN', () => {
    for (const id of [
      'dl-pi21-phys-test',
      'dl-pi21-hist-case',
      'dl-pi21-disc-project',
      'dl-pi21-alg-essay',
      'dl-ek11-econ-essay',
      'dl-ek11-math-hw',
    ]) {
      const title = enStudyDeadline(id);
      expect(title, id).not.toBeNull();
      expectNoCyrillic(title!, `deadline ${id}`);
    }
    for (const id of ['task-anna-sign', 'task-anna-pay', 'task-ilya-pay']) {
      const task = enStudentTask(id);
      expect(task, id).not.toBeNull();
      expectNoCyrillic(`${task!.title} ${task!.note}`, `student task ${id}`);
    }
  });
});

// ── 3. runtime-уведомления: локализация чтением ──────────────────────────────

describe('DIG-89: localizeNotification — известные шаблоны на EN', () => {
  const row = (over: Partial<NotificationFeedItem>): NotificationFeedItem => ({
    id: 'ntf-x',
    type: 'REQUEST',
    title: '',
    body: '',
    isRead: false,
    important: false,
    actionLabel: null,
    link: '/requests',
    createdAt: new Date(2026, 10, 16, 10, 5).toISOString(),
    ...over,
  });

  it('подача заявки: мгновенная и с SLA', () => {
    const instant = localizeNotification(
      'en',
      row({ title: 'Заявка ЗД-2026-000123', body: '«Справка об обучении»: документ готов к скачиванию.' }),
    );
    expect(instant.title).toBe('Request ЗД-2026-000123');
    expect(instant.body).toBe('"Enrollment certificate": the document is ready for download.');

    const submitted = localizeNotification(
      'en',
      row({ body: '«Справка об обучении»: заявка подана. Готовность до 18 ноября.' }),
    );
    expect(submitted.body).toBe('"Enrollment certificate": the request has been submitted. Ready by November 18.');
  });

  it('переход статуса: причина, готов, выдан, отменена, повторно', () => {
    expect(
      localizeNotification('en', row({ body: '«Справка»: деканат принял заявку. Причина: нет скана' }))
        .body,
    ).toBe('"Справка": the deanery accepted the request. Reason: нет скана');
    expect(
      localizeNotification('en', row({ body: '«Справка»: документ готов к скачиванию' })).body,
    ).toBe('"Справка": the document is ready for download');
    expect(localizeNotification('en', row({ body: '«Справка»: документ выдан' })).body).toBe(
      '"Справка": the document has been issued',
    );
    expect(
      localizeNotification('en', row({ body: '«Справка»: заявка отменена студентом' })).body,
    ).toBe('"Справка": the request was cancelled by the student');
    expect(
      localizeNotification('en', row({ body: '«Справка»: заявка исправлена и подана повторно' }))
        .body,
    ).toBe('"Справка": the request was fixed and resubmitted');
    expect(
      localizeNotification('en', row({ body: '«Справка»: заявка принята деканатом. Готовность до 20 ноября' }))
        .body,
    ).toBe('"Справка": the request has been accepted by the deanery. Ready by November 20');
  });

  it('пересдача, email, ассистент, обращение, перенос пары', () => {
    expect(
      localizeNotification(
        'en',
        row({
          title: 'Заявка на пересдачу создана',
          body:
            'Заявка SR-2026-000001 — запись на пересдачу по «Базы данных» ' +
            '(20 ноября, 10:00–11:30, ауд. 301). Деканат подтвердит запись в статусе заявки.',
        }),
      ).title,
    ).toBe('Retake request created');
    // Легаси-тексты в БД («каб.») переводятся тем же правилом (BUG-15).
    expect(
      localizeNotification(
        'en',
        row({
          title: 'Заявка на пересдачу создана',
          body:
            'Заявка SR-2026-000001 — запись на пересдачу по «Базы данных» ' +
            '(20 ноября, 10:00–11:30, каб. 301). Деканат подтвердит запись в статусе заявки.',
        }),
      ).title,
    ).toBe('Retake request created');
    expect(
      localizeNotification('en', row({ title: 'Документ отправлен на email' })).title,
    ).toBe('Document sent to email');
    expect(
      localizeNotification(
        'en',
        row({ title: 'Заявка на «Справка для отсрочки от армии» создана' }),
      ).title,
    ).toBe('Request for "Справка для отсрочки от армии" created');
    expect(
      localizeNotification('en', row({ title: 'Ответ по обращению', body: 'Мария Ковалёва ответил в обращении №TS-2026-000001.' }))
        .body,
    ).toBe('Мария Ковалёва replied to ticket №TS-2026-000001.');
    expect(
      localizeNotification(
        'en',
        row({ type: 'SCHEDULE', title: 'Пара «Базы данных» перенесена в ауд. 214' }),
      ).title,
    ).toBe('Class "Базы данных" rescheduled to room 214');
    expect(
      localizeNotification('en', row({ type: 'SCHEDULE', title: 'Пара «Базы данных» сегодня отменена' })).title,
    ).toBe('Class "Базы данных" is cancelled today');
  });

  it('actionLabel и RU-фолбэк', () => {
    expect(localizeNotification('en', row({ actionLabel: 'Скачать' })).actionLabel).toBe('Download');
    expect(localizeNotification('en', row({ actionLabel: 'Открыть расписание' })).actionLabel).toBe(
      'Open schedule',
    );
    // Неизвестный шаблон — строка возвращается как есть (fallback RU).
    const unknown = localizeNotification('en', row({ body: 'Совсем неизвестный текст' }));
    expect(unknown.body).toBe('Совсем неизвестный текст');
    // RU — без изменений.
    const ruRow = localizeNotification(
      'ru',
      row({ body: '«Справка об обучении»: документ готов к скачиванию.' }),
    );
    expect(ruRow.body).toBe('«Справка об обучении»: документ готов к скачиванию.');
  });
});

// ── 4. хелперы-лейблы: EN без кириллицы для всех значений ────────────────────

describe('DIG-89: EN-лейблы хелперов без кириллицы', () => {
  it('events: типы, фильтры, места', () => {
    for (const kind of ['LECTURE', 'HACKATHON', 'CAREER', 'CULTURE'] as const) {
      expectNoCyrillic(eventKindLabel(kind, 'en'), `eventKind ${kind}`);
      expect(eventKindLabel(kind)).not.toBe(eventKindLabel(kind, 'en'));
    }
    for (const filter of ['all', 'week', 'faculty', 'career', 'online'] as const) {
      expectNoCyrillic(eventsFilterLabel(filter, 'en'), `eventsFilter ${filter}`);
    }
    expectNoCyrillic(spotsLeftLabel(0, 'en'), 'spots 0');
    expectNoCyrillic(spotsLeftLabel(5, 'en'), 'spots 5');
  });

  it('feedback: типы, адресаты, статусы, сроки, подсказки', () => {
    for (const kind of ['SUGGESTION', 'COMPLAINT', 'GRATITUDE'] as const) {
      expectNoCyrillic(feedbackTypeLabel(kind, 'en'), `feedbackType ${kind}`);
    }
    for (const target of ['DEANERY', 'ACADEMIC_OFFICE', 'PROGRAM_MANAGEMENT', 'UNIVERSITY_MANAGEMENT'] as const) {
      expectNoCyrillic(feedbackTargetLabel(target, 'en'), `feedbackTarget ${target}`);
    }
    for (const status of ['NEW', 'ANSWERED', 'RESOLVED'] as const) {
      expectNoCyrillic(feedbackStatusLabel(status, 'en'), `feedbackStatus ${status}`);
    }
    expectNoCyrillic(
      feedbackDueLabel(new Date(2026, 10, 20), 'en'),
      'feedbackDueLabel',
    );
    expect(FEEDBACK_RESPONSE_PROMISE_EN).not.toMatch(CYRILLIC);
    expectNoCyrillic(feedbackAnonymousHint(true, 'en'), 'anon hint true');
    expectNoCyrillic(feedbackAnonymousHint(false, 'en'), 'anon hint false');
    const outcome = feedbackOutcome('en');
    expect(outcome).not.toMatch(CYRILLIC);
  });

  it('finance: виды документов, фильтры, статусы оплат, выплаты, даты', () => {
    for (const kind of ['CONTRACT', 'AGREEMENT', 'ACT', 'RECEIPT', 'INVOICE'] as const) {
      expectNoCyrillic(financeDocKindLabel(kind, 'en'), `docKind ${kind}`);
      expectNoCyrillic(financeDocKindPluralLabel(kind, 'en'), `docKindPlural ${kind}`);
    }
    expectNoCyrillic(financeFilterLabel('ALL', 'en'), 'filter ALL');
    for (const status of ['PAID', 'DUE', 'UPCOMING'] as const) {
      expectNoCyrillic(financePayStatusLabel(status, 'en'), `payStatus ${status}`);
    }
    for (const kind of ['SCHOLARSHIP', 'AID'] as const) {
      expectNoCyrillic(financePayoutKindLabel(kind, 'en'), `payout ${kind}`);
    }
    expectNoCyrillic(financeFilterEmptyLabel('RECEIPT', 'en'), 'filter empty');
    expectNoCyrillic(formatFinanceDate(new Date(2026, 10, 20), 'en'), 'finance date');
  });

  it('news, notifications, requests, gradebook, widgets, credits', () => {
    for (const topic of ['study', 'events', 'scholarship', 'dormitory'] as const) {
      expectNoCyrillic(newsTopicLabel(topic, 'en'), `topic ${topic}`);
    }
    for (const scope of ['group', 'faculty', 'university'] as const) {
      expectNoCyrillic(newsScopeLabel(scope, 'en'), `scope ${scope}`);
    }
    for (const type of ['SCHEDULE', 'GRADE', 'REQUEST', 'NEWS', 'TICKET', 'SYSTEM', 'DEADLINE'] as const) {
      expectNoCyrillic(notificationTypeLabel(type, 'en'), `notifType ${type}`);
    }
    for (const channel of ['PUSH', 'EMAIL', 'TELEGRAM'] as const) {
      expectNoCyrillic(notificationChannelLabel(channel, 'en'), `channel ${channel}`);
    }
    expect(Object.keys(en).filter((k) => k.startsWith('notif.filter.')).length).toBeGreaterThanOrEqual(6);
    for (const filter of NOTIFICATION_FILTERS_EN) {
      expectNoCyrillic(filter.label, `notif filter ${filter.value}`);
    }
    for (const type of ['CERTIFICATE', 'STATEMENT', 'PRACTICE', 'DORMITORY', 'OTHER'] as const) {
      expectNoCyrillic(requestTypeLabel(type, 'en'), `reqType ${type}`);
    }
    for (const control of ['EXAM', 'DIFF_CREDIT', 'CREDIT'] as const) {
      expectNoCyrillic(controlLabel(control, 'en'), `control ${control}`);
    }
    for (const kind of ['TEST', 'HOMEWORK', 'LAB', 'PROJECT', 'EXAM'] as const) {
      expectNoCyrillic(elementKindLabel(kind, 'en'), `element ${kind}`);
    }
    for (const id of ['today', 'deadlines', 'tasks', 'performance', 'requests', 'news', 'events'] as const) {
      const meta = dashboardWidgetMeta(id, 'en');
      expectNoCyrillic(`${meta.label} ${meta.description}`, `widget ${id}`);
    }
    expect(creditWord(1, 'en')).toBe('credit');
    expectNoCyrillic(creditWord(5, 'en'), 'creditWord 5');
  });

  it('уведомления: EN-группы дней', () => {
    const now = new Date(2026, 10, 17, 12, 0);
    const items: NotificationFeedItem[] = [
      {
        id: 'a',
        type: 'REQUEST',
        title: 'x',
        body: 'y',
        isRead: false,
        important: false,
        actionLabel: null,
        link: null,
        createdAt: new Date(2026, 10, 17, 9, 0).toISOString(),
      },
      {
        id: 'b',
        type: 'GRADE',
        title: 'x',
        body: 'y',
        isRead: true,
        important: false,
        actionLabel: null,
        link: null,
        createdAt: new Date(2026, 10, 16, 9, 0).toISOString(),
      },
    ];
    const groups = groupNotificationsByDay(items, now, 'en');
    expect(groups.map((g) => g.label).join(',')).toBe('Today,Yesterday');
    const ruGroups = groupNotificationsByDay(items, now);
    expect(ruGroups.map((g) => g.label).join(',')).toBe('Сегодня,Вчера');
  });

  it('staff: шаблоны ответов на EN', () => {
    const templates = appealTemplateList('en');
    expect(templates.length).toBeGreaterThan(0);
    for (const template of templates) {
      expectNoCyrillic(`${template.label} ${template.text}`, `template ${template.id}`);
    }
  });
});

// ── 5. EN-рендер компонентов маршрутов ───────────────────────────────────────

describe('DIG-89: задачи (/tasks) — EN без кириллицы', () => {
  const task = {
    id: 'course-dl-1',
    source: 'COURSE' as const,
    verb: 'Submit: Kinematics test',
    origin: 'Computer Science',
    dueAt: new Date(2026, 10, 20, 23, 59),
    daysLeft: 3,
    href: '/grades/X',
    manual: false,
  };
  const data = {
    overdue: [{ ...task, id: 't-over', dueAt: new Date(2026, 10, 10), daysLeft: -5 }],
    today: [],
    week: [task],
    later: [],
    openCount: 2,
  };
  it('TasksView: группы, пустое состояние, строки', () => {
    const html = renderToStaticMarkup(createElement(TasksView, { data, locale: 'en' } as never));
    expectNoCyrillic(html, 'TasksView');
    expect(html).toContain('Overdue');
    expect(html).toContain('This week');
    const empty = renderToStaticMarkup(
      createElement(TasksView, { data: { ...data, openCount: 0, overdue: [], week: [] }, locale: 'en' } as never),
    );
    expect(empty).toContain('All done 🎉');
  });
});

describe('DIG-89: уведомления — EN без кириллицы', () => {
  const item: NotificationFeedItem = {
    id: 'ntf-1',
    type: 'REQUEST',
    title: 'Request ЗД-2026-000123',
    body: '"Enrollment certificate": the document is ready for download.',
    isRead: false,
    important: true,
    actionLabel: 'Download',
    link: '/requests',
    createdAt: new Date(2026, 10, 16, 10, 5).toISOString(),
  };
  it('NotificationItemRow: строка, бейдж «Важно», действие', () => {
    const html = renderToStaticMarkup(
      createElement(NotificationItemRow, {
        itemId: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        isRead: false,
        important: true,
        actionLabel: 'Download',
        createdAt: item.createdAt,
        variant: 'full',
        onOpen: () => {},
        locale: 'en',
      } as never),
    );
    expectNoCyrillic(html, 'NotificationItemRow');
    expect(html).toContain('Important');
    expect(html).toContain('Download');
  });

  it('NotificationsScreen: фильтры, кнопки, пустые состояния', () => {
    const html = renderToStaticMarkup(
      createElement(NotificationsScreen, { initialItems: [item], locale: 'en' } as never),
    );
    expectNoCyrillic(html, 'NotificationsScreen');
    expect(html).toContain('Mark all as read');
    expect(html).toContain('Notification settings');
  });

  it('пустая лента и пустой фильтр', () => {
    const empty = renderToStaticMarkup(
      createElement(NotificationsScreen, { initialItems: [], locale: 'en' } as never),
    );
    expect(empty).toContain('No new notifications');
  });
});

describe('DIG-89: деканат (/deanery) — EN без кириллицы', () => {
  const ticket = {
    id: 'tk-1',
    number: 'TS-2026-000001',
    subject: 'Question about homework',
    status: 'ANSWERED' as const,
    requestNumber: null,
    disciplineCode: null,
    unreadForStudent: false,
    lastMessage: {
      authorRole: 'STAFF' as const,
      authorName: 'Maria K',
      body: 'Please visit the deanery office.',
      createdAt: new Date(2026, 10, 16, 12, 0),
      readAt: null,
    },
    createdAt: new Date(2026, 10, 15, 9, 0),
  } as never;
  it('TicketList и TicketComposer', () => {
    const html = renderToStaticMarkup(
      createElement(TicketList, { tickets: [ticket], locale: 'en' } as never),
    );
    expectNoCyrillic(html, 'TicketList');
    const composer = renderToStaticMarkup(
      createElement(TicketComposer, { locale: 'en' } as never),
    );
    expectNoCyrillic(composer, 'TicketComposer');
    expect(composer).toContain('New ticket');
  });
  it('TicketChat, TicketReplyForm, TicketStatusBadge', () => {
    // Реальный API TicketChat — { chat, locale } (см. deanery/[number]/page.tsx):
    // чат = { ticket, messages }.
    const chatData = {
      ticket,
      messages: [
        {
          id: 'msg-1',
          ticketId: 'tk-1',
          authorRole: 'STAFF' as const,
          authorName: 'Maria K',
          body: 'Please visit the deanery office.',
          attachments: [] as string[],
          createdAt: new Date(2026, 10, 16, 12, 0),
          readAt: null,
        },
      ],
    } as never;
    const chat = renderToStaticMarkup(
      createElement(TicketChat, { chat: chatData, locale: 'en' } as never),
    );
    expectNoCyrillic(chat, 'TicketChat');
    const reply = renderToStaticMarkup(
      createElement(TicketReplyForm, { ticketNumber: 'tk-1', locale: 'en' } as never),
    );
    expectNoCyrillic(reply, 'TicketReplyForm');
    const badge = renderToStaticMarkup(
      createElement(TicketStatusBadge, { status: 'ANSWERED', locale: 'en' } as never),
    );
    expectNoCyrillic(badge, 'TicketStatusBadge');
  });
});

describe('DIG-89: обратная связь (/feedback) — EN без кириллицы', () => {
  const item = {
    id: 'fb-1',
    number: 'FB-2026-000001',
    type: 'SUGGESTION',
    target: 'DEANERY',
    status: 'NEW',
    isAnonymous: false,
    text: 'Please add dark mode.',
    createdAt: new Date(2026, 10, 15, 9, 0),
    dueAt: new Date(2026, 10, 20, 9, 0),
  } as never;
  it('FeedbackList, FeedbackComposer, статус, ауткамы', () => {
    const html = renderToStaticMarkup(
      createElement(FeedbackList, { items: [item], locale: 'en' } as never),
    );
    expectNoCyrillic(html, 'FeedbackList');
    const composer = renderToStaticMarkup(
      createElement(FeedbackComposer, { locale: 'en' } as never),
    );
    expectNoCyrillic(composer, 'FeedbackComposer');
    expect(composer).toContain('New submission');
    const badge = renderToStaticMarkup(
      createElement(FeedbackStatusBadge, { status: 'NEW', locale: 'en' } as never),
    );
    expectNoCyrillic(badge, 'FeedbackStatusBadge');
    const outcomes = renderToStaticMarkup(
      createElement(FeedbackOutcomes, {
        title: 'What we changed',
        items: [
          {
            number: 'FB-2026-ZA11Q',
            kind: 'SUGGESTION',
            target: 'DEANERY',
            suggestion: 'Let students book a deanery specialist from the cabinet.',
            outcome: 'Booking lives in “Deanery”.',
            resolvedAt: new Date(2026, 9, 1),
          },
        ],
        locale: 'en',
      } as never),
    );
    expectNoCyrillic(outcomes, 'FeedbackOutcomes');
  });
});

describe('DIG-89: финансы (/finance) — EN без кириллицы', () => {
  const docs = [
    {
      id: 'fin-doc-enrollment-contract',
      kind: 'CONTRACT',
      title: 'Договор на обучение',
      number: 'ДОГ-2025-0147',
      date: new Date(2026, 8, 1),
    },
  ] as never[];
  it('DocumentsBrowser: фильтры, пустое состояние, скачивание', () => {
    const html = renderToStaticMarkup(
      createElement(FinanceDocumentsBrowser, { documents: docs, locale: 'en' } as never),
    );
    expectNoCyrillic(html, 'DocumentsBrowser');
    expect(html).toContain('Download');
    expect(html).toContain('DOG-2025-0147');
  });
});

describe('DIG-89: мероприятия (/events) — EN без кириллицы', () => {
  const event = {
    id: 'ev-lecture-ai',
    slug: 'llm-lecture',
    title: 'Lecture: how large language models work',
    description: 'Open lecture for senior students.',
    kind: 'LECTURE' as const,
    startsAt: new Date(2026, 10, 20, 18, 30),
    endsAt: new Date(2026, 10, 20, 20, 0),
    location: 'Online stream',
    isOnline: true,
    onlineUrl: 'https://events.example.edu/live/llm',
    capacity: 500,
    tags: ['ai'],
  } as never;
  it('EventCard, EventsFilterChips, EventRegisterButton', () => {
    const html = renderToStaticMarkup(
      createElement(
        EventCard,
        {
          view: { event, taken: 20, spotsLeft: 480, registeredByMe: false },
          canRegister: true,
          locale: 'en',
        } as never,
      ),
    );
    expectNoCyrillic(html, 'EventCard');
    expect(html).toContain('Lecture');
    const chips = renderToStaticMarkup(
      createElement(EventsFilterChips, { filter: 'all', showFaculty: true, locale: 'en' } as never),
    );
    expectNoCyrillic(chips, 'EventsFilterChips');
    const btn = renderToStaticMarkup(
      createElement(EventRegisterButton, {
        eventId: 'ev-lecture-ai',
        spotsLeft: 3,
        registeredByMe: false,
        canRegister: true,
        locale: 'en',
      } as never),
    );
    expectNoCyrillic(btn, 'EventRegisterButton');
  });
});

describe('DIG-89: новости (/news) — EN без кириллицы', () => {
  const article = {
    id: 'it-hackathon',
    title: 'Хакатон факультета ИТ: регистрация открыта',
    excerpt: 'Команды до четырёх человек, два трека.',
    topic: 'events',
    scope: 'faculty',
    group: null,
    faculty: 'ИТ',
    source: 'Студенческий совет ИТ',
    authorName: 'Дмитрий Волков',
    publishedAt: new Date(2026, 10, 15, 9, 0),
    isRead: false,
  } as never;
  it('NewsCard, вкладки, темы, полоса «Важно», share', () => {
    const html = renderToStaticMarkup(
      createElement(NewsCard, { item: article, feedQuery: '', locale: 'en' } as never),
    );
    expectNoCyrillic(html, 'NewsCard');
    const tabs = renderToStaticMarkup(
      createElement(NewsScopeTabs, { scope: 'university', currentQuery: '', locale: 'en' } as never),
    );
    expectNoCyrillic(tabs, 'NewsScopeTabs');
    const pills = renderToStaticMarkup(
      createElement(NewsTopicPills, { topic: 'all', scope: 'university', scopeIsDefault: true, locale: 'en' } as never),
    );
    expectNoCyrillic(pills, 'NewsTopicPills');
    const strip = renderToStaticMarkup(
      createElement(AnnouncementsStrip, { announcements: [article], feedQuery: '', locale: 'en' } as never),
    );
    expectNoCyrillic(strip, 'AnnouncementsStrip');
    const share = renderToStaticMarkup(createElement(ShareButton, { locale: 'en' } as never));
    expectNoCyrillic(share, 'ShareButton');
  });
});

describe('DIG-89: МСП (/msp) — EN без кириллицы', () => {
  // Фикстура выровнена по реальному API: MspProjectCard/MspLaunchOfDay
  // принимают view: MspProjectView { project, votes, votedByMe, comments }.
  const project = {
    id: 'msp-konspekt',
    slug: 'konspekt-bot',
    title: 'Notes Bot',
    tagline: 'AI lecture notes in a minute',
    description: 'A demo student startup.',
    tags: ['ai'],
    authorName: 'Anna S',
    authorId: 'st-anna',
    createdAt: new Date(2026, 10, 10, 12, 0),
    votes: 12,
    comments: 2,
    votedByMe: false,
    letter: 'N',
  } as never;
  const view = {
    project,
    votes: 12,
    votedByMe: false,
    comments: 2,
  } as never;
  it('карточка, сортировка, голос, комментарии, композер, запуск дня', () => {
    const html = renderToStaticMarkup(
      createElement(MspProjectCard, { view, locale: 'en' } as never),
    );
    expectNoCyrillic(html, 'MspProjectCard');
    const tabs = renderToStaticMarkup(createElement(MspSortTabs, { active: 'new', locale: 'en' } as never));
    expectNoCyrillic(tabs, 'MspSortTabs');
    const vote = renderToStaticMarkup(
      createElement(MspVoteButton, { projectId: 'msp-konspekt', votes: 12, votedByMe: false, isStudent: true, locale: 'en' } as never),
    );
    expectNoCyrillic(vote, 'MspVoteButton');
    const comments = renderToStaticMarkup(
      createElement(MspCommentList, { comments: [], locale: 'en' } as never),
    );
    expectNoCyrillic(comments, 'MspCommentList');
    const form = renderToStaticMarkup(
      createElement(MspCommentForm, { projectId: 'msp-konspekt', locale: 'en' } as never),
    );
    expectNoCyrillic(form, 'MspCommentForm');
    const composer = renderToStaticMarkup(
      createElement(MspLaunchComposer, { locale: 'en' } as never),
    );
    expectNoCyrillic(composer, 'MspLaunchComposer');
    const day = renderToStaticMarkup(createElement(MspLaunchOfDay, { view, locale: 'en' } as never));
    expectNoCyrillic(day, 'MspLaunchOfDay');
  });
});

describe('DIG-89: ДПО (/dpo) — EN без кириллицы', () => {
  const program = {
    id: 'dpo-analytics',
    slug: 'data-analytics',
    title: 'Data Analytics',
    description: 'Collect, clean and visualize data.',
    hours: 72,
    format: 'ONLINE' as const,
    startsAt: new Date(2026, 10, 20, 10, 0),
    price: 0,
    tags: ['data'],
    facultyTag: 'IT',
  } as never;
  // Фикстуры выровнены по реальному API: карточки принимают view
  // (DpoCatalogView / DpoMyProgramView), список документов — documents[].
  it('вкладки, чипы формата, карточки, документы', () => {
    const tabs = renderToStaticMarkup(createElement(DpoTabs, { active: 'catalog', locale: 'en' } as never));
    expectNoCyrillic(tabs, 'DpoTabs');
    const chips = renderToStaticMarkup(createElement(DpoFormatChips, { active: 'ALL', locale: 'en' } as never));
    expectNoCyrillic(chips, 'DpoFormatChips');
    const card = renderToStaticMarkup(
      createElement(DpoProgramCard, {
        view: { program, enrolledByMe: false },
        canEnroll: true,
        locale: 'en',
      } as never),
    );
    expectNoCyrillic(card, 'DpoProgramCard');
    const my = renderToStaticMarkup(
      createElement(DpoMyProgramCard, {
        view: { program, enrollment: { progressPercent: 60 } },
        locale: 'en',
      } as never),
    );
    expectNoCyrillic(my, 'DpoMyProgramCard');
    const docs = renderToStaticMarkup(
      createElement(DpoDocumentList, { documents: [], locale: 'en' } as never),
    );
    expectNoCyrillic(docs, 'DpoDocumentList');
  });
});

describe('DIG-89: справочник (/people) и сервисы (/services) — EN', () => {
  it('PeopleBrowser, ServicesBrowser, ServiceCard', () => {
    const people = renderToStaticMarkup(
      createElement(
        PeopleBrowser,
        { people: [], groupmates: [], favorites: [], locale: 'en' } as never,
      ),
    );
    expectNoCyrillic(people, 'PeopleBrowser');
    const services = renderToStaticMarkup(
      createElement(ServicesBrowser, { services: [], favorites: [], course: 2, locale: 'en' } as never),
    );
    expectNoCyrillic(services, 'ServicesBrowser');
    const card = renderToStaticMarkup(
      createElement(ServiceCard, {
        service: {
          id: 'svc-cert',
          name: 'Enrollment certificate',
          description: 'Proof of student status',
          category: 'docs',
          action: 'ORDER',
          href: '/requests?order=cert-enrollment',
          isFavorite: false,
        },
        locale: 'en',
      } as never),
    );
    expectNoCyrillic(card, 'ServiceCard');
  });
});

describe('DIG-89: профиль (/profile) — EN без кириллицы', () => {
  it('ContactsForm, DataErrorReport, MaskedBadge, NotificationSettings, ThemePicker', () => {
    expectNoCyrillic(
      renderToStaticMarkup(createElement(ContactsForm, { email: 'a@b.c', phone: '+7 000', locale: 'en' } as never)),
      'ContactsForm',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(DataErrorReport, { locale: 'en' } as never)),
      'DataErrorReport',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(MaskedBadge, { value: 'x', revealed: false, onToggle: () => {}, locale: 'en' } as never)),
      'MaskedBadge',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(NotificationSettings, { channels: {}, locale: 'en' } as never)),
      'NotificationSettings',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(ThemePicker, { theme: 'LIGHT', locale: 'en' } as never)),
      'ThemePicker',
    );
  });
});

describe('DIG-89: настройки (/settings) — EN без кириллицы', () => {
  it('вкладки, вид, пароль, тихие часы, сеансы, голос, виджеты, MCP', () => {
    expectNoCyrillic(
      renderToStaticMarkup(createElement(SettingsTabs, { active: 'home', locale: 'en' } as never)),
      'SettingsTabs',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(AppearanceSettings, { locale: 'en' } as never)),
      'AppearanceSettings',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(PasswordForm, { locale: 'en' } as never)),
      'PasswordForm',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(QuietHoursSettings, { initial: { enabled: false, from: '22:00', to: '08:00' }, locale: 'en' } as never),
      ),
      'QuietHoursSettings',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(SessionsList, { sessions: [], locale: 'en' } as never)),
      'SessionsList',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(VoiceSettings, { enabled: false, locale: 'en' } as never)),
      'VoiceSettings',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(WidgetsSettings, { order: ['today', 'news'], hidden: [], locale: 'en' } as never),
      ),
      'WidgetsSettings',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(McpSettings, { servers: [], locale: 'en' } as never)),
      'McpSettings',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(McpDeaneryServer, { url: 'https://x.y/mcp', tokenMask: null, createdAt: null, locale: 'en' } as never),
      ),
      'McpDeaneryServer',
    );
  });
});

describe('DIG-89: сессия и зачётка (/grades/*) — EN без кириллицы', () => {
  // Фикстура — по РЕАЛЬНОМУ контракту SessionExamItem (src/server/data/session.ts):
  // kindLabel/statusLabel — данные слоя данных (демо-контент, как ФИО).
  const exam = {
    examId: 'ex-1',
    disciplineCode: 'PI21-DB',
    disciplineName: 'Databases',
    kind: 'EXAM' as const,
    kindLabel: 'Exam',
    date: new Date(2026, 10, 25, 10, 0),
    startsAt: new Date(2026, 10, 25, 10, 0),
    room: '301',
    teacherName: null,
    status: 'ADMITTED' as const,
    statusLabel: 'Admitted',
    statusBadge: 'success' as const,
    score: null,
    admissionReason: null,
    actionHref: null,
  } as never;
  it('ConsultationList, ExamTimeline, RetakeList, форма записи, подписка календаря', () => {
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(ConsultationList, { consultations: [], locale: 'en' } as never),
      ),
      'ConsultationList',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(ExamTimeline, { exams: [exam], locale: 'en' } as never)),
      'ExamTimeline',
    );
    expectNoCyrillic(
      renderToStaticMarkup(createElement(RetakeList, { retakes: [], locale: 'en' } as never)),
      'RetakeList',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(RetakeSignupForm, {
          examId: 'ex-1',
          requested: false,
          requestNumber: null,
          signUpAvailable: true,
          locale: 'en',
        } as never),
      ),
      'RetakeSignupForm',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(
          CalendarSubscribeCard,
          { url: 'https://cabinet.example.edu/api/calendar/ics?token=v1.tok.tok', locale: 'en' } as never,
        ),
      ),
      'CalendarSubscribeCard',
    );
  });
  it('GradebookList, GradeFormula, GradeAppealForm', () => {
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(GradebookList, { data: { semesters: [] }, locale: 'en' } as never),
      ),
      'GradebookList',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(GradeFormula, { parts: [], locale: 'en' } as never),
      ),
      'GradeFormula',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(GradeAppealForm, { disciplineCode: 'X', locale: 'en' } as never),
      ),
      'GradeAppealForm',
    );
  });
});

describe('DIG-89: кабинет сотрудника (/staff) — EN без кириллицы', () => {
  it('StaffNav, RequestStatusForm, AppealForms, AnnouncementForm', () => {
    expectNoCyrillic(
      renderToStaticMarkup(createElement(StaffNav, { locale: 'en' } as never)),
      'StaffNav',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(RequestStatusForm, {
          requestId: 'r1',
          number: 'SR-2026-000001',
          allowed: ['ACCEPTED', 'IN_PROGRESS'],
          locale: 'en',
        } as never),
      ),
      'RequestStatusForm',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(AppealForms, { appealId: 'a1', closed: false, locale: 'en' } as never),
      ),
      'AppealForms',
    );
    expectNoCyrillic(
      renderToStaticMarkup(
        createElement(AnnouncementForm, { faculty: 'IT', groups: ['CS-21'], locale: 'en' } as never),
      ),
      'AnnouncementForm',
    );
  });
});

// ── 6. страницы скоупа: кириллица только в комментариях ──────────────────────

const SCAN_FILES = [
  'src/app/(cabinet)/more/page.tsx',
  'src/app/(cabinet)/tasks/page.tsx',
  'src/app/(cabinet)/tasks/loading.tsx',
  'src/app/(cabinet)/notifications/page.tsx',
  'src/app/(cabinet)/notifications/loading.tsx',
  'src/app/(cabinet)/deanery/(list)/page.tsx',
  'src/app/(cabinet)/deanery/(list)/loading.tsx',
  'src/app/(cabinet)/deanery/[number]/page.tsx',
  'src/app/(cabinet)/feedback/(list)/page.tsx',
  'src/app/(cabinet)/feedback/(list)/loading.tsx',
  'src/app/(cabinet)/feedback/[number]/page.tsx',
  'src/app/(cabinet)/feedback/sent/[number]/page.tsx',
  'src/app/(cabinet)/finance/page.tsx',
  'src/app/(cabinet)/finance/loading.tsx',
  'src/app/(cabinet)/events/(feed)/page.tsx',
  'src/app/(cabinet)/events/(feed)/loading.tsx',
  'src/app/(cabinet)/events/[slug]/page.tsx',
  'src/app/(cabinet)/news/page.tsx',
  'src/app/(cabinet)/news/[id]/page.tsx',
  'src/app/(cabinet)/msp/(feed)/page.tsx',
  'src/app/(cabinet)/msp/(feed)/loading.tsx',
  'src/app/(cabinet)/msp/[slug]/page.tsx',
  'src/app/(cabinet)/dpo/page.tsx',
  'src/app/(cabinet)/people/(list)/page.tsx',
  'src/app/(cabinet)/people/(list)/loading.tsx',
  'src/app/(cabinet)/people/[id]/page.tsx',
  'src/app/(cabinet)/services/page.tsx',
  'src/app/(cabinet)/services/loading.tsx',
  'src/app/(cabinet)/profile/page.tsx',
  'src/app/(cabinet)/settings/page.tsx',
  'src/app/(cabinet)/grades/(summary)/page.tsx',
  'src/app/(cabinet)/grades/(summary)/loading.tsx',
  'src/app/(cabinet)/grades/[disciplineId]/page.tsx',
  'src/app/(cabinet)/grades/gradebook/page.tsx',
  'src/app/(cabinet)/grades/gradebook/loading.tsx',
  'src/app/(cabinet)/grades/session/page.tsx',
  'src/app/(cabinet)/grades/session/loading.tsx',
  'src/app/(cabinet)/staff/(dashboard)/page.tsx',
  'src/app/(cabinet)/staff/(dashboard)/loading.tsx',
  'src/app/(cabinet)/staff/(dashboard)/requests/page.tsx',
  'src/app/(cabinet)/staff/(dashboard)/appeals/page.tsx',
  'src/app/(cabinet)/staff/(dashboard)/announcements/page.tsx',
  'src/app/(cabinet)/staff/(cards)/requests/[number]/page.tsx',
  'src/app/(cabinet)/staff/(cards)/appeals/[id]/page.tsx',
  'src/lib/en-demo-content.ts',
  'src/lib/events.ts',
  'src/lib/feedback.ts',
  'src/lib/finance-catalog.ts',
  'src/lib/news-catalog.ts',
  'src/lib/notification-view.ts',
  'src/lib/notification-labels.ts',
  'src/lib/dpo-tabs.ts',
  'src/lib/settings-tabs.ts',
  'src/lib/staff-appeal-templates.ts',
  'src/lib/request-labels.ts',
  'src/lib/gradebook.ts',
  'src/lib/dashboard-widgets.ts',
  'src/lib/performance-format.ts',
  'src/components/tasks/tasks-view.tsx',
  'src/components/notifications/notification-item-row.tsx',
  'src/components/notifications/notifications-bell.tsx',
  'src/components/notifications/notifications-screen.tsx',
  'src/components/deanery/ticket-chat.tsx',
  'src/components/deanery/ticket-composer.tsx',
  'src/components/deanery/ticket-list.tsx',
  'src/components/deanery/ticket-reply-form.tsx',
  'src/components/deanery/ticket-status-badge.tsx',
  'src/components/feedback/feedback-composer.tsx',
  'src/components/feedback/feedback-list.tsx',
  'src/components/feedback/feedback-outcomes.tsx',
  'src/components/feedback/feedback-status-badge.tsx',
  'src/components/finance/documents-browser.tsx',
  'src/components/events/event-card.tsx',
  'src/components/events/event-register-button.tsx',
  'src/components/events/events-filter-chips.tsx',
  'src/components/news/announcements-strip.tsx',
  'src/components/news/news-card.tsx',
  'src/components/news/news-scope-tabs.tsx',
  'src/components/news/news-skeleton.tsx',
  'src/components/news/news-topic-pills.tsx',
  'src/components/news/share-button.tsx',
  'src/components/msp/msp-comment-form.tsx',
  'src/components/msp/msp-comment-list.tsx',
  'src/components/msp/msp-launch-composer.tsx',
  'src/components/msp/msp-launch-of-day.tsx',
  'src/components/msp/msp-letter-badge.tsx',
  'src/components/msp/msp-project-card.tsx',
  'src/components/msp/msp-sort-tabs.tsx',
  'src/components/msp/msp-vote-button.tsx',
  'src/components/dpo/dpo-document-list.tsx',
  'src/components/dpo/dpo-format-chips.tsx',
  'src/components/dpo/dpo-my-program-card.tsx',
  'src/components/dpo/dpo-program-card.tsx',
  'src/components/dpo/dpo-tabs.tsx',
  'src/components/people/people-browser.tsx',
  'src/components/services/favorite-star.tsx',
  'src/components/services/service-card.tsx',
  'src/components/services/services-browser.tsx',
  'src/components/profile/contacts-form.tsx',
  'src/components/profile/data-error-report.tsx',
  'src/components/profile/masked-badge.tsx',
  'src/components/profile/notification-settings.tsx',
  'src/components/profile/theme-picker.tsx',
  'src/components/settings/accessibility-settings.tsx',
  'src/components/settings/appearance-settings.tsx',
  'src/components/settings/mcp-deanery-server.tsx',
  'src/components/settings/mcp-settings.tsx',
  'src/components/settings/password-form.tsx',
  'src/components/settings/quiet-hours-settings.tsx',
  'src/components/settings/sessions-list.tsx',
  'src/components/settings/settings-tabs.tsx',
  'src/components/settings/voice-settings.tsx',
  'src/components/settings/widgets-settings.tsx',
  'src/components/session/calendar-subscribe-card.tsx',
  'src/components/session/consultation-list.tsx',
  'src/components/session/exam-timeline.tsx',
  'src/components/session/retake-list.tsx',
  'src/components/session/retake-signup-form.tsx',
  'src/components/session/session-skeleton.tsx',
  'src/components/gradebook/grade-appeal-form.tsx',
  'src/components/gradebook/grade-formula.tsx',
  'src/components/gradebook/gradebook-list.tsx',
  'src/components/staff/announcement-form.tsx',
  'src/components/staff/appeal-forms.tsx',
  'src/components/staff/request-status-form.tsx',
  'src/components/staff/staff-nav.tsx',
];

/** Строки-каноны RU, которые допустимы в коде (данные/сравнения, не рендер EN). */
const ALLOWED_PATTERNS: RegExp[] = [
  /pluralRu\(/, // RU-плюрализация (канон RU-рендера)
  /MONTHS_GENITIVE/, // RU-месяцы для дефолтной локали
  /'онлайн'/, // сравнение значения сида
  /'очная'|'очно-заочная'|'заочная'|'бюджет'|'контракт'/, // маппинг значений сида
  /toLowerCase\(\) === 'контракт'/, // проверка формы финансирования сида
  /МСК/, // суффикс зоны в форматтере заявок (RU-канон)
  // Канонические карты/массивы строк: `KEY: 'Русский',` или `'января',`
  // (значения дефолтной локали; EN идёт через словарь/EN-слой).
  /^\s*(?:[A-Za-z_$][\w$]*|'[A-Za-z_-]+'):\s*(?:\{[^}]*\})?'[^']*[А-Яа-яЁё][^']*',?\s*(?:\}|\)),?\s*$/,
  /^\s*'[^']*[А-Яа-яЁё][^']*',?\s*$/,
];

function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlock
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//')) return '';
      const idx = line.indexOf('//');
      if (idx > 0 && /\s/.test(line[idx - 1])) {
        const before = line.slice(0, idx);
        if (!before.includes('http://') && !before.includes('https://')) return before;
      }
      return line;
    })
    .join('\n');
}

describe('DIG-89: исходники скоупа без кириллических литералов', () => {
  it('страницы и компоненты маршрутов: кириллица только в канонах RU', () => {
    const problems: string[] = [];
    for (const file of SCAN_FILES) {
      let src: string;
      try {
        src = readFileSync(resolve(process.cwd(), file), 'utf8');
      } catch {
        problems.push(`${file}: файл не найден`);
        continue;
      }
      const code = stripComments(src);
      code.split('\n').forEach((line, i) => {
        if (!CYRILLIC.test(line)) return;
        if (ALLOWED_PATTERNS.some((re) => re.test(line))) return;
        problems.push(`${file}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
    }
    expect(problems, `\n${problems.join('\n')}`).toEqual([]);
  });
});
