const googleDrive = require('../services/drive');
const googleSheets = require('../services/sheets');

const opcionesTipo = ["Gasolina", "Gastos de oficina", "Gastos de reparaciones", "Compras"];

module.exports = {
    handleInicio: async (ctx) => {
        // Guardar el userId antes de reiniciar la sesión
        const userId = ctx.from.id;
        
        // Reiniciar la sesión pero conservar el userId
        ctx.session = {
            estado: 'seleccionandoCategoria',
            archivos: [],
            tipo: 'multiple',
            archivosProcesados: 0,
            userId: userId
        };
        
        console.log(`[GastosMultiplesFlow] Iniciando flujo, usuario ${userId}, nueva sesión:`, JSON.stringify(ctx.session));
        
        return ctx.reply(`
¿Qué tipo de gasto es? 📝

1. Gasolina ⛽️
2. Gastos de oficina 🖇️
3. Gastos de reparaciones 🔧
4. Compras 🛒
0. Para reiniciar el proceso 💀

O escribe el tipo de gasto:`);
    },

    handleMessage: async (ctx) => {
        const estado = ctx.session.estado;
        const mensaje = ctx.message.text?.trim();
        const userId = ctx.from.id;
        
        console.log(`[GastosMultiplesFlow] Mensaje: "${mensaje}", usuario: ${userId}, estado: ${estado}`);

        if (mensaje === '0') {
            ctx.session = { estado: 'inicio', userId: userId };
            return ctx.reply('Proceso reiniciado. Escribe 1 o 2 para comenzar de nuevo 🔄');
        }

        // Si el usuario escribe "1" o "LISTO" en estado esperandoArchivos
        if (estado === 'esperandoArchivos' && (mensaje === '1' || mensaje.toUpperCase() === 'LISTO')) {
            console.log(`[GastosMultiplesFlow] Procesando archivos para usuario ${userId}`);
            
            if (!ctx.session.archivos || ctx.session.archivos.length === 0) {
                return ctx.reply('❌ No has enviado ningún archivo. Por favor, envía al menos un comprobante.');
            }

            try {
                let driveUrls = [];
                
                console.log(`[GastosMultiplesFlow] Iniciando guardado de ${ctx.session.archivos.length} archivos`);
                
                // Usar Promise.all para manejar mejor los errores
                const savePromises = ctx.session.archivos.map(async (fileInfo, index) => {
                    try {
                        console.log(`[GastosMultiplesFlow] Guardando archivo ${index + 1}/${ctx.session.archivos.length}`);
                        const fileUrl = await googleDrive.saveFile(fileInfo);
                        console.log(`[GastosMultiplesFlow] Archivo ${index + 1} guardado con éxito: ${fileUrl}`);
                        return fileUrl;
                    } catch (error) {
                        console.error(`[GastosMultiplesFlow] Error al guardar archivo ${index + 1}:`, error);
                        // No lanzar error, solo registrarlo y continuar con los demás archivos
                        return null;
                    }
                });
                
                try {
                    const resultUrls = await Promise.all(savePromises);
                    driveUrls = resultUrls.filter(url => url !== null); // Filtrar los que fallaron
                    console.log(`[GastosMultiplesFlow] ${driveUrls.length} de ${ctx.session.archivos.length} archivos guardados con éxito`);
                    
                    if (driveUrls.length === 0) {
                        console.error('[GastosMultiplesFlow] Ningún archivo pudo ser guardado');
                        throw new Error('No se pudo guardar ningún archivo');
                    }
                } catch (error) {
                    console.error('[GastosMultiplesFlow] Error al guardar los archivos:', error);
                    throw new Error('No se pudieron guardar los archivos');
                }

                console.log(`[GastosMultiplesFlow] Guardando en sheets con ${driveUrls.length} URLs`);
                
                // Unir URLs con espacios para mejor formato en la hoja de cálculo
                const urlsString = driveUrls.join(' ');
                
                await googleSheets.appendGasto(ctx.from, {
                    tipo: 'multiple',
                    categoria: ctx.session.categoria,
                    monto: ctx.session.monto,
                    fecha: ctx.session.rangoFecha,
                    archivos: urlsString
                }, urlsString); // Pasar urlsString como tercer parámetro

                console.log(`[GastosMultiplesFlow] Archivos procesados con éxito para usuario ${userId}`);
                
                // Preservar el userId al reiniciar
                ctx.session = { estado: 'inicio', userId: userId };
                return ctx.reply(
                    '✅ Gastos múltiples guardados con éxito.\n\n' +
                    'Puedes registrar más gastos o escribir 000 para reiniciar.'
                );
            } catch (error) {
                console.error('[GastosMultiplesFlow] Error al procesar gastos:', error);
                return ctx.reply(`❌ Ocurrió un error al guardar los gastos. Por favor, intenta nuevamente.`);
            }
        }

        // Asegurarse de que tenemos datos básicos en la sesión
        if (!ctx.session.userId) {
            ctx.session.userId = userId;
        }

        // Usar funciones directas en lugar de referencias a this
        switch (estado) {
            case 'seleccionandoCategoria':
                return module.exports.handleCategoria(ctx);
            case 'esperandoMonto':
                return module.exports.handleMonto(ctx);
            case 'esperandoRangoFecha':
                return module.exports.handleRangoFecha(ctx);
            default:
                return ctx.reply('Por favor, selecciona una opción válida.');
        }
    },

    handleCategoria: async (ctx) => {
        const input = ctx.message.text.trim();
        const index = parseInt(input);
        const userId = ctx.from.id;

        if (input === '0') {
            ctx.session = { estado: 'inicio', userId: userId };
            return ctx.reply('Proceso reiniciado. Escribe 1 o 2 para comenzar de nuevo 🔄');
        }

        let categoria;
        if (!isNaN(index) && index >= 1 && index <= 4) {
            categoria = opcionesTipo[index - 1];
        } else {
            categoria = input;
        }

        // Mantener todos los datos de la sesión existente
        const sessionData = { ...ctx.session };
        sessionData.categoria = categoria;
        sessionData.estado = 'esperandoMonto';
        ctx.session = sessionData;
        
        console.log(`[GastosMultiplesFlow] Categoría seleccionada: ${categoria}, usuario: ${userId}`);
        
        return ctx.reply(`Por favor, ingresa el monto total de TODOS los gastos para ${categoria} 💰`);
    },

    handleMonto: async (ctx) => {
        const monto = parseFloat(ctx.message.text.trim());
        const userId = ctx.from.id;
        
        if (isNaN(monto) || monto <= 0) {
            return ctx.reply('Por favor, ingresa un monto válido mayor a 0 🚫');
        }

        // Mantener todos los datos de la sesión existente
        const sessionData = { ...ctx.session };
        sessionData.monto = monto;
        sessionData.estado = 'esperandoRangoFecha';
        ctx.session = sessionData;
        
        console.log(`[GastosMultiplesFlow] Monto ingresado: ${monto}, usuario: ${userId}`);
        
        return ctx.reply(
            'Di el rango de fecha de los gastos 📅\n' +
            'En formato MM/DD americano\n\n' +
            'Por ejemplo: 04/05-04/25\n\n' +
            'Recuerda que todas las facturas deben ser del mismo mes 📌'
        );
    },

    handleRangoFecha: async (ctx) => {
        const rangoFecha = ctx.message.text.trim();
        const userId = ctx.from.id;
        const rangoRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])$/;

        if (!rangoRegex.test(rangoFecha)) {
            return ctx.reply(
                'Formato de fecha inválido ❌\n' +
                'Usa el formato MM/DD-MM/DD\n' +
                'Por ejemplo: 04/05-04/25'
            );
        }

        // Mantener todos los datos existentes de la sesión
        const sessionData = { ...ctx.session };
        sessionData.rangoFecha = rangoFecha;
        sessionData.estado = 'esperandoArchivos';
        
        // Asegurarse de que los arrays y contadores estén inicializados
        if (!sessionData.archivos) {
            sessionData.archivos = [];
        }
        if (typeof sessionData.archivosProcesados !== 'number') {
            sessionData.archivosProcesados = 0;
        }
        
        // Actualizar la sesión completa
        ctx.session = sessionData;
        
        console.log(`[GastosMultiplesFlow] Rango de fecha establecido: ${rangoFecha}, usuario: ${userId}, sesión:`, JSON.stringify(ctx.session));
        
        return ctx.reply(
            'Por favor, envía TODAS las facturas o comprobantes (fotos o documentos) 📎\n\n' +
            'Después de enviar las facturas, escribe 1 o "LISTO" para procesar ✅\n\n' +
            'Recuerda que todas las facturas deben ser de la misma categoría 📌'
        );
    },

    handleArchivos: async (ctx) => {
        const userId = ctx.from.id;
        console.log(`[GastosMultiplesFlow] Procesando archivo, usuario: ${userId}, sesión:`, JSON.stringify(ctx.session));
        
        // Si por alguna razón no existe la sesión, reinicializarla
        if (!ctx.session) {
            console.log(`[GastosMultiplesFlow] Sesión no existe, creando nueva para usuario ${userId}`);
            ctx.session = {
                estado: 'esperandoArchivos',
                archivos: [],
                archivosProcesados: 0,
                userId: userId
            };
        }
        
        // Asegurarse de que los datos básicos existan
        const sessionData = { ...ctx.session };
        if (!sessionData.archivos) {
            sessionData.archivos = [];
        }
        if (typeof sessionData.archivosProcesados !== 'number') {
            sessionData.archivosProcesados = 0;
        }
        if (!sessionData.userId) {
            sessionData.userId = userId;
        }
        
        // Mantener el estado explícitamente
        sessionData.estado = 'esperandoArchivos';

        // Si el usuario envía un archivo
        const file = ctx.message.document || ctx.message.photo?.slice(-1)[0];
        if (!file) {
            return ctx.reply('Por favor, envía una foto o documento PDF válido 📎');
        }
        
        // Guardar el archivo
        sessionData.archivos.push({
            fileId: file.file_id,
            ctx: ctx
        });
        sessionData.archivosProcesados++;
        
        // Actualizar la sesión completa
        ctx.session = sessionData;
        
        console.log(`[GastosMultiplesFlow] Archivo ${sessionData.archivosProcesados} procesado, usuario: ${userId}, sesión:`, JSON.stringify(ctx.session));

        // Enviar mensaje de confirmación
        if (sessionData.archivosProcesados === 1) {
            return ctx.reply(
                '✅ Primer archivo recibido.\n\n' +
                'Puedes:\n' +
                '1️⃣ Finalizar y procesar los gastos\n' +
                '2️⃣ Seguir enviando más facturas\n\n' +
                'Envía más facturas o escribe 1 cuando termines.'
            );
        }

        return ctx.reply(
            `✅ Archivo ${sessionData.archivosProcesados} recibido.\n` +
            'Envía más facturas o escribe 1 para terminar.'
        );
    }
}; 