"use client";

import { ImageIcon, ImageOff, Pencil, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Controller, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MEDIA_MAX_BYTES, MEDIA_TYPES, type MediaType } from "@/lib/validation/admin";
import {
  createMediaUpload,
  finalizeMediaUpload,
  listMedia,
  updateMediaAlt,
} from "@/server/actions/admin/media";
import type { PublicImage } from "@/server/queries/media";

// Image picker for admin forms. Uploads go straight from the browser to the public R2 media bucket
// (presigned PUT, server-checked type and size); the form stores the MediaAsset id. Alt text in both
// languages is required. Without R2 configured, the picker says so and stays disabled.

const ACCEPT = Object.keys(MEDIA_TYPES).join(",");

/** react-hook-form field storing a MediaAsset id, with a preview of the chosen image. */
export function ImageField<T extends FieldValues>({
  name,
  label,
  hint,
  initial,
  configured,
}: {
  name: Path<T>;
  label: string;
  hint?: string;
  initial: PublicImage | null;
  configured: boolean;
}) {
  const { control } = useFormContext<T>();
  const [image, setImage] = useState<PublicImage | null>(initial);
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ImagePicker
          id={name}
          label={label}
          hint={hint}
          configured={configured}
          value={field.value ? image : null}
          onChange={(img) => {
            setImage(img);
            field.onChange(img?.id ?? null);
          }}
        />
      )}
    />
  );
}

export function ImagePicker({
  id,
  label,
  hint,
  value,
  onChange,
  configured,
  compact,
}: {
  id: string;
  label: string;
  hint?: string;
  value: PublicImage | null;
  onChange: (image: PublicImage | null) => void;
  configured: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("admin.media");
  const [open, setOpen] = useState(false);
  const [editingAlt, setEditingAlt] = useState(false);

  return (
    <div id={`field-${id}`} className="flex scroll-mt-24 flex-col gap-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div
        className={cn(
          "flex gap-4 rounded-card border border-line bg-surface p-3",
          compact ? "items-center" : "flex-col sm:flex-row sm:items-center",
        )}
      >
        <div
          className={cn(
            "relative shrink-0 overflow-hidden rounded-lg bg-muted",
            compact ? "size-16" : "aspect-[4/3] w-full sm:w-40",
          )}
        >
          {value ? (
            <Image src={value.url} alt={value.alt.en} fill sizes="160px" className="object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              {configured ? <ImageIcon className="size-6" /> : <ImageOff className="size-6" />}
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {!configured ? (
            <p className="text-sm text-muted-foreground">{t("notConfigured")}</p>
          ) : value ? (
            <p className="truncate text-sm text-muted-foreground" title={value.alt.en}>
              {t("altPreview", { alt: value.alt.en || value.alt.da })}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("none")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!configured}
              onClick={() => setOpen(true)}
            >
              <Upload data-icon="inline-start" />
              {value ? t("replace") : t("choose")}
            </Button>
            {value && (
              <>
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingAlt(true)}>
                  <Pencil data-icon="inline-start" />
                  {t("editAlt")}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
                  <Trash2 data-icon="inline-start" />
                  {t("remove")}
                </Button>
              </>
            )}
          </div>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {configured && (
        <PickerDialog
          open={open}
          onOpenChange={setOpen}
          onPick={(img) => {
            onChange(img);
            setOpen(false);
          }}
        />
      )}
      {value && (
        <AltDialog
          open={editingAlt}
          onOpenChange={setEditingAlt}
          image={value}
          onSaved={(img) => {
            onChange(img);
            setEditingAlt(false);
          }}
        />
      )}
    </div>
  );
}

function PickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (image: PublicImage) => void;
}) {
  const t = useTranslations("admin.media");
  const [library, setLibrary] = useState<PublicImage[] | null>(null);
  const [tab, setTab] = useState("upload");

  async function loadLibrary() {
    const result = await listMedia().catch(() => null);
    setLibrary(result?.ok ? result.data.items : []);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("dialogTitle")}</DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v);
            if (v === "library" && library === null) void loadLibrary();
          }}
        >
          <TabsList>
            <TabsTrigger value="upload">{t("tabUpload")}</TabsTrigger>
            <TabsTrigger value="library">{t("tabLibrary")}</TabsTrigger>
          </TabsList>
          <TabsContent value="upload" className="pt-4">
            <UploadForm onUploaded={onPick} />
          </TabsContent>
          <TabsContent value="library" className="pt-4">
            {library === null ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : library.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("libraryEmpty")}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {library.map((img) => (
                  <li key={img.id}>
                    <button
                      type="button"
                      onClick={() => onPick(img)}
                      className="group flex w-full flex-col gap-1 text-left"
                    >
                      <span className="relative block aspect-square overflow-hidden rounded-lg bg-muted ring-offset-2 group-hover:ring-2 group-hover:ring-ring group-focus-visible:ring-2 group-focus-visible:ring-ring">
                        <Image
                          src={img.url}
                          alt={img.alt.en}
                          fill
                          sizes="160px"
                          className="object-cover"
                        />
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {img.alt.en}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function UploadForm({ onUploaded }: { onUploaded: (image: PublicImage) => void }) {
  const t = useTranslations("admin.media");
  const fileId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [alt, setAlt] = useState({ da: "", en: "" });
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  async function pick(f: File | undefined) {
    setError(null);
    setFile(null);
    setSize(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (!f) return;
    if (!(f.type in MEDIA_TYPES)) return setError(t("errorType"));
    if (f.size > MEDIA_MAX_BYTES) return setError(t("errorSize"));
    try {
      const bitmap = await createImageBitmap(f);
      setSize({ width: bitmap.width, height: bitmap.height });
      bitmap.close();
    } catch {
      return setError(t("errorRead"));
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function upload() {
    if (!file || !size) return;
    if (!alt.da.trim() || !alt.en.trim()) return setError(t("errorAlt"));
    setError(null);
    startTransition(async () => {
      const start = await createMediaUpload({
        fileName: file.name,
        contentType: file.type as MediaType,
        sizeBytes: file.size,
        ...size,
      }).catch(() => null);
      if (!start?.ok) {
        setError(start?.error === "notConfigured" ? t("notConfigured") : t("errorUpload"));
        return;
      }
      const uploaded = await putWithProgress(start.data.url, file, start.data.headers, setProgress);
      if (!uploaded) {
        setProgress(null);
        setError(t("errorUpload"));
        return;
      }
      const done = await finalizeMediaUpload({
        key: start.data.key,
        token: start.data.token,
        alt,
      }).catch(() => null);
      setProgress(null);
      if (!done?.ok) {
        setError(t("errorUpload"));
        return;
      }
      toast.success(t("uploaded"));
      onUploaded(done.data);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fileId}>{t("file")}</Label>
        <Input
          id={fileId}
          type="file"
          accept={ACCEPT}
          onChange={(e) => void pick(e.target.files?.[0])}
          className="h-auto bg-surface py-1.5"
        />
        <p className="text-xs text-muted-foreground">{t("fileHint")}</p>
      </div>
      {preview && size && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
          <img src={preview} alt="" className="size-20 rounded-lg object-cover" />
          <p className="text-sm text-muted-foreground tabular-nums">
            {size.width} × {size.height} px · {(file!.size / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
      )}
      <AltInputs alt={alt} onChange={setAlt} />
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {progress !== null && (
        <div
          className="h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      <DialogFooter>
        <Button type="button" onClick={upload} disabled={!file || pending}>
          {pending ? t("uploading") : t("upload")}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AltInputs({
  alt,
  onChange,
}: {
  alt: { da: string; en: string };
  onChange: (alt: { da: string; en: string }) => void;
}) {
  const t = useTranslations("admin.media");
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t("alt")}</legend>
      <p className="text-xs text-muted-foreground">{t("altHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["da", "en"] as const).map((lang) => (
          <div key={lang} className="flex flex-col gap-1">
            <Label htmlFor={`${id}-${lang}`} className="font-mono text-xs text-muted-foreground">
              {lang.toUpperCase()}
            </Label>
            <Input
              id={`${id}-${lang}`}
              value={alt[lang]}
              maxLength={200}
              onChange={(e) => onChange({ ...alt, [lang]: e.target.value })}
              className="h-9 bg-surface"
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}

function AltDialog({
  open,
  onOpenChange,
  image,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: PublicImage;
  onSaved: (image: PublicImage) => void;
}) {
  const t = useTranslations("admin.media");
  const [alt, setAlt] = useState(image.alt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setAlt(image.alt);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editAlt")}</DialogTitle>
          <DialogDescription>{t("editAltDescription")}</DialogDescription>
        </DialogHeader>
        <AltInputs alt={alt} onChange={setAlt} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateMediaAlt({ id: image.id, alt }).catch(() => null);
                if (!result?.ok) return setError(t("errorAlt"));
                toast.success(t("altSaved"));
                onSaved(result.data);
              })
            }
          >
            {t("saveAlt")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** PUT with upload progress (fetch can't report it). Resolves true on 2xx. */
function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string>,
  onProgress: (percent: number) => void,
) {
  return new Promise<boolean>((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = () => resolve(false);
    xhr.send(file);
  });
}
