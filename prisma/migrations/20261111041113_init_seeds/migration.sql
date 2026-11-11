-- CreateEnum
CREATE TYPE "ScheduleKind" AS ENUM ('LECTURE', 'PRACTICE', 'LAB', 'SEMINAR', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('SCHEDULED', 'ROOM_CHANGED', 'TIME_CHANGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ElementKind" AS ENUM ('HOMEWORK', 'LAB', 'TEST', 'PROJECT', 'EXAM');

-- CreateEnum
CREATE TYPE "ExamKind" AS ENUM ('CREDIT', 'EXAM', 'RETAKE');

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('CERTIFICATE', 'STATEMENT', 'PRACTICE', 'DORMITORY', 'OTHER');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'IN_PROGRESS', 'NEEDS_REVISION', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('STUDENT', 'STAFF');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE', 'GRADE', 'REQUEST', 'NEWS', 'DEADLINE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "course" INTEGER NOT NULL,
    "faculty" TEXT NOT NULL,
    "program" TEXT NOT NULL,
    "studyForm" TEXT NOT NULL,
    "gradebookNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discipline" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "room" TEXT NOT NULL,

    CONSTRAINT "Discipline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentElement" (
    "id" TEXT NOT NULL,
    "disciplineId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ElementKind" NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "maxScore" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "AssessmentElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "gradedAt" TIMESTAMP(3) NOT NULL,
    "comment" TEXT,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleEvent" (
    "id" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "disciplineCode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "kind" "ScheduleKind" NOT NULL,
    "room" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'SCHEDULED',
    "note" TEXT,
    "previousRoom" TEXT,
    "previousStartsAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "disciplineCode" TEXT NOT NULL,
    "kind" "ExamKind" NOT NULL,
    "date" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "room" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "title" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "assignee" TEXT,
    "resultNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestEvent" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorRole" "ActorRole" NOT NULL,
    "actorName" TEXT NOT NULL,
    "statusFrom" "RequestStatus",
    "statusTo" "RequestStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NewsPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "FaqArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppealMessage" (
    "id" TEXT NOT NULL,
    "appealId" TEXT NOT NULL,
    "authorRole" "ActorRole" NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppealMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_login_key" ON "Student"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_gradebookNumber_key" ON "Student"("gradebookNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_login_key" ON "Staff"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Discipline_code_key" ON "Discipline"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentElement_code_key" ON "AssessmentElement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Grade_studentId_elementId_key" ON "Grade"("studentId", "elementId");

-- CreateIndex
CREATE INDEX "ScheduleEvent_groupName_date_idx" ON "ScheduleEvent"("groupName", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSession_groupName_disciplineCode_kind_date_key" ON "ExamSession"("groupName", "disciplineCode", "kind", "date");

-- CreateIndex
CREATE INDEX "RequestEvent_requestId_createdAt_idx" ON "RequestEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_studentId_createdAt_idx" ON "Notification"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NewsPost_slug_key" ON "NewsPost"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FaqArticle_slug_key" ON "FaqArticle"("slug");

-- CreateIndex
CREATE INDEX "AppealMessage_appealId_createdAt_idx" ON "AppealMessage"("appealId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssessmentElement" ADD CONSTRAINT "AssessmentElement_disciplineId_fkey" FOREIGN KEY ("disciplineId") REFERENCES "Discipline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "AssessmentElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestEvent" ADD CONSTRAINT "RequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppealMessage" ADD CONSTRAINT "AppealMessage_appealId_fkey" FOREIGN KEY ("appealId") REFERENCES "Appeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
