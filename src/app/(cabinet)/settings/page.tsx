// DIG-44 — «Настройки»: вкладки «Главная», «Уведомления», «Безопасность», «Вид»
// (макет Figma «02 · Профиль — настройки»).
//
// Все мутации — через server actions, скоупленные сессией (requireDataCtx):
// студент может менять только свои строки. Активная вкладка — параметр ?tab=
// (обычные ссылки, работают без JS); неизвестное значение откатывается на
// «Главную». Настройки применяются сразу: каждая мутация перевалидирует
// страницы, вид/тема — и root layout (классы на <html>).
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ExternalLink } from 'lucide-react';
import { headers } from 'next/headers';
import { NotificationSettings } from '@/components/profile/notification-settings';
import { ThemePicker } from '@/components/profile/theme-picker';
import { SettingsTabs } from '@/components/settings/settings-tabs';
import { WidgetsSettings } from '@/components/settings/widgets-settings';
import { QuietHoursSettings } from '@/components/settings/quiet-hours-settings';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsList } from '@/components/settings/sessions-list';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { VoiceSettings } from '@/components/settings/voice-settings';
import { McpSettings } from '@/components/settings/mcp-settings';
import { McpDeaneryServer } from '@/components/settings/mcp-deanery-server';
import { getAuthSession, listActiveUserSessions } from '@/server/auth/session';
import { normalizeSettings } from '@/server/data/profile';
import { getOwnSettings, requireDataCtx } from '@/server/data';
import { getOwnMcpTokenView } from '@/server/data/mcp';
import { dataDb } from '@/server/data/db';
import { resolveSettingsTab } from '@/lib/settings-tabs';
import { buildMcpServerUrl } from '@/lib/mcp-protocol';
import {
  MCP_FAQ,
  MCP_HELP_HOW,
  MCP_HELP_TOKENS,
  MCP_INSTALL_STEPS,
  MCP_SERVERS,
} from '@/lib/mcp-servers';
import { ASSISTANT_DOC_URL, DOCS_LINKS } from '@/lib/docs-links';

export const metadata = { title: 'Настройки — Цифровой деканат' };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireDataCtx('/settings');

  if (ctx.role !== 'STUDENT') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-1 text-xl font-bold sm:text-2xl">Настройки</h1>
        <EmptyState
          title="Раздел доступен студентам"
          description="Настройки кабинета сотрудника настраиваются в системе деканата."
        />
      </section>
    );
  }

  const params = (await searchParams) ?? {};
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const tab = resolveSettingsTab(rawTab);

  const settings = normalizeSettings(await getOwnSettings(dataDb, ctx));
  const auth = await getAuthSession();
  const sessions = tab === 'security' && auth ? await listActiveUserSessions(auth.user.id) : [];
  const currentSessionId = auth?.session.id ?? null;

  // DIG-64 — абсолютный URL демо-MCP-сервера из заголовков запроса
  // (x-forwarded-host / x-forwarded-proto — реверс-прокси Caddy на deploy)
  // и состояние персонального токена владельца (наружу — только превью).
  const headerList = await headers();
  const mcpHost = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const mcpServerUrl = buildMcpServerUrl(mcpHost, headerList.get('x-forwarded-proto'));
  const mcpToken = await getOwnMcpTokenView(dataDb, ctx);

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Настройки</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Виджеты главной, уведомления, безопасность, вид кабинета и MCP-интеграции ассистента.
            Изменения сохраняются и применяются сразу.
          </p>
        </div>
        <SettingsTabs active={tab} />
      </div>

      {tab === 'home' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Виджеты главной</CardTitle>
              <CardDescription>
                Выберите, какие блоки показывать на главной и в каком порядке. Порядок меняется
                перетаскиванием или кнопками «вверх/вниз».
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <WidgetsSettings initial={settings.widgets} />}
            </CardContent>
          </Card>

          {/* DIG-59 — перекрёстные ссылки кабинета на документацию проекта. */}
          <Card>
            <CardHeader>
              <CardTitle>Справка и документация</CardTitle>
              <CardDescription>
                Подробные инструкции и устройство прототипа — в документации проекта. Открывается на
                GitHub в новой вкладке.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-1 grid gap-2">
              {DOCS_LINKS.map((doc) => (
                <a
                  key={doc.id}
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  data-testid={`docs-link-${doc.id}`}
                  className="flex items-start gap-2 rounded-card border border-border bg-muted px-3 py-2.5 transition-colors hover:border-coral-200 hover:bg-coral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
                >
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-neutral-900">
                      {doc.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-neutral-600">
                      {doc.description}
                    </span>
                  </span>
                  <ExternalLink
                    className="mt-0.5 size-4 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  />
                </a>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'notifications' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Каналы уведомлений</CardTitle>
              <CardDescription>
                Матрица «категория × канал»: выключенный канал «в кабинете» убирает тип из ленты
                уведомлений.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <NotificationSettings settings={settings} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Тихие часы</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <QuietHoursSettings initial={settings.quietHours} />}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'security' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Смена пароля</CardTitle>
              <CardDescription>
                Пароль хранится только в виде argon2id-хэша. После смены вход со старым паролем
                перестанет работать.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <PasswordForm />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Активные сеансы</CardTitle>
              <CardDescription>
                Устройства, с которых вы входили в кабинет. «Завершить» закрывает выбранный сеанс;
                «Выйти на всех устройствах» — все, включая текущий.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <SessionsList sessions={sessions} currentSessionId={currentSessionId} />
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'appearance' && (
        <>
          {/* DIG-65 — «Озвучка и голосовой ввод»: скрывает/показывает кнопку
              «Прослушать день» на расписании и микрофон в AI-гиде. Синтез и
              распознавание выполняет браузер (Web Speech API), без внешних
              ключей; настройка переживает перезагрузку (строка настроек). */}
          <Card>
            <CardHeader>
              <CardTitle>Голосовой ассистент</CardTitle>
              <CardDescription>
                Синтез речи и распознавание выполняет браузер (Web Speech API) — без внешних
                сервисов. Полезно на мобильном и для доступности.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <VoiceSettings voiceAssistant={settings.voiceAssistant} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Тема</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <ThemePicker initial={settings.theme} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Язык, шрифт и анимация</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && (
                <AppearanceSettings
                  language={settings.language}
                  fontSize={settings.fontSize}
                  reduceMotion={settings.reduceMotion}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'mcp' && settings && (
        <>
          {/* DIG-64 — живой демо-MCP-сервер деканата: URL, персональный
              токен и инструкции подключения к ChatGPT/Claude. */}
          <Card>
            <CardHeader>
              <CardTitle>MCP-сервер деканата</CardTitle>
              <CardDescription>
                Подключите кабинет как источник данных к внешнему ассистенту (ChatGPT, Claude): «моё
                расписание на сегодня», «мои оценки», «мои непрочитанные». Доступ — по персональному
                токену, сервер отдаёт только ваши данные.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <McpDeaneryServer url={mcpServerUrl} token={mcpToken} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>MCP-серверы ассистента</CardTitle>
              <CardDescription>
                Источники данных цифрового ассистента (Model Context Protocol). Серверы и токены
                демонстрационные: реальные ключи не используются, подключение не даёт доступа к
                реальным сервисам.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <McpSettings initial={settings.mcpConnections} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Что даёт каждый сервер</CardTitle>
              <CardDescription>
                Каждый сервер — отдельный источник данных для ассистента: тренды, расписание, API
                деканата.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-1 grid gap-3 sm:grid-cols-3">
              {MCP_SERVERS.map((server) => (
                <div
                  key={server.id}
                  data-testid="mcp-example-card"
                  className="rounded-card border border-border bg-muted p-3"
                >
                  <p className="text-sm font-semibold text-neutral-900">{server.name}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">{server.tagline}</p>
                  <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 text-xs text-neutral-700">
                    {server.benefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Справка: MCP</CardTitle>
              <CardDescription>
                Как работает подключение, как обращаться с токенами и что делать, если что-то не
                получается.
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3 flex flex-col gap-5">
              <section aria-labelledby="mcp-help-how">
                <h3 id="mcp-help-how" className="text-sm font-semibold text-neutral-900">
                  Как работает MCP
                </h3>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {MCP_HELP_HOW.map((paragraph) => (
                    <p key={paragraph} className="text-xs leading-relaxed text-neutral-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>

              <section aria-labelledby="mcp-help-tokens">
                <h3 id="mcp-help-tokens" className="text-sm font-semibold text-neutral-900">
                  Безопасность токенов
                </h3>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {MCP_HELP_TOKENS.map((paragraph) => (
                    <p key={paragraph} className="text-xs leading-relaxed text-neutral-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>

              <section aria-labelledby="mcp-help-steps">
                <h3 id="mcp-help-steps" className="text-sm font-semibold text-neutral-900">
                  Пошаговая установка
                </h3>
                <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-neutral-700">
                  {MCP_INSTALL_STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>

              <section aria-labelledby="mcp-help-faq">
                <h3 id="mcp-help-faq" className="text-sm font-semibold text-neutral-900">
                  Частые ошибки
                </h3>
                <dl className="mt-1.5 flex flex-col gap-2">
                  {MCP_FAQ.map((item) => (
                    <div
                      key={item.q}
                      className="rounded-card-sm border border-border bg-muted p-2.5"
                    >
                      <dt className="text-xs font-semibold text-neutral-900">{item.q}</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-neutral-700">{item.a}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* DIG-59 — ссылка на полную справку по ассистенту (docs/assistant.md). */}
              <a
                href={ASSISTANT_DOC_URL}
                target="_blank"
                rel="noreferrer noopener"
                data-testid="docs-link-assistant-mcp"
                className="flex items-center gap-2 rounded-card border border-border bg-muted px-3 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:border-coral-200 hover:bg-coral-50 focus-visible:outline-2 focus-visible:outline-coral-600"
              >
                Полная справка: цифровой ассистент и MCP
                <ExternalLink className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
