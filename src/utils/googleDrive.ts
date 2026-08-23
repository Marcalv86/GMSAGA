import { Project } from '../types';

const DRIVE_FOLDER_NAME = 'Saga Viviente — Campañas D&D';
const BACKUP_FILE_NAME = 'GM_Studio_Partidas_Saga_Viviente.json';

export interface DriveFileInfo {
  id: string;
  name: string;
  size?: string;
  modifiedTime: string;
  webViewLink?: string;
}

export interface DriveFolderInfo {
  id: string;
  name: string;
  webViewLink?: string;
}

/**
 * Busca o crea la carpeta de la aplicación en Google Drive del usuario
 */
export async function getOrCreateAppFolder(accessToken: string): Promise<DriveFolderInfo> {
  const query = encodeURIComponent(
    `name = '${DRIVE_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,webViewLink)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`Error al consultar Google Drive: ${searchRes.status} ${errorText}`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return {
      id: searchData.files[0].id,
      name: searchData.files[0].name,
      webViewLink: searchData.files[0].webViewLink
    };
  }

  // Crear la carpeta si no existe
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description: 'Carpeta de copias de seguridad de campañas y fichas de Saga Viviente (GM Studio).'
    })
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`No se pudo crear la carpeta en Google Drive: ${errorText}`);
  }

  const newFolder = await createRes.json();
  return {
    id: newFolder.id,
    name: newFolder.name,
    webViewLink: newFolder.webViewLink
  };
}

/**
 * Guarda las campañas en la carpeta de Google Drive
 */
export async function saveCampaignsToGoogleDrive(
  accessToken: string,
  campaigns: Project[],
  customFilename?: string
): Promise<{ fileId: string; folder: DriveFolderInfo; webViewLink?: string }> {
  const folder = await getOrCreateAppFolder(accessToken);
  const fileName = customFilename || BACKUP_FILE_NAME;

  // Comprobar si ya existe el archivo en la carpeta
  const query = encodeURIComponent(
    `name = '${fileName}' and '${folder.id}' in parents and trashed = false`
  );

  const existingRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  let existingFileId: string | null = null;
  if (existingRes.ok) {
    const existingData = await existingRes.json();
    if (existingData.files && existingData.files.length > 0) {
      existingFileId = existingData.files[0].id;
    }
  }

  const payload = {
    app: 'GM Studio — Saga Viviente',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    campaignCount: campaigns.length,
    campaigns
  };

  const fileContent = JSON.stringify(payload, null, 2);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata: any = {
    name: fileName,
    mimeType: 'application/json',
    description: `Copia de seguridad con ${campaigns.length} campaña(s) guardada el ${new Date().toLocaleString()}`
  };

  if (!existingFileId) {
    metadata.parents = [folder.id];
  }

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink';
  let method = 'POST';

  if (existingFileId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&fields=id,name,webViewLink`;
    method = 'PATCH';
  }

  const uploadRes = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: multipartRequestBody
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Error al subir a Google Drive: ${uploadRes.status} ${errorText}`);
  }

  const result = await uploadRes.json();
  return {
    fileId: result.id,
    folder,
    webViewLink: result.webViewLink
  };
}

/**
 * Lista las copias de seguridad existentes en la carpeta de Google Drive
 */
export async function listDriveBackups(accessToken: string): Promise<{ folder: DriveFolderInfo; files: DriveFileInfo[] }> {
  const folder = await getOrCreateAppFolder(accessToken);
  
  const query = encodeURIComponent(`'${folder.id}' in parents and trashed = false`);
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&orderBy=modifiedTime desc&fields=files(id,name,size,modifiedTime,webViewLink)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al listar archivos de Google Drive: ${errorText}`);
  }

  const data = await res.json();
  return {
    folder,
    files: (data.files || []) as DriveFileInfo[]
  };
}

/**
 * Descarga y restaura las campañas desde un archivo en Google Drive
 */
export async function downloadCampaignsFromGoogleDrive(
  accessToken: string,
  fileId: string
): Promise<{ campaigns: Project[]; exportDate?: string }> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Error al descargar archivo de Google Drive: ${errorText}`);
  }

  const data = await res.json();
  
  if (Array.isArray(data)) {
    return { campaigns: data };
  } else if (data && Array.isArray(data.campaigns)) {
    return {
      campaigns: data.campaigns,
      exportDate: data.exportDate
    };
  }

  throw new Error('El archivo descargado de Google Drive no contiene un formato de campañas reconocido.');
}

/**
 * Elimina un archivo de copia en Google Drive con confirmación
 */
export async function deleteDriveBackupFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!res.ok && res.status !== 404) {
    const errorText = await res.text();
    throw new Error(`Error al eliminar archivo de Google Drive: ${errorText}`);
  }
}
