import { drive_v3, drive } from "googleapis/build/src/apis/drive/index.js";
import { GoogleAuth, OAuth2Client } from "google-auth-library";
import { Readable } from "stream";

let driveClient: drive_v3.Drive | null = null;

function getAuth(): GoogleAuth | OAuth2Client | null {
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const clientId =
    process.env.GOOGLE_DRIVE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.AUTH_GOOGLE_ID;
  const clientSecret =
    process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.AUTH_GOOGLE_SECRET;

  if (refreshToken && clientId && clientSecret) {
    const oauth2 = new OAuth2Client(clientId, clientSecret);
    oauth2.setCredentials({ refresh_token: refreshToken });
    return oauth2;
  }

  const jsonKey = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY;
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  const keyFile = process.env.GOOGLE_DRIVE_KEY_FILE;

  if (jsonKey) {
    try {
      const parsed = typeof jsonKey === "string" ? JSON.parse(jsonKey) : jsonKey;
      return new GoogleAuth({
        credentials: {
          client_email: parsed.client_email,
          private_key: parsed.private_key?.replace(/\\n/g, "\n"),
        },
        scopes: [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/drive",
        ],
      });
    } catch (e) {
      console.error("[GoogleDrive] Failed to parse GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY JSON:", e);
    }
  }

  if (clientEmail && privateKey) {
    return new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, "\n"),
      },
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  }

  if (keyFile) {
    return new GoogleAuth({
      keyFile,
      scopes: [
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/drive",
      ],
    });
  }

  return null;
}

export function isUnboxingVideoFilename(name?: string | null): boolean {
  if (!name) return false;
  return /^u\d+-[0-9a-f-]+\.(mp4|webm|mov)$/i.test(name);
}

export const googleDriveService = {
  isConfigured(): boolean {
    if (Boolean(process.env.GOOGLE_DRIVE_WEB_APP_URL)) return true;

    const hasFolder = Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID);
    const hasOAuth = Boolean(
      process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
        (process.env.GOOGLE_DRIVE_CLIENT_ID ||
          process.env.GOOGLE_CLIENT_ID ||
          process.env.AUTH_GOOGLE_ID)
    );
    const hasServiceAccount = Boolean(
      process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY ||
        (process.env.GOOGLE_DRIVE_CLIENT_EMAIL && process.env.GOOGLE_DRIVE_PRIVATE_KEY) ||
        process.env.GOOGLE_DRIVE_KEY_FILE
    );
    return hasFolder && (hasOAuth || hasServiceAccount);
  },

  getClient(): drive_v3.Drive | null {
    if (driveClient) return driveClient;
    const auth = getAuth();
    if (!auth) return null;
    driveClient = drive({ version: "v3", auth: auth as any });
    return driveClient;
  },

  async uploadVideo(params: {
    filename: string;
    mimeType: string;
    buffer: Buffer;
    description?: string;
  }): Promise<{ id: string; name: string; webViewLink?: string | null }> {
    const webAppUrl = process.env.GOOGLE_DRIVE_WEB_APP_URL;
    if (webAppUrl) {
      const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || "1-MhWwatQMxXOuF6WOKDMgtcRfVKhMXSl";
      const res = await fetch(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          filename: params.filename,
          mimeType: params.mimeType,
          base64: params.buffer.toString("base64"),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to upload to Google Drive via Web App");
      }
      return {
        id: data.id,
        name: data.name || params.filename,
        webViewLink: data.url,
      };
    }

    const client = this.getClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!client || !folderId) {
      throw new Error("Google Drive storage is not configured");
    }

    const stream = Readable.from(params.buffer);

    const response = await client.files.create({
      requestBody: {
        name: params.filename,
        parents: [folderId],
        description: params.description || `Unboxing video: ${params.filename}`,
        mimeType: params.mimeType,
      },
      media: {
        mimeType: params.mimeType,
        body: stream,
      },
      supportsAllDrives: true,
      fields: "id, name, webViewLink, webContentLink, size",
    });

    return {
      id: response.data.id!,
      name: response.data.name!,
      webViewLink: response.data.webViewLink,
    };
  },

  async findFileByName(filename: string): Promise<drive_v3.Schema$File | null> {
    const client = this.getClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!client || !folderId) return null;

    try {
      const escapedName = filename.replace(/'/g, "\\'");
      const res = await client.files.list({
        q: `'${folderId}' in parents and name = '${escapedName}' and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: "files(id, name, mimeType, size, webViewLink)",
        pageSize: 1,
      });
      return res.data.files?.[0] || null;
    } catch (err) {
      console.error(`[GoogleDrive] Failed searching for ${filename}:`, err);
      return null;
    }
  },

  async downloadStream(fileId: string): Promise<Readable | null> {
    const client = this.getClient();
    if (!client) return null;

    const res = await client.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "stream" }
    );
    return res.data as unknown as Readable;
  },

  async deleteFileByName(filename: string): Promise<void> {
    const file = await this.findFileByName(filename);
    if (!file?.id) return;
    const client = this.getClient();
    if (!client) return;
    try {
      await client.files.delete({ fileId: file.id, supportsAllDrives: true });
    } catch (err) {
      console.warn(`[GoogleDrive] Failed to delete file ${filename}:`, err);
    }
  },

  async getFolderStorageUsage(): Promise<{ totalBytes: number; fileCount: number }> {
    const client = this.getClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!client || !folderId) return { totalBytes: 0, fileCount: 0 };

    try {
      let totalBytes = 0;
      let fileCount = 0;
      let nextPage: string | undefined = undefined;

      while (true) {
        const response: any = await client.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
          fields: "nextPageToken, files(id, name, size)",
          pageSize: 100,
          pageToken: nextPage,
        });

        const files = response.data.files || [];
        for (const f of files) {
          // Strictly count ONLY return unboxing video files
          if (isUnboxingVideoFilename(f.name)) {
            totalBytes += Number(f.size || 0);
            fileCount++;
          }
        }
        nextPage = response.data.nextPageToken || undefined;
        if (!nextPage) break;
      }

      return { totalBytes, fileCount };
    } catch (err) {
      console.error("[GoogleDrive] Failed getting storage usage:", err);
      return { totalBytes: 0, fileCount: 0 };
    }
  },

  async clearFolderStorage(): Promise<{ deletedCount: number; skippedCount: number }> {
    const client = this.getClient();
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!client || !folderId) return { deletedCount: 0, skippedCount: 0 };

    let deletedCount = 0;
    let skippedCount = 0;
    try {
      const res = await client.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        fields: "files(id, name)",
        pageSize: 100,
      });

      const files = res.data.files || [];
      for (const f of files) {
        if (!f.id) continue;
        // CRITICAL SAFETY CHECK: Only delete files that are return unboxing videos!
        // Never touch other files!
        if (isUnboxingVideoFilename(f.name)) {
          try {
            await client.files.delete({ fileId: f.id, supportsAllDrives: true });
            deletedCount++;
          } catch (delErr) {
            console.warn(`[GoogleDrive] Failed to delete file ${f.name} (${f.id}):`, delErr);
          }
        } else {
          // Any other file is kept completely untouched
          skippedCount++;
        }
      }
    } catch (err) {
      console.error("[GoogleDrive] Failed clearing folder storage:", err);
    }
    return { deletedCount, skippedCount };
  },
};
