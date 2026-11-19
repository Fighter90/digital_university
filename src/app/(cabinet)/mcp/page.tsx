// DIG-73 — страница документации MCP (/mcp, аналог linear.app/docs/mcp):
// что такое MCP, что отдаёт сервер деканата, как подключить внешний
// AI-ассистент и правила безопасности токена.
//
// GET-only: мутаций нет (никаких server actions и форм) — поверхности
// записи нет. Единственные данные — owner-scoped вью маскированного
// токена владельца (getOwnMcpTokenView, только STUDENT-ctx: у сотрудника
// персонального токена нет, и вью не читается, чтобы не плодить аудит
// ROLE_MISMATCH). Доступен студенту и сотруднику: guard каркаса кабинета
// (requireUser) + requireDataCtx для скоупа. Раздел «что доступно»
// строится из каталога инструментов сервера (DEANERY_MCP_TOOLS) —
// документация не может обещать больше, чем отдаёт сервер.
// DIG-88 — тексты документации и подписи страницы по локали cookie
// du-locale; RU — байт-в-байт прежние строки.
import Link from 'next/link';
import { headers } from 'next/headers';
import { CircleAlert, ListChecks, Lock, Plug } from 'lucide-react';
import type { Metadata } from 'next';

import { SectionTitle } from '@/components/shell/section-title';
import { McpConnectCard } from '@/components/mcp/mcp-connect-card';
import { MCP_ENDPOINT_PATH, buildMcpServerUrl } from '@/lib/mcp-protocol';
import {
  MCP_GUIDE_ANCHOR,
  MCP_SETTINGS_HREF,
  mcpDocsSecurity,
  mcpDocsSteps,
  mcpDocsWhatIs,
  mcpExampleQuestions,
  mcpToolCatalog,
} from '@/lib/mcp-docs';
import { t } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n/server';
import { requireDataCtx } from '@/server/data';
import { getOwnMcpTokenView } from '@/server/data/mcp';
import { dataDb } from '@/server/data/db';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: t(locale, 'meta.mcp') };
}

export default async function McpDocsPage() {
  const [ctx, locale] = await Promise.all([requireDataCtx('/mcp'), getLocale()] as const);

  // Абсолютный URL демо-MCP-сервера из заголовков запроса (как в /settings).
  const headerList = await headers();
  const mcpHost = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const mcpServerUrl = buildMcpServerUrl(mcpHost, headerList.get('x-forwarded-proto'));

  // Токен существует только у студента-владельца; сотруднику блок не показываем.
  const isStudent = ctx.role === 'STUDENT';
  const token = isStudent ? await getOwnMcpTokenView(dataDb, ctx) : null;

  return (
    <section data-testid="mcp-page" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-1">
        <SectionTitle
          href="/mcp"
          fallback={t(locale, 'title.mcp')}
          className="text-xl font-bold sm:text-2xl"
        />
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">{t(locale, 'mcp.intro')}</p>
      </div>

      {/* Что такое MCP */}
      <div data-testid="mcp-what-is" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <Plug className="size-5 text-neutral-500" aria-hidden="true" />
          {t(locale, 'mcp.whatIs')}
        </h2>
        {mcpDocsWhatIs(locale).map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-neutral-700">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Что доступно: ровно то, что отдаёт сервер (каталог инструментов). */}
      <div data-testid="mcp-tools" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <ListChecks className="size-5 text-neutral-500" aria-hidden="true" />
          {t(locale, 'mcp.tools')}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {mcpToolCatalog(locale).map((tool) => (
            <li
              key={tool.name}
              data-testid={`mcp-tool-${tool.name}`}
              className="rounded-card border border-border bg-card p-3 shadow-soft"
            >
              <p className="text-sm font-semibold text-neutral-900">{tool.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{tool.description}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-500">
          {t(locale, 'mcp.toolsNote', { path: MCP_ENDPOINT_PATH })}
        </p>
      </div>

      {/* Как подключить */}
      <div data-testid="mcp-how-to" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">{t(locale, 'mcp.howTo')}</h2>
        <ol className="flex flex-col gap-3">
          {mcpDocsSteps(locale).map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-pill bg-muted text-xs font-semibold text-neutral-700">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-neutral-900">{step.title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-neutral-700">
                  {step.text}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <McpConnectCard url={mcpServerUrl} token={token} isStudent={isStudent} locale={locale} />

        {/* Примеры вопросов */}
        <div data-testid="mcp-examples" className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-neutral-900">{t(locale, 'mcp.examples')}</p>
          <ul className="flex flex-col gap-1">
            {mcpExampleQuestions(locale).map((question) => (
              <li
                key={question}
                className="rounded-card-sm border border-border bg-muted px-3 py-2 text-sm text-neutral-700"
              >
                {t(locale, 'mcp.exampleQuote', { question })}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Безопасность */}
      <div data-testid="mcp-security" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <Lock className="size-5 text-neutral-500" aria-hidden="true" />
          {t(locale, 'mcp.security')}
        </h2>
        {mcpDocsSecurity(locale).map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-neutral-700">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Перекрёстные ссылки: справка и настройки токена. */}
      <div className="flex flex-col gap-2 rounded-card border border-border bg-muted p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <CircleAlert className="size-4 text-neutral-500" aria-hidden="true" />
          {t(locale, 'mcp.more')}
        </p>
        <div className="flex flex-col gap-1 text-sm">
          <Link
            href={MCP_GUIDE_ANCHOR}
            className="font-semibold text-coral-600 underline-offset-2 hover:underline"
          >
            {t(locale, 'mcp.link.guide')}
          </Link>
          {isStudent && (
            <Link
              href={MCP_SETTINGS_HREF}
              className="font-semibold text-coral-600 underline-offset-2 hover:underline"
            >
              {t(locale, 'mcp.link.settings')}
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
