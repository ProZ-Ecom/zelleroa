"use client";

import { useEffect, useRef, useState } from "react";
import { Film, Loader2, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { returnsApi } from "../api/returns.api";
import {
  UNBOXING_VIDEO_MANDATORY_NOTICE,
  UNBOXING_VIDEO_MAX_BYTES,
  UNBOXING_VIDEO_MIME_TYPES,
} from "../lib/policy";

interface VideoUploaderProps {
  /** Uploaded (server) URL, or null when nothing valid is attached. */
  value: string | null;
  onChange: (url: string | null) => void;
  error?: string;
}

export function validateVideoFile(file: File): string | null {
  if (!(UNBOXING_VIDEO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return "Unsupported format. Please upload an MP4, WebM or MOV video.";
  }
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > UNBOXING_VIDEO_MAX_BYTES) {
    return `Video is too large. Maximum size is ${UNBOXING_VIDEO_MAX_BYTES / (1024 * 1024)} MB.`;
  }
  return null;
}

export function VideoUploader({ value, onChange, error }: VideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (localPreview) URL.revokeObjectURL(localPreview);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const reset = () => {
    abortRef.current?.abort();
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    setProgress(0);
    setUploading(false);
    setLocalError(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    const problem = validateVideoFile(file);
    if (problem) {
      setLocalError(problem);
      return;
    }
    setLocalError(null);
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(URL.createObjectURL(file));
    setUploading(true);
    setProgress(0);
    onChange(null);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const uploaded = await returnsApi.uploadVideo(file, setProgress, controller.signal);
      onChange(uploaded.url);
    } catch (err) {
      if (!controller.signal.aborted) {
        setLocalError(err instanceof Error ? err.message : "Video upload failed");
        setLocalPreview(null);
      }
    } finally {
      setUploading(false);
    }
  };

  const shownError = localError || error;
  const previewSrc = localPreview || value;

  return (
    <div className="space-y-2">
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
        {UNBOXING_VIDEO_MANDATORY_NOTICE}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {!previewSrc ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-theme-border bg-theme-surface-alt px-4 py-8 text-center transition-colors hover:border-theme-secondary cursor-pointer"
        >
          <UploadCloud className="h-7 w-7 text-theme-text-muted" />
          <span className="text-sm font-semibold text-theme-text-primary">Upload unboxing video</span>
          <span className="text-xs text-theme-text-subtle">
            MP4, WebM or MOV · up to {UNBOXING_VIDEO_MAX_BYTES / (1024 * 1024)} MB
          </span>
        </button>
      ) : (
        <div className="space-y-2 rounded-xl border border-theme-border bg-black/5 p-2">
          <video
            src={previewSrc}
            controls
            preload="metadata"
            className="max-h-64 w-full rounded-lg bg-black"
          />
          {uploading ? (
            <div className="space-y-1 px-1">
              <div className="flex items-center justify-between text-xs font-semibold text-theme-text-muted">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
                </span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-secondary-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <Film className="h-3.5 w-3.5" /> Video uploaded
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-700 border-red-200 hover:bg-red-50"
                  onClick={reset}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {shownError && <p className="text-xs font-medium text-red-600">{shownError}</p>}
    </div>
  );
}
