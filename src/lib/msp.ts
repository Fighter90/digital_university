// DIG-68 — клиентский словарь каталога «МСП» (границы полей формы запуска
// и комментария). Файл без серверных импортов: его импортируют и клиентские
// компоненты (msp-launch-composer / msp-comment-form), и слой данных
// (server/data/msp.ts) — единственный источник правды для обеих сторон.
// Тот же приём, что у канала обратной связи (lib/feedback).

/** Название проекта каталога (символов). */
export const MIN_MSP_TITLE_LENGTH = 3;
export const MAX_MSP_TITLE_LENGTH = 80;

/** Краткое описание-слоган в ленте (символов). */
export const MIN_MSP_TAGLINE_LENGTH = 5;
export const MAX_MSP_TAGLINE_LENGTH = 120;

/** Развёрнутое описание на карточке (символов). */
export const MIN_MSP_DESCRIPTION_LENGTH = 20;
export const MAX_MSP_DESCRIPTION_LENGTH = 2000;

/** Теги: не более 5, каждый 2–24 символа (ввод «через запятую»). */
export const MAX_MSP_TAGS = 5;
export const MIN_MSP_TAG_LENGTH = 2;
export const MAX_MSP_TAG_LENGTH = 24;

/** Комментарий к проекту (символов). */
export const MIN_MSP_COMMENT_LENGTH = 1;
export const MAX_MSP_COMMENT_LENGTH = 1000;
