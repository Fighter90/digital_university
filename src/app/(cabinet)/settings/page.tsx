// DIG-44 — «Настройки»: вкладки «Главная», «Уведомления», «Безопасность», «Вид»
// (макет Figma «02 · Профиль — настройки»).
//
// Все мутации — через server actions, скоупленные сессией (requireDataCtx):
// студент может менять только свои строки. Активная вкладка — параметр ?tab=
// (обычные ссылки, работают без JS); неизвестное значение откатывается на
// «Главную». Настройки применяются сразу: каждая мутация перевалидирует
// страницы, вид/тема — и root layout (классы на <html>).
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getLocale } from '@/lib/i18n/server';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionTitle } from '@/components/shell/section-title';
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
import { AccessibilitySettings } from '@/components/settings/accessibility-settings';
import { VoiceSettings } from '@/components/settings/voice-settings';
import { McpSettings } from '@/components/settings/mcp-settings';
import { McpDeaneryServer } from '@/components/settings/mcp-deanery-server';
import { getAuthSession, listActiveUserSessions } from '@/server/auth/session';
import { normalizeSettings } from '@/server/data/profile';
import { getOwnSettings, requireDataCtx } from '@/server/data';
import { getOwnMcpTokenView } from '@/server/data/mcp';
import { dataDb } from '@/server/data/db';
import { resolveSettingsTab } from '@/lib/settings-tabs';
import { getA11yPrefs } from '@/lib/a11y/server';
import { t } from '@/lib/i18n';
import { buildMcpServerUrl } from '@/lib/mcp-protocol';
import {
  MCP_FAQ,
  MCP_HELP_EN,
  MCP_HELP_HOW,
  MCP_HELP_TOKENS,
  MCP_INSTALL_STEPS,
  MCP_SERVERS,
  mcpServerEnMeta,
} from '@/lib/mcp-servers';
import { ASSISTANT_DOC_URL, DOCS_LINKS, docsLinkEn } from '@/lib/docs-links';

/** DIG-89 — <title> страницы по локали. */
export async function generateMetadata() {
  const locale = await getLocale();
  return { title: t(locale, 'meta.settings') };
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // DIG-86 — режим доступности (cookie du-a11y): состояние тумблеров вкладки
  // «Доступность»; те же классы a11y-* root layout ставит на <html>.
  const [ctx, locale, a11yPrefs] = await Promise.all([
    requireDataCtx('/settings'),
    getLocale(),
    getA11yPrefs(),
  ]);

  if (ctx.role !== 'STUDENT') {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <SectionTitle href="/settings" className="mb-1 text-xl font-bold sm:text-2xl" />
        <EmptyState
          title={t(locale, 'settings.staffOnly.title')}
          description={t(locale, 'settings.staffOnly.desc')}
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
          <SectionTitle href="/settings" className="text-xl font-bold sm:text-2xl" />
          <p className="mt-1 text-sm text-neutral-600">
            {t(locale, 'settings.home.desc')}
          </p>
        </div>
        <SettingsTabs active={tab} locale={locale} />
      </div>

      {tab === 'home' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.widgets.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.widgets.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <WidgetsSettings initial={settings.widgets} locale={locale} />}
            </CardContent>
          </Card>

          {/* DIG-59 — перекрёстные ссылки кабинета на документацию проекта. */}
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.docs.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.docs.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-1 grid gap-2">
              {DOCS_LINKS.map((doc) => {
                const en = locale === 'en' ? docsLinkEn(doc.id) : null;
                return (
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
                      {en ? en.title : doc.title}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-neutral-600">
                      {en ? en.description : doc.description}
                    </span>
                  </span>
                  <ExternalLink
                    className="mt-0.5 size-4 shrink-0 text-neutral-400"
                    aria-hidden="true"
                  />
                </a>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'notifications' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.channels.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.channels.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <NotificationSettings settings={settings} locale={locale} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.quiet.title')}</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <QuietHoursSettings initial={settings.quietHours} locale={locale} />}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'security' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.password.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.password.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <PasswordForm locale={locale} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.sessions.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.sessions.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <SessionsList sessions={sessions} currentSessionId={currentSessionId} locale={locale} />
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
              <CardTitle>{t(locale, 'settings.voice.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.voice.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <VoiceSettings voiceAssistant={settings.voiceAssistant} locale={locale} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.theme.title')}</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && <ThemePicker initial={settings.theme} locale={locale} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.appearance.title')}</CardTitle>
            </CardHeader>
            <CardContent className="mt-3">
              {settings && (
                <AppearanceSettings
                  language={settings.language}
                  fontSize={settings.fontSize}
                  reduceMotion={settings.reduceMotion}
                  locale={locale}
                />
              )}
            </CardContent>
          </Card>
        </>
      )}

      {tab === 'accessibility' && (
        <>
          {/* DIG-86 — режим «Крупный текст и без эффектов» для слабовидящих:
              классы a11y-large-text / a11y-no-effects на <html> из cookie
              du-a11y (server action setA11y). Независимо от системного
              prefers-reduced-motion и «Уменьшить анимацию» (DIG-44). */}
          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.a11yTitle')}</CardTitle>
              <CardDescription>{t(locale, 'settings.a11yHint')}</CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <AccessibilitySettings
                largeText={a11yPrefs.largeText}
                noEffects={a11yPrefs.noEffects}
                locale={locale}
              />
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
              <CardTitle>{t(locale, 'settings.mcpDeanery.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.mcpDeanery.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <McpDeaneryServer url={mcpServerUrl} token={mcpToken} locale={locale} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.mcpServers.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.mcpServers.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3">
              <McpSettings initial={settings.mcpConnections} locale={locale} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.mcpGive.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.mcpGive.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-1 grid gap-3 sm:grid-cols-3">
              {MCP_SERVERS.map((base) => {
                const server =
                  locale === 'en'
                    ? { ...base, ...(mcpServerEnMeta(base.id) ?? {}) }
                    : base;
                return (
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
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t(locale, 'settings.mcpHelp.title')}</CardTitle>
              <CardDescription>
                {t(locale, 'settings.mcpHelp.desc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-3 flex flex-col gap-5">
              <section aria-labelledby="mcp-help-how">
                <h3 id="mcp-help-how" className="text-sm font-semibold text-neutral-900">
                  {t(locale, 'settings.mcpHelp.how')}
                </h3>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {(locale === 'en' ? MCP_HELP_EN.how : MCP_HELP_HOW).map((paragraph) => (
                    <p key={paragraph} className="text-xs leading-relaxed text-neutral-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>

              <section aria-labelledby="mcp-help-tokens">
                <h3 id="mcp-help-tokens" className="text-sm font-semibold text-neutral-900">
                  {t(locale, 'settings.mcpHelp.tokens')}
                </h3>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  {(locale === 'en' ? MCP_HELP_EN.tokens : MCP_HELP_TOKENS).map((paragraph) => (
                    <p key={paragraph} className="text-xs leading-relaxed text-neutral-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>

              <section aria-labelledby="mcp-help-steps">
                <h3 id="mcp-help-steps" className="text-sm font-semibold text-neutral-900">
                  {t(locale, 'settings.mcpHelp.install')}
                </h3>
                <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-neutral-700">
                  {(locale === 'en' ? MCP_HELP_EN.steps : MCP_INSTALL_STEPS).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>

              <section aria-labelledby="mcp-help-faq">
                <h3 id="mcp-help-faq" className="text-sm font-semibold text-neutral-900">
                  {t(locale, 'settings.mcpHelp.errors')}
                </h3>
                <dl className="mt-1.5 flex flex-col gap-2">
                  {(locale === 'en' ? MCP_HELP_EN.faq : MCP_FAQ).map((item) => (
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
                {t(locale, 'settings.mcpHelp.full')}
                <ExternalLink className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
              </a>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}
