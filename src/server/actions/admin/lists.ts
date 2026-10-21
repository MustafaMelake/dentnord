"use server";

import { z } from "zod";

import { reorderSchema } from "@/lib/validation/admin";
import { runAdminAction } from "@/server/services/admin-action";
import {
  CONTENT_MODELS,
  deleteOrArchive,
  reorderRows,
  setFlag,
} from "@/server/services/content-admin";

// List operations for every admin content list (drag-to-reorder, published/active toggle, delete).

const model = z.enum(CONTENT_MODELS);
const id = z.string().trim().min(1).max(64);

export async function reorderContent(input: { model: string; ids: string[] }) {
  return runAdminAction(reorderSchema.extend({ model }), input, async ({ model, ids }, actor) => {
    await reorderRows(model, ids, actor);
  });
}

export async function setContentFlag(input: { model: string; id: string; value: boolean }) {
  return runAdminAction(
    z.object({ model, id, value: z.boolean() }),
    input,
    async ({ model, id, value }, actor) => {
      await setFlag(model, id, value, actor);
    },
  );
}

/** Deletes the row, or archives it when cases reference it. Returns which happened. */
export async function deleteContent(input: { model: string; id: string }) {
  return runAdminAction(z.object({ model, id }), input, async ({ model, id }, actor) =>
    deleteOrArchive(model, id, actor),
  );
}
