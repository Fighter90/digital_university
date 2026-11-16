// DIG-16 — реестр ИИ-иллюстраций бренда (сгенерированы Recraft V4.1, см.
// docs/ai-log/assets.md). Все иллюстрации декоративные: смысл дублирует
// соседний текст, поэтому alt всегда "" — доступность обеспечивает
// компонент Illustration (aria-hidden). Размеры — фактические размеры
// файлов в public/illustrations (соотношение сторон next/image обязателен).

export const ILLUSTRATIONS = {
  'no-classes': {
    src: '/illustrations/no-classes.webp',
    width: 512,
    height: 512,
    alt: '',
  },
  'no-requests': {
    src: '/illustrations/no-requests.webp',
    width: 512,
    height: 512,
    alt: '',
  },
  'no-notifications': {
    src: '/illustrations/no-notifications.webp',
    width: 512,
    height: 512,
    alt: '',
  },
  error: {
    src: '/illustrations/error.webp',
    width: 512,
    height: 512,
    alt: '',
  },
  success: {
    src: '/illustrations/success.webp',
    width: 512,
    height: 512,
    alt: '',
  },
  'login-hero': {
    src: '/illustrations/login-hero.webp',
    width: 1120,
    height: 640,
    alt: '',
  },
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;
