import { expect, test, type Page } from '@playwright/test';

// DIG-24 — экран «Детали пары» (боковая панель / нижний лист на мобильном,
// Figma «04 · Расписание — детали пары»). Приёмка: открывается по клику на
// пару из любого вида (?event=<id>), «Назад» браузера закрывает, фокус
// переходит в панель, Esc закрывает и возвращает фокус на блок пары,
// чужая пара по прямой ссылке → 404. Состав панели: перенос («Было →
// Стало», причина, кто изменил), отмена (причина, «Что делать»), аудитория
// и корпус («Как пройти»), преподаватель (справочник, email, «Написать»),
// онлайн-ссылка, домашнее задание и материалы, «Моя заметка» (сохранение/
// удаление), «Добавить в календарь» (.ics), «Спросить AI об этой паре».

/** Вход тестового студента (Анна Ковалёва · ПИ-21) — как в schedule.spec. */
async function signIn(page: Page) {
  await expect(async () => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Анна Ковалёва · ПИ-21' }).click();
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10_000 });
  }).toPass({ timeout: 60_000 });
}

test.describe('desktop 1440 — панель из вида «Неделя»', () => {
  test.skip(({ viewport }) => viewport?.width !== 1440, 'desktop-1440 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('клик по паре открывает панель по ?event=; Esc закрывает и возвращает фокус; «Назад» закрывает', async ({
    page,
  }) => {
    await page.goto('/schedule');

    // перенос «сегодня» (sch-pi21-4, демо-данные): блок пары — ссылка
    const lesson = page.getByTestId('lesson-sch-pi21-4');
    await expect(lesson).toBeVisible();
    await lesson.click();

    await expect(page).toHaveURL(/event=sch-pi21-4/);
    const dialog = page.getByTestId('event-details-panel');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Программирование');
    // жёлтый блок переноса: «Было → Стало», причина и кто изменил
    await expect(dialog).toContainText('Было: ауд. 214, 12:00');
    await expect(dialog).toContainText('Стало: ауд. 305, 12:00');
    await expect(dialog).toContainText('Причина: Аудитория 214 занята факультетским мероприятием');
    await expect(dialog).toContainText('Изменил(а): Мария Петрова (деканат)');
    // аудитория и корпус с «Как пройти»
    await expect(dialog).toContainText('ауд. 305');
    await expect(dialog).toContainText('Главный корпус');
    await expect(dialog.getByRole('button', { name: 'Как пройти' })).toBeVisible();
    // действия: ICS одной пары и AI
    await expect(dialog.getByText('Добавить в календарь')).toBeVisible();
    await expect(dialog.getByText('Спросить AI об этой паре')).toBeVisible();

    // фокус при открытии — в панели (a11y-требование приёмки); эффект
    // начального фокуса срабатывает после гидрации — ждём через expect.poll
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (document.activeElement?.closest('[role="dialog"]') ?? null) !== null &&
            document.activeElement?.getAttribute('data-testid') === 'event-details-panel',
        ),
      )
      .toBe(true);

    // Esc закрывает панель, фокус возвращается на блок пары, ?event= уходит из URL
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-event-id'))).toBe(
      'sch-pi21-4',
    );
    await expect(page).not.toHaveURL(/event=/);

    // «Назад» браузера ведёт к записи до открытия панели (панель закрыта)
    await page.goBack();
    await expect(page.getByTestId('event-details-panel')).toHaveCount(0);
    await expect(page).not.toHaveURL(/event=/);
  });

  test('отменённая пара: красный блок с причиной и «Что делать»', async ({ page }) => {
    await page.goto('/schedule?event=sch-pi21-5');
    const dialog = page.getByTestId('event-details-panel');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Причина: Лаборатория закрыта');
    await expect(dialog).toContainText('Что делать: Занятие будет восполнено 20 ноября, ауд. 212');
  });

  test('«Моя заметка» сохраняется и удаляется; действие ICS указывает на файл пары', async ({
    page,
  }) => {
    await page.goto('/schedule?event=sch-pi21-1');
    const dialog = page.getByTestId('event-details-panel');
    await expect(dialog).toBeVisible();
    // состав: домашнее задание, материалы, преподаватель с email и справочником
    await expect(dialog).toContainText('Подготовить вопросы к коллоквиуму');
    await expect(dialog).toContainText('Конспект лекции №7, слайды в библиотеке');
    await expect(dialog.getByRole('link', { name: 'Петров Пётр Петрович' })).toHaveAttribute(
      'href',
      '/directory',
    );
    await expect(dialog.getByText('p.petrov@example.edu')).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Написать' })).toHaveAttribute(
      'href',
      'mailto:p.petrov@example.edu',
    );
    await expect(dialog.getByRole('link', { name: 'Добавить в календарь' })).toHaveAttribute(
      'href',
      '/api/schedule/sch-pi21-1/ics',
    );

    // заметка: сохранить → сохранить → перезагрузка → текст на месте
    const textarea = dialog.getByRole('textbox');
    await textarea.fill('Принести конспект и ноутбук');
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(dialog.getByText('Заметка сохранена')).toBeVisible();
    await page.reload();
    const dialogAfterReload = page.getByTestId('event-details-panel');
    await expect(dialogAfterReload.getByRole('textbox')).toHaveValue('Принести конспект и ноутбук');
    // удаление возвращает пустой редактор
    await dialogAfterReload.getByRole('button', { name: 'Удалить' }).click();
    await expect(dialogAfterReload.getByRole('textbox')).toHaveValue('');
  });
});

test.describe('mobile 360 — нижний лист из мобильного вида', () => {
  test.skip(({ viewport }) => viewport?.width !== 360, 'mobile-360 only');

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('клик по карточке пары открывает нижний лист, отмена видна составом, Esc возвращает фокус, без гор. скролла', async ({
    page,
  }) => {
    await page.goto('/schedule');

    const card = page.getByTestId('day-card-sch-pi21-5');
    await expect(card).toBeVisible();
    await card.click();

    await expect(page).toHaveURL(/event=sch-pi21-5/);
    const dialog = page.getByTestId('event-details-panel');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Физика');
    await expect(dialog).toContainText('Причина: Лаборатория закрыта');
    await expect(dialog).toContainText('Что делать: Занятие будет восполнено 20 ноября, ауд. 212');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal scroll detected at 360px').toBeLessThanOrEqual(0);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-event-id'))).toBe(
      'sch-pi21-5',
    );
    await expect(page).not.toHaveURL(/event=/);
  });

  test('онлайн-пара: ссылка на встречу вместо «Как пройти»', async ({ page }) => {
    await page.goto('/schedule?event=sch-pi21-6');
    const dialog = page.getByTestId('event-details-panel');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('онлайн');
    const meeting = dialog.getByRole('link', { name: 'Ссылка на онлайн-встречу' });
    await expect(meeting).toHaveAttribute('href', 'https://meet.example.edu/hist-seminar');
    await expect(dialog.getByRole('button', { name: 'Как пройти' })).toHaveCount(0);
  });
});

test.describe('прямой URL — uniform 404 на чужую и несуществующую пару', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('чужая пара (группа ЭК-11) → 404', async ({ page }) => {
    await page.goto('/schedule?event=sch-ek11-1');
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
    await expect(page.getByTestId('event-details-panel')).toHaveCount(0);
  });

  test('несуществующий id → тот же 404 (не раскрывает существование)', async ({ page }) => {
    await page.goto('/schedule?event=no-such-pair');
    await expect(page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
    await expect(page.getByTestId('event-details-panel')).toHaveCount(0);
  });
});
