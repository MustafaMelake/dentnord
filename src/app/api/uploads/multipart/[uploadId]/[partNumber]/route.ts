import { signPart } from "@/server/services/case-uploads";
import { error, isFileId, json, requireUploadUser, respond } from "@/server/services/upload-guard";

// GET: a 15-minute signed URL for one part, with the part's exact Content-Length signed in.

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/uploads/multipart/[uploadId]/[partNumber]">,
) {
  const user = await requireUploadUser(request, "part");
  if (user instanceof Response) return user;
  const { uploadId, partNumber } = await ctx.params;
  const part = Number(partNumber);
  if (!isFileId(uploadId)) return error(404, "notFound");
  if (!/^\d{1,5}$/.test(partNumber) || part < 1) return error(400, "partNumber");
  return respond(async () => json({ url: await signPart(user, uploadId, part) }));
}
