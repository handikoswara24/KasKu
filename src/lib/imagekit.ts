export interface ImageKitUploadResult {
  fileId: string;
  url: string;
  thumbnailUrl?: string;
  name: string;
}

export function isImageKitConfigured(): boolean {
  const key = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  return Boolean(key && key.length > 5);
}

function getAuthHeader(): string {
  const key = process.env.IMAGEKIT_PRIVATE_KEY?.trim();
  if (!key) {
    throw new Error(
      "IMAGEKIT_PRIVATE_KEY belum dikonfigurasi pada environment variables / Secrets."
    );
  }
  const encoded = Buffer.from(`${key}:`).toString("base64");
  return `Basic ${encoded}`;
}

export async function uploadReceiptToImageKit(
  dataUrl: string,
  fileNameHint?: string
): Promise<ImageKitUploadResult> {
  const authHeader = getAuthHeader();
  const folder = process.env.IMAGEKIT_FOLDER?.trim() || "/kasku-notas";

  const safeHint = (fileNameHint || "nota")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  const fileName = `${safeHint || "nota"}-${Date.now()}.jpg`;

  const formData = new FormData();
  formData.append("file", dataUrl);
  formData.append("fileName", fileName);
  formData.append("folder", folder);
  formData.append("useUniqueFileName", "true");

  const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: {
      Authorization: authHeader,
    },
    body: formData,
  });

  const payload = (await response.json()) as {
    fileId?: string;
    url?: string;
    thumbnailUrl?: string;
    name?: string;
    message?: string;
  };

  if (!response.ok || !payload.url || !payload.fileId) {
    throw new Error(
      payload.message || "Gagal mengunggah gambar nota ke ImageKit."
    );
  }

  return {
    fileId: payload.fileId,
    url: payload.url,
    thumbnailUrl: payload.thumbnailUrl,
    name: payload.name || fileName,
  };
}

export async function deleteReceiptFromImageKit(fileId: string): Promise<void> {
  if (!isImageKitConfigured() || !fileId) return;

  try {
    const authHeader = getAuthHeader();
    await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(fileId)}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
      },
    });
  } catch {
    // Non-blocking cleanup failure should not prevent deleting the ledger record
  }
}
