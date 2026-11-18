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
import Link from 'next/link';
import { headers } from 'next/headers';
import { CircleAlert, ListChecks, Lock, Plug } from 'lucide-react';

import { SectionTitle } from '@/components/shell/section-title';
import { McpConnectCard } from '@/components/mcp/mcp-connect-card';
import { DEANERY_MCP_TOOLS, MCP_ENDPOINT_PATH, buildMcpServerUrl } from '@/lib/mcp-protocol';
import {
  MCP_DOCS_SECURITY,
  MCP_DOCS_STEPS,
  MCP_DOCS_WHAT_IS,
  MCP_EXAMPLE_QUESTIONS,
  MCP_GUIDE_ANCHOR,
  MCP_SETTINGS_HREF,
} from '@/lib/mcp-docs';
import { requireDataCtx } from '@/server/data';
import { getOwnMcpTokenView } from '@/server/data/mcp';
import { dataDb } from '@/server/data/db';

export const metadata = { title: 'Подключение ассистента (MCP) — Цифровой деканат' };

export default async function McpDocsPage() {
  const ctx = await requireDataCtx('/mcp');

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
          fallback="Подключение ассистента (MCP)"
          className="text-xl font-bold sm:text-2xl"
        />
        <p className="mt-1 max-w-2xl text-sm text-neutral-600">
          Подключите кабинет как источник данных к вашему AI-ассистенту — как у Linear, только для
          деканата: расписание, оценки и уведомления по персональному токену.
        </p>
      </div>

      {/* Что такое MCP */}
      <div data-testid="mcp-what-is" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <Plug className="size-5 text-neutral-500" aria-hidden="true" />
          Что такое MCP
        </h2>
        {MCP_DOCS_WHAT_IS.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-neutral-700">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Что доступно: ровно то, что отдаёт сервер (каталог инструментов). */}
      <div data-testid="mcp-tools" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <ListChecks className="size-5 text-neutral-500" aria-hidden="true" />
          Что доступно через MCP
        </h2>
        <ul className="grid gap-2 sm:grid-cols-3">
          {DEANERY_MCP_TOOLS.map((tool) => (
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
          Набор инструментов отдаёт сам сервер ({MCP_ENDPOINT_PATH}, метод tools/list) — страница
          всегда совпадает с реальными возможностями. Доступ read-only: изменить данные через MCP
          нельзя.
        </p>
      </div>

      {/* Как подключить */}
      <div data-testid="mcp-how-to" className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-neutral-900">Как подключить ассистента</h2>
        <ol className="flex flex-col gap-3">
          {MCP_DOCS_STEPS.map((step, index) => (
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

        <McpConnectCard url={mcpServerUrl} token={token} isStudent={isStudent} />

        {/* Примеры вопросов */}
        <div data-testid="mcp-examples" className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-neutral-900">Примеры вопросов ассистенту</p>
          <ul className="flex flex-col gap-1">
            {MCP_EXAMPLE_QUESTIONS.map((question) => (
              <li
                key={question}
                className="rounded-card-sm border border-border bg-muted px-3 py-2 text-sm text-neutral-700"
              >
                «{question}»
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Безопасность */}
      <div data-testid="mcp-security" className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-900">
          <Lock className="size-5 text-neutral-500" aria-hidden="true" />
          Безопасность
        </h2>
        {MCP_DOCS_SECURITY.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-neutral-700">
            {paragraph}
          </p>
        ))}
      </div>

      {/* Перекрёстные ссылки: справка и настройки токена. */}
      <div className="flex flex-col gap-2 rounded-card border border-border bg-muted p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
          <CircleAlert className="size-4 text-neutral-500" aria-hidden="true" />
          Где ещё почитать
        </p>
        <div className="flex flex-col gap-1 text-sm">
          <Link
            href={MCP_GUIDE_ANCHOR}
            className="font-semibold text-coral-600 underline-offset-2 hover:underline"
          >
            Раздел «Подключить внешнего AI-ассистента (MCP)» в справке
          </Link>
          {isStudent && (
            <Link
              href={MCP_SETTINGS_HREF}
              className="font-semibold text-coral-600 underline-offset-2 hover:underline"
            >
              Вкладка «Настройка MCP» — выпуск и перевыпуск токена
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
