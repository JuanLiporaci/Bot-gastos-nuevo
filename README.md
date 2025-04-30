# Bot de Gestión de Gastos - Telegram

Bot de Telegram para gestionar gastos y facturas, con capacidad para reportar gastos individuales y múltiples.

## Características

- Reporte de gastos individuales (una sola factura)
- Reporte de gastos múltiples por categoría
- Subida y almacenamiento de comprobantes (fotos y documentos)
- Registro automático en Google Sheets
- Almacenamiento de archivos en Google Drive

## Instalación

1. Clona el repositorio
```bash
git clone https://github.com/[tu-usuario]/bot-gastos-telegram.git
cd bot-gastos-telegram
```

2. Instala las dependencias
```bash
npm install
```

3. Configura las variables de entorno
Crea un archivo `.env` con:
```
BOT_TOKEN=tu_token_de_bot_telegram
DRIVE_FOLDER_ID=id_de_carpeta_en_google_drive
```

4. Configura las credenciales de Google
Coloca el archivo `credentials.json` con las credenciales de acceso a la API de Google en la raíz del proyecto.

## Uso

Para iniciar el bot:
```bash
npm start
```

Para desarrollo:
```bash
npm run dev
```

## Flujos de Gastos

### Gastos Individuales
1. Envía una foto o PDF
2. Selecciona tipo de gasto
3. Ingresa monto
4. Añade comentario (opcional)
5. Selecciona método de pago

### Gastos Múltiples
1. Selecciona categoría
2. Ingresa monto total
3. Indica rango de fechas
4. Envía todos los comprobantes
5. Escribe "LISTO" o "1" para finalizar 