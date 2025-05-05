const { google } = require('googleapis');

// Configurar autenticación de Google Sheets
let auth;
if (process.env.GOOGLE_CREDENTIALS) {
  // Si las credenciales están en una variable de entorno (para Railway u otros servicios en la nube)
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  console.log('[Sheets] Usando credenciales desde variable de entorno');
} else {
  // Si las credenciales están en un archivo local (para desarrollo)
  auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  console.log('[Sheets] Usando credenciales desde archivo credentials.json');
}

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1CNyD_seHZZyB-2NPusYEpNGF8m5LzUz87RHIYitfnAU';
const SHEET_NAME = 'Pagos';

const appendGasto = async (user, data, fileUrl) => {
  // Determinar si es un gasto múltiple o individual
  const isMult = data.tipo === 'multiple';
  
  // Preparar valores según el formato definido
  // Columnas: Usuario | Fecha y Hora | Fecha de gasto | Tipo de Gasto | Monto | Comentario | Metodo | Enlace al archivo
  const values = [[
    user.username || user.first_name || user.id, // Usuario
    new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }), // Fecha y Hora
    isMult ? data.fecha : (data.fechaGasto || new Date().toLocaleDateString('es-VE')), // Fecha de gasto (usar la fecha proporcionada)
    isMult ? data.categoria : data.tipo, // Tipo de Gasto
    data.monto, // Monto
    data.comentario || '', // Comentario
    isMult ? 'Pago múltiple' : (data.metodo || ''), // Método
    fileUrl // Enlace al archivo
  ]];

  console.log(`[Sheets] Guardando en sheets: ${JSON.stringify(values)}`);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values
    }
  });
  
  console.log(`[Sheets] Datos guardados correctamente para ${isMult ? 'gasto múltiple' : 'gasto individual'}`);
};

module.exports = { appendGasto };
