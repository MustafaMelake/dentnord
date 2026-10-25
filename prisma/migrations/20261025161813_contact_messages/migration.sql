-- CreateTable
CREATE TABLE "contact_message" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "clinic" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contact_message_createdAt_idx" ON "contact_message"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "contact_message_readAt_idx" ON "contact_message"("readAt");
