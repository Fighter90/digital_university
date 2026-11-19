// DIG-101 — построение share-URL соцсетей (чистый модуль для юнит-тестов).
//
// Все параметры кодируются encodeURIComponent — символы &?= в url/title
// не ломают чужой query. Компонент (share-buttons.tsx) отдаёт сюда
// абсолютный url (корень-относительный делает абсолютным на клиенте).

const VK_SHARE = 'https://vk.com/share.php';
const TELEGRAM_SHARE = 'https://t.me/share/url';
const WHATSAPP_SHARE = 'https://wa.me/';

/** ВКонтакте: vk.com/share.php?url=<encoded url>. */
export function vkShareUrl(url: string): string {
  return `${VK_SHARE}?url=${encodeURIComponent(url)}`;
}

/** Telegram: t.me/share/url?url=<encoded url>&text=<encoded title>. */
export function telegramShareUrl(url: string, title: string): string {
  return `${TELEGRAM_SHARE}?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
}

/** WhatsApp: wa.me/?text=<encoded «title url»>. */
export function whatsappShareUrl(url: string, title: string): string {
  return `${WHATSAPP_SHARE}?text=${encodeURIComponent(title.trim().length > 0 ? `${title} ${url}` : url)}`;
}

/**
 * Корень-относительный путь → абсолютный URL против origin. Абсолютный
 * вход (http/https) проходит как есть; прочие схемы не поднимаются.
 */
export function absoluteShareUrl(url: string, origin: string): string {
  if (!url.startsWith('/')) return url;
  if (!origin) return url;
  return `${origin}${url}`;
}
