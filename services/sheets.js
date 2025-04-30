const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  keyFile: 'credentials.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const sheets = google.sheets({ version: 'v4', auth });
const SPREADSHEET_ID = '1CNyD_seHZZyB-2NPusYEpNGF8m5LzUz87RHIYitfnAU';
const SHEET_NAME = 'Pagos';

const appendGasto = async (user, data, fileUrl) => {
  // Determinar si es un gasto múltiple o individual
  const isMult = data.tipo === 'multiple';
  
  // Preparar valores según el formato definido
  // Columnas: Fecha y Hora | Fecha de gasto | Tipo de Gasto | Monto | Comentario | Metodo | Enlace al archivo
  const values = [[
    new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }), // Fecha y Hora
    isMult ? data.fecha : new Date().toLocaleDateString('es-VE'), // Fecha de gasto (para múltiples, usar el rango ingresado)
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
