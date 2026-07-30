import { google } from "googleapis";
import { Readable } from "stream";

const LIBRARY_FOLDER_NAME = "Video Library";
const METADATA_FILE_NAME = ".video-library-metadata.json";

function driveClient(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.drive({ version: "v3", auth });
}

// Finds the user's "Video Library" folder, creating it the first time.
export async function getOrCreateLibraryFolder(accessToken) {
  const drive = driveClient(accessToken);

  const existing = await drive.files.list({
    q: `name='${LIBRARY_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (existing.data.files?.length) {
    return existing.data.files[0].id;
  }

  const created = await drive.files.create({
    requestBody: {
      name: LIBRARY_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });

  return created.data.id;
}

// The metadata file holds titles/categories/notes/catalog numbers, keyed by Drive file id.
export async function getMetadata(accessToken, folderId) {
  const drive = driveClient(accessToken);

  const existing = await drive.files.list({
    q: `name='${METADATA_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (!existing.data.files?.length) {
    return { fileId: null, entries: {} };
  }

  const fileId = existing.data.files[0].id;
  const res = await drive.files.get({ fileId, alt: "media" });

  // The googleapis client sometimes returns this as a raw string instead of
  // a parsed object — normalize it so callers always get a real object.
  let entries = res.data;
  if (typeof entries === "string") {
    try {
      entries = JSON.parse(entries);
    } catch (e) {
      console.error("Failed to parse metadata file, resetting", e);
      entries = {};
    }
  }
  if (!entries || typeof entries !== "object") {
    entries = {};
  }

  return { fileId, entries };
}

export async function saveMetadata(accessToken, folderId, fileId, entries) {
  const drive = driveClient(accessToken);
  const media = {
    mimeType: "application/json",
    body: JSON.stringify(entries),
  };

  if (fileId) {
    await drive.files.update({ fileId, media });
    return fileId;
  }

  const created = await drive.files.create({
    requestBody: {
      name: METADATA_FILE_NAME,
      parents: [folderId],
    },
    media,
    fields: "id",
  });

  return created.data.id;
}

export async function listVideoFiles(accessToken, folderId) {
  const drive = driveClient(accessToken);
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType contains 'video/'`,
    fields: "files(id, name, mimeType, createdTime, webViewLink, thumbnailLink, videoMediaMetadata, size)",
    orderBy: "createdTime desc",
    spaces: "drive",
  });
  return res.data.files || [];
}

export async function uploadVideoFile(accessToken, folderId, fileName, mimeType, buffer) {
  const drive = driveClient(accessToken);
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: buffer,
    },
    fields: "id, name, webViewLink, createdTime",
  });
  return created.data;
}

export async function uploadThumbnailImage(accessToken, folderId, fileName, mimeType, buffer) {
  const drive = driveClient(accessToken);
  // The googleapis client needs media.body to be a Readable stream, not a
  // raw Buffer — passing a Buffer directly is a known failure mode.
  const stream = Readable.from(buffer);

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: stream,
    },
    fields: "id",
  });

  return created.data.id;
}

export async function deleteVideoFile(accessToken, fileId) {
  const drive = driveClient(accessToken);
  await drive.files.delete({ fileId });
}
