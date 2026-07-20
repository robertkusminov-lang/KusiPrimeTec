import { useState } from "react";
import { AttachmentInput } from "@/types/domain";

export const MAX_UPLOAD_FILES = 5;
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
] as const;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

export async function fileToBase64(file: File): Promise<AttachmentInput> {
  const raw = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(raw);
  return { name: file.name, type: file.type || "application/octet-stream", base64, size: file.size };
}

export function validateTicketFiles(input: File[]): { files: File[]; errors: string[] } {
  const errors: string[] = [];
  const files = input.slice(0, MAX_UPLOAD_FILES);

  if (input.length > MAX_UPLOAD_FILES) {
    errors.push(`Maximal ${MAX_UPLOAD_FILES} Anhänge pro Ticket sind erlaubt.`);
  }

  const accepted = files.filter((file) => {
    const type = String(file.type || "").toLowerCase();
    const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
    const byExtension = ["jpg", "jpeg", "png", "pdf"].includes(extension);
    if (!ALLOWED_UPLOAD_TYPES.includes(type as (typeof ALLOWED_UPLOAD_TYPES)[number]) && !byExtension) {
      errors.push(`${file.name}: Dateityp nicht erlaubt.`);
      return false;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      errors.push(`${file.name}: Datei ist größer als 10 MB.`);
      return false;
    }
    return true;
  });

  return { files: accepted, errors };
}

export function useUploadState() {
  const [files, setFiles] = useState<File[]>([]);

  const removeFile = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  return { files, setFiles, removeFile };
}


