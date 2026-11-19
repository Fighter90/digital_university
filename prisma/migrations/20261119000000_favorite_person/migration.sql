-- DIG-102 — «Избранное» справочника людей (/people): избранное студента по
-- категориям (преподаватели / сотрудники деканата / одногруппники).
-- Таблицы Person в БД нет (справочник — статический вымышленный каталог
-- people-catalog), поэтому personId — строка без FK: id записи каталога
-- («teacher-petrov») либо «groupmate:<Student.id>» (GROUPMATE_ID_PREFIX).
-- Владелец — Student (FK, каскад), UNIQUE пары (студент, человек).

-- CreateTable
CREATE TABLE "FavoritePerson" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoritePerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FavoritePerson_studentId_createdAt_idx" ON "FavoritePerson"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FavoritePerson_studentId_personId_key" ON "FavoritePerson"("studentId", "personId");

-- AddForeignKey
ALTER TABLE "FavoritePerson" ADD CONSTRAINT "FavoritePerson_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
