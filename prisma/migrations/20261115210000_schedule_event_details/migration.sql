-- DIG-24 — панель «Детали пары»: состав панели (автор изменения, email
-- преподавателя, домашнее задание и материалы). Корпус (building) и
-- онлайн-ссылка (onlineUrl) уже есть с init-миграции.
ALTER TABLE "ScheduleEvent" ADD COLUMN "changeAuthor" TEXT;
ALTER TABLE "ScheduleEvent" ADD COLUMN "teacherEmail" TEXT;
ALTER TABLE "ScheduleEvent" ADD COLUMN "homework" TEXT;
ALTER TABLE "ScheduleEvent" ADD COLUMN "materials" TEXT;
