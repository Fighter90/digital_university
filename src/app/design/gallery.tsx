'use client';

import { useState } from 'react';
import {
  Bell,
  BookOpen,
  CalendarDays,
  FlaskConical,
  GraduationCap,
  Presentation,
  RefreshCw,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  ProgressRing,
  Segmented,
  Sheet,
  Skeleton,
  StatTile,
  Stepper,
  ToastProvider,
  Toggle,
  Tooltip,
  useToast,
} from '@/components/ui';

// DIG-13: галерея дизайн-системы. Только dev (/design, прод отдаёт 404).
// Показывает все компоненты и состояния для визуальной сверки с макетом.

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <h2 id={`${id}-title`} className="mb-3 text-lg font-extrabold tracking-heading">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Swatch({ token, className }: { token: string; className: string }) {
  return (
    <figure className="flex flex-col gap-1">
      <span aria-hidden className={`block h-10 rounded-card border border-border ${className}`} />
      <figcaption className="text-xs text-muted-foreground">{token}</figcaption>
    </figure>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="secondary"
        onClick={() =>
          toast({
            title: 'Заявка создана',
            description: 'Отследить можно в «Мои заявки».',
            tone: 'success',
          })
        }
      >
        Success-toast
      </Button>
      <Button variant="secondary" onClick={() => toast({ title: 'Ошибка сети', tone: 'error' })}>
        Error-toast
      </Button>
      <Button variant="secondary" onClick={() => toast({ title: 'Пара перенесена', tone: 'info' })}>
        Info-toast
      </Button>
    </div>
  );
}

const SEGMENTED_OPTIONS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
] as const;

const STEPS = [
  { label: 'Услуга' },
  { label: 'Документы' },
  { label: 'Оплата' },
  { label: 'Проверка' },
  { label: 'Готово' },
];

export function DesignGallery() {
  const [period, setPeriod] = useState<(typeof SEGMENTED_OPTIONS)[number]['value']>('week');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <ToastProvider>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <p className="text-sm text-muted-foreground">
          DIG-13 · токены, шрифт Onest, компоненты. Светлая тема, AA-контраст, клавиатурная
          доступность.
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-heading sm:text-3xl">
          Дизайн-система
        </h1>

        <div className="mt-8 flex flex-col gap-10">
          <Section id="tokens" title="Токены">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Swatch token="--background #F7F7F7" className="bg-background" />
              <Swatch token="--card #FFFFFF" className="bg-card" />
              <Swatch token="--border #EBEBEB" className="bg-border" />
              <Swatch token="--muted #F1F1F1" className="bg-muted" />
              <Swatch token="--foreground #222222" className="bg-foreground" />
              <Swatch token="--muted-foreground #6A6A6A" className="bg-muted-foreground" />
              <Swatch token="--accent #FF385C" className="bg-accent" />
              <Swatch token="--accent-soft #FFF1F3" className="bg-accent-soft" />
              <Swatch token="--success #008A05" className="bg-success" />
              <Swatch token="--warning #9A6400" className="bg-warning" />
              <Swatch token="--error #C13515" className="bg-error" />
              <Swatch token="--info #1D4ED8" className="bg-info" />
              <Swatch
                token="--lesson-lecture коралловый"
                className="bg-lesson-lecture-soft border-lesson-lecture"
              />
              <Swatch
                token="--lesson-seminar синий"
                className="bg-lesson-seminar-soft border-lesson-seminar"
              />
              <Swatch
                token="--lesson-lab зелёный"
                className="bg-lesson-lab-soft border-lesson-lab"
              />
              <Swatch
                token="--lesson-exam янтарный"
                className="bg-lesson-exam-soft border-lesson-exam"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Swatch token="gradient-brand" className="gradient-brand" />
              <Swatch
                token="hatch-rescheduled (штриховка + пунктир)"
                className="hatch-rescheduled bg-card"
              />
              <Swatch token="shadow-soft" className="bg-card shadow-soft" />
              <Swatch token="shadow-hover" className="bg-card shadow-hover" />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span aria-hidden className="h-10 w-24 rounded-button border border-border bg-card" />
              <span aria-hidden className="h-10 w-24 rounded-card border border-border bg-card" />
              <span aria-hidden className="h-16 w-32 rounded-block border border-border bg-card" />
              <span aria-hidden className="h-10 w-24 rounded-pill border border-border bg-card" />
              <span className="text-xs text-muted-foreground">радиусы 8 / 16 / 24 / 999</span>
            </div>
          </Section>

          <Section id="button" title="Button">
            <Card>
              <CardContent className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-3">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">40px</Button>
                  <Button size="md">48px</Button>
                  <Button disabled>Disabled</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  hover primary: подъём 2px + shadow-hover · фокус: кольцо с клавиатуры
                </p>
              </CardContent>
            </Card>
          </Section>

          <Section id="chip" title="Chip">
            <div className="flex flex-wrap gap-2">
              <Chip active>Лекции</Chip>
              <Chip>Семинары</Chip>
              <Chip>Лабораторные</Chip>
              <Chip>Все</Chip>
            </div>
          </Section>

          <Section id="badge" title="Badge">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Badge status="success">Принято</Badge>
                <Badge status="warning">На проверке</Badge>
                <Badge status="error">Отклонено</Badge>
                <Badge status="info">В работе</Badge>
                <Badge>Черновик</Badge>
                <Badge status="accent">Новое</Badge>
                <Badge status="success" variant="solid">
                  Зачёт
                </Badge>
                <Badge status="error" variant="solid">
                  Незачёт
                </Badge>
              </CardContent>
            </Card>
          </Section>

          <Section id="stepper" title="Stepper заявки (5 шагов)">
            <Card>
              <CardContent className="flex flex-col gap-6">
                <Stepper steps={STEPS} states={['done', 'done', 'current', 'pending', 'pending']} />
                <Stepper
                  steps={STEPS}
                  states={['done', 'rejected', 'pending', 'pending', 'pending']}
                />
                <Stepper steps={STEPS} states={['done', 'done', 'done', 'ready', 'pending']} />
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="rounded-pill bg-success text-white">done</span>
                  <span className="gradient-brand rounded-pill text-white">current</span>
                  <span className="rounded-pill border border-border bg-card">pending</span>
                  <span className="rounded-pill border border-error bg-error-soft text-error-ink">
                    rejected
                  </span>
                  <span className="rounded-pill border border-info bg-info-soft text-info-ink">
                    ready
                  </span>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section id="stat" title="StatTile и ProgressRing">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile
                label="Средний балл"
                value="4,6"
                hint="+0,3 к прошлой сессии"
                icon={GraduationCap}
              />
              <StatTile label="Посещаемость" value="92%" hint="13 из 14 пар" icon={CalendarDays} />
              <StatTile label="Активные заявки" value="3" hint="1 — на проверке" icon={Bell} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-6">
              <ProgressRing value={72} label="Успеваемость">
                72%
              </ProgressRing>
              <ProgressRing value={35} label="Посещаемость" size={80} stroke={8}>
                35%
              </ProgressRing>
              <ProgressRing value={100} label="Выполнено" size={48} stroke={5} />
            </div>
          </Section>

          <Section id="segmented" title="Segmented (День / Неделя / Месяц) и Toggle">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-6">
                <Segmented
                  options={SEGMENTED_OPTIONS}
                  value={period}
                  onChange={setPeriod}
                  aria-label="Период расписания"
                />
                <label className="flex items-center gap-2 text-sm">
                  <Toggle aria-label="Уведомления о парах" defaultChecked />
                  Уведомления
                </label>
                <Toggle aria-label="Тёмная тема" />
              </CardContent>
            </Card>
          </Section>

          <Section id="overlays" title="Sheet, Dialog, Tooltip, Toast">
            <Card>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Button variant="secondary" onClick={() => setSheetOpen(true)}>
                  Открыть Sheet
                </Button>
                <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                  Открыть Dialog
                </Button>
                <Tooltip content="Средний балл за текущий семестр">
                  <span className="inline-flex items-center gap-1 text-sm underline decoration-dotted underline-offset-4">
                    <Icon icon={BookOpen} size={16} /> Tooltip
                  </span>
                </Tooltip>
                <ToastDemo />
              </CardContent>
            </Card>

            <Sheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              title="Фильтры расписания"
              description="Пример боковой панели: справа на десктопе, снизу на мобильном."
            >
              <div className="flex flex-col gap-3">
                <Chip active>Эта неделя</Chip>
                <Chip>Лекции</Chip>
                <Chip>Семинары</Chip>
              </div>
            </Sheet>
            <Dialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              title="Отменить заявку?"
              description="Заявка на справку будет удалена безвозвратно."
              footer={
                <>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                    Отмена
                  </Button>
                  <Button variant="danger" onClick={() => setDialogOpen(false)}>
                    Отменить заявку
                  </Button>
                </>
              }
            />
          </Section>

          <Section id="states" title="Skeleton, EmptyState, ErrorState, Avatar">
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="mt-2 h-20 w-full rounded-card" />
                </CardContent>
              </Card>
              <EmptyState
                icon={Presentation}
                title="Заявок пока нет"
                description="Закажите первую справку — это займёт минуту."
                action={<Button size="sm">Создать заявку</Button>}
              />
              <ErrorState onRetry={() => {}} />
              <Card>
                <CardContent className="flex flex-wrap items-center gap-3">
                  <Avatar name="Анна Петрова" />
                  <Avatar name="Игорь Соколов" size="lg" />
                  <Avatar name="Мария" size="sm" />
                  <span className="text-xs text-muted-foreground">инициалы из 1–2 слов</span>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section id="lessons" title="Типы занятий">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-transparent bg-lesson-lecture-soft px-3 py-1 text-xs font-semibold text-lesson-lecture-ink">
                <Icon icon={Presentation} size={14} /> Лекция
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-transparent bg-lesson-seminar-soft px-3 py-1 text-xs font-semibold text-lesson-seminar-ink">
                <Icon icon={BookOpen} size={14} /> Семинар
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-transparent bg-lesson-lab-soft px-3 py-1 text-xs font-semibold text-lesson-lab-ink">
                <Icon icon={FlaskConical} size={14} /> Лабораторная
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-pill border border-transparent bg-lesson-exam-soft px-3 py-1 text-xs font-semibold text-lesson-exam-ink">
                <Icon icon={GraduationCap} size={14} /> Экзамен
              </span>
              <span className="hatch-rescheduled inline-flex items-center gap-1.5 rounded-pill border border-muted-foreground/40 bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                <Icon icon={RefreshCw} size={14} /> Перенос
              </span>
            </div>
          </Section>
        </div>
      </main>
    </ToastProvider>
  );
}
