# DIG-16 — ИИ-ассеты бренда: логотип, иллюстрации, обложки

> Критерий конкурса «ИИ-инструменты для дизайна»: все визуальные ассеты
> бренда сгенерированы нейросетями, промпты и исходники сохранены ниже.

## Как генерировались

| Ассет | Инструмент | Модель | Формат |
|---|---|---|---|
| 6 иллюстраций (пустые состояния + hero) | Higgsfield (MCP `experimental_image_generate`) | Recraft V4.1 Flash (через Higgsfield-инфраструктуру) | WebP ≤ 25 КБ |
| OG-превью 1200×630 | та же иллюстрация + текстовый оверлей (SVG → sharp) | Recraft V4.1 Flash | JPEG 47 КБ |
| Обложка PDF-описания | та же иллюстрация + текстовый оверлей | Recraft V4.1 Flash | JPEG 41 КБ |
| Проба логотипа (стиль-референс) | Higgsfield `z_image` | Z Image (Higgsfield) | PNG 2048² |
| Логотип (SVG + иконки) | векторная отрисовка по концепту пробы Higgsfield | — | SVG → PNG 48/180/192/512 |

Примечание. Генерация в Higgsfield была начата на модели `z_image` (проба
логотипа сохранена в `assets-src/higgsfield-probe-logo.png`); для векторного
стиля иллюстраций Recraft V4.1 требовал платный план, а кредиты free-плана
закончились, поэтому финальные иллюстрации сгенерированы той же моделью
Recraft V4.1 (Flash) через встроенный генератор сессии. Все промпты — ниже.

## Единый стиль (все иллюстрации)

Палитра проекта DIG-13: коралловый `#E7645A` (плюс `#EF7F72`, `#FFD9D1`,
`#FEBFB4`, `#FDECE8`), синий `#2563EB`, фон `#EFF6FF`, успех `#10B981`,
чернила `#0F172A`, белый. Требования стиля: плоская векторная иллюстрация,
матовые заливки, мягкие скруглённые формы, без текста и букв.

## Иллюстрации пустых состояний

Файлы: `public/illustrations/*.webp` (квадрат 512×512, `login-hero` 1120×640).
Исходники генерации: `docs/ai-log/assets-src/*.webp` (1024² / 1344×768).

### `no-classes` — «Нет пар сегодня» (дашборд, расписание)

> Square illustration for a student app empty state "no classes today": a wall
> calendar page with crossed-out empty lesson slots next to a small steaming
> cup of tea on a saucer, relaxed free-day mood, cozy and calm, balanced
> square composition with all elements fitting inside the frame. Flat vector
> illustration, matte solid colors, soft rounded shapes, coral #E7645A and
> blue #2563EB accents on a very light blue #EFF6FF background, no text, no
> letters, no watermark, clean minimal education app style.

### `no-requests` — «Заявок пока нет»

> Square illustration for a student app empty state "no requests yet": an
> empty paper document tray with a few blank white sheets and a small pencil
> lying beside it, calm tidy mood, balanced square composition with all
> elements fitting inside the frame. Flat vector illustration, matte solid
> colors, soft rounded shapes, coral #E7645A and blue #2563EB accents on a
> very light blue #EFF6FF background, no text, no letters, no watermark,
> clean minimal education app style.

### `no-notifications` — «Нет уведомлений»

> Square illustration for a student app empty state "no notifications": a
> cute sleeping notification bell with closed eyes leaning on a tiny pillow,
> a crescent moon and two small stars above it, quiet calm mood, balanced
> square composition with all elements fitting inside the frame. Flat vector
> illustration, matte solid colors, soft rounded shapes, coral #E7645A and
> blue #2563EB accents on a very light blue #EFF6FF background, no text, no
> letters, no watermark, clean minimal education app style.

### `error` — «Что-то пошло не так» (404, ErrorState)

> Square illustration for a student app error state "something went wrong": a
> friendly open laptop with a confused sad face on its screen and a small
> unplugged cable with a tiny spark, lighthearted not scary mood, balanced
> square composition with all elements fitting inside the frame. Flat vector
> illustration, matte solid colors, soft rounded shapes, coral #E7645A and
> blue #2563EB accents on a very light blue #EFF6FF background, no text, no
> letters, no watermark, clean minimal education app style.

### `success` — «Справка готова» (мастер заказа)

> Square illustration for a student app success state "certificate is ready":
> a certificate document sheet with a big green #10B981 checkmark seal and a
> few confetti pieces flying around, joyful but calm mood, balanced square
> composition with all elements fitting inside the frame. Flat vector
> illustration, matte solid colors, soft rounded shapes, coral #E7645A and
> blue #2563EB accents on a very light blue #EFF6FF background, no text, no
> letters, no watermark, clean minimal education app style.

### `login-hero` — hero экрана входа

> Login hero illustration for a university student portal desktop screen: a
> cozy student desk with an open laptop showing a simple schedule grid,
> floating rounded UI cards around it — a calendar card, a grade card with a
> star, a document card with a green checkmark — and a small potted plant.
> Soft coral gradient background from #FFD9D1 to #FEBFB4, coral #E7645A and
> blue #2563EB palette, flat vector illustration, matte solid colors, soft
> rounded shapes, no text, no letters, no watermark, clean minimal education
> app style.

## Превью ссылки (Open Graph 1200×630)

`public/og.jpg`: арт `og-banner.webp` (промпт ниже) + текстовый оверлей
(заголовок «Цифровой деканат», подзаголовок, плашка «Концепт для конкурса»).

> Wide banner illustration for a university student portal link preview: an
> open laptop in the lower right corner with a graduation cap on its screen,
> rounded dashboard cards floating around it — a calendar card, a grades card
> with stars, a documents card with a green checkmark. Soft coral gradient
> background from #FFD9D1 to #FEBFB4, large calm empty area in the upper left
> half reserved for a title, coral #E7645A and blue #2563EB palette, flat
> vector illustration, matte solid colors, soft rounded shapes, no text, no
> letters, no watermark.

## Обложка PDF-описания

`public/brand/pdf-cover.jpg` (800×1131, A4): арт `pdf-cover.webp` + оверлей
(заголовок, «Описание концепта», плашка).

> Vertical cover illustration for a project description document: a neat
> stack of white papers with a graduation cap on top and a small QR-code card
> floating beside it, soft coral gradient background from #FEBFB4 to #FFD9D1,
> generous calm empty space in the upper third reserved for a title, coral
> #E7645A and blue #2563EB palette, flat vector illustration, matte solid
> colors, soft rounded shapes, no text, no letters, no watermark.

## Логотип

Знак «открытая книга + шапочка выпускника в коралловом скруглённом квадрате»:

1. Стиль-проба в Higgsfield (`z_image`): `assets-src/higgsfield-probe-logo.png`
   (3D-версия знака — как референс композиции).
   Промпт: *«App icon design: a coral rounded square filling the entire frame
   edge to edge… white open book with a graduation cap resting on top, tiny
   yellow tassel»* (полный текст в истории генерации).
2. Продакшен-версия — чистая векторная отрисовка: `public/brand/logo.svg`
   (градиент кораллового `#E7645A → #D04F47`, белые книга и шапочка, янтарная
   кисточка `#FBBF24`) + компонент `src/components/brand/logo.tsx`.
3. Производные: `src/app/icon.png` (favicon 48), `src/app/apple-icon.png`
   (180), `public/icons/icon-192.png`, `public/icons/icon-512.png` (PWA).

Знак вымышленный, на реальный бренд вуза не похож (AGENTS.md, запрет №3).

## Подключение

- Иллюстрации — через `next/image` (компонент `Illustration`,
  `src/components/ui/illustration.tsx`); все декоративные: `alt=""` +
  `aria-hidden`, смысл дублирует соседний текст.
- Размеры: каждая картинка ≤ 80 КБ (факт: 7–25 КБ; OG/обложка 41–47 КБ).
- Экраны: дашборд и расписание (`no-classes`), заявки (`no-requests`),
  уведомления (`no-notifications`), мастер заказа (`success`), 404
  (`error`), вход (`login-hero` + логотип), Shell (`BrandLogo`).
- PWA: `src/app/manifest.ts` + иконки 192/512; тема `#E7645A`.
