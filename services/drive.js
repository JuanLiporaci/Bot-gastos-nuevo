// services/drive.js
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configurar autenticación de Google Drive
let auth;
if (process.env.GOOGLE_CREDENTIALS) {
  // Si las credenciales están en una variable de entorno (para Railway u otros servicios en la nube)
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  console.log('[Drive] Usando credenciales desde variable de entorno');
} else {
  // Si las credenciales están en un archivo local (para desarrollo)
  auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/drive']
  });
  console.log('[Drive] Usando credenciales desde archivo credentials.json');
}

const drive = google.drive({ version: 'v3', auth });

const saveFile = async (fileInfo) => {
  try {
    console.log('[Drive] Iniciando guardado de archivo:', JSON.stringify(fileInfo));
    
    // Determinar si estamos manejando un fileInfo (de gastos múltiples) o ctx directo (de gasto individual)
    let fileId, ctx;
    
    if (fileInfo.fileId && fileInfo.ctx) {
      // Caso gastos múltiples
      fileId = fileInfo.fileId;
      ctx = fileInfo.ctx;
    } else {
      // Caso gasto individual (legacy)
      ctx = fileInfo;
      fileId = ctx.session.fileId;
    }
    
    console.log(`[Drive] Procesando fileId: ${fileId}`);
    
    // Obtener el archivo de Telegram
    const file = await ctx.telegram.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const ext = path.extname(file.file_path) || '.jpg';
    const fileName = `gasto_${ctx.from.username || ctx.from.id}_${Date.now()}${ext}`;
    const filePath = path.join(__dirname, fileName);

    console.log(`[Drive] Descargando archivo desde: ${url}`);
    
    // Descargar el archivo
    const response = await axios({ url, responseType: 'stream' });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    console.log(`[Drive] Archivo descargado a: ${filePath}`);
    
    // Subir a Google Drive
    const folderId = process.env.DRIVE_FOLDER_ID || null;
    const fileMetadata = {
      name: fileName,
      parents: folderId ? [folderId] : []
    };
    const media = {
      mimeType: response.headers['content-type'],
      body: fs.createReadStream(filePath)
    };

    console.log('[Drive] Subiendo archivo a Google Drive');
    
    const uploadedFile = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: 'id'
    });

    console.log(`[Drive] Archivo subido con ID: ${uploadedFile.data.id}`);
    
    // Hacer público el archivo
    await drive.permissions.create({
      fileId: uploadedFile.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    const link = `https://drive.google.com/file/d/${uploadedFile.data.id}/view?usp=sharing`;
    console.log(`[Drive] Link generado: ${link}`);

    // Borrar archivo temporal
    fs.unlinkSync(filePath);
    
    return link;
  } catch (error) {
    console.error('[Drive] Error al guardar archivo:', error);
    throw error;
  }
};

module.exports = { saveFile };
