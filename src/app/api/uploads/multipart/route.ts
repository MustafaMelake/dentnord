import { z } from "zod";

import { registerUpload } from "@/server/services/case-uploads";
import { error, json, requireUploadUser, respond } from "@/server/services/upload-guard";

// POST: register a case file. The server checks the slot, extension and size, builds the key, creates
// the multipart upload in R2 and returns our file id (R2's upload id stays on the server).

const body = z.object({
  caseId: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  kind: z.string().max(32),
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

export async function POST(request: Request) {
  const user = await requireUploadUser(request, "write", "register");
  if (user instanceof Response) return user;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return error(400, "invalid");
  return respond(async () => {
    const { key, file } = await registerUpload(user.id, parsed.data);
    return json({ fileId: file.id, key, file }, 201);
  });
}
