const { Telegraf, session } = require('telegraf');
const gastosFlow = require('./handlers/gastosFlow');
const gastosMultiplesFlow = require('./handlers/gastosMultiplesFlow');
require('dotenv').config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Configurar middleware de sesión
bot.use(session({ 
    defaultSession: () => ({ estado: 'inicio' }) 
}));

// Gestor de limitación de mensajes
const messageRateLimiter = {
    users: {},
    
    // Comprobar si se debe limitar un mensaje para un usuario
    shouldLimit(userId, messageType) {
        const now = Date.now();
        const key = `${userId}:${messageType}`;
        
        // Si no hay entrada para este usuario y tipo, crear una
        if (!this.users[key]) {
            this.users[key] = {
                lastMessageTime: now,
                count: 1
            };
            return false;
        }
        
        const userEntry = this.users[key];
        
        // Si ha pasado más de 5 segundos desde el último mensaje, reiniciar
        if (now - userEntry.lastMessageTime > 5000) {
            userEntry.lastMessageTime = now;
            userEntry.count = 1;
            return false;
        }
        
        // Si han llegado demasiados mensajes del mismo tipo en 5 segundos
        if (userEntry.count >= 1) {
            userEntry.lastMessageTime = now;
            return true;
        }
        
        // Incrementar el contador y actualizar la hora
        userEntry.count++;
        userEntry.lastMessageTime = now;
        return false;
    },
    
    // Limpiar entradas antiguas
    cleanup() {
        const now = Date.now();
        for (const key in this.users) {
            if (now - this.users[key].lastMessageTime > 30000) { // 30 segundos
                delete this.users[key];
            }
        }
    }
};

// Limpiar el rate limiter periódicamente
setInterval(() => messageRateLimiter.cleanup(), 60000);

// Middleware para validar y restaurar la sesión
bot.use((ctx, next) => {
    if (!ctx.session) {
        console.log('Creando nueva sesión');
        ctx.session = { estado: 'inicio' };
    }

    // Asegurarse de que los datos básicos existan
    if (ctx.session.estado === 'esperandoArchivos') {
        if (!ctx.session.archivos) {
            ctx.session.archivos = [];
        }
        if (typeof ctx.session.archivosProcesados !== 'number') {
            ctx.session.archivosProcesados = 0;
        }
    }

    // Imprimir la sesión actual
    console.log(`[Middleware] Usuario ${ctx.from?.id}, estado: ${ctx.session.estado}`);
    
    return next();
});

// Función para mostrar el menú inicial
const mostrarMenuInicial = (ctx) => {
    // Guardar una referencia de la sesión existente
    const oldSession = { ...ctx.session };
    
    // Actualizar el estado pero preservar el ID del usuario
    ctx.session = { 
        estado: 'inicio',
        userId: oldSession.userId || ctx.from.id
    };
    
    return ctx.reply(
        '¡Bienvenido al bot de gestión de gastos! 🤖\n\n' +
        '¿Qué quieres hacer?\n\n' +
        '1️⃣ Reportar gasto individual (una sola factura)\n' +
        '2️⃣ Reportar gastos por categoría (múltiples facturas)\n\n' +
        'Escribe el número de la opción que deseas utilizar.\n' +
        '(Puedes escribir 000 en cualquier momento para reiniciar)'
    );
};

// Manejo de mensajes de texto
bot.on('text', async (ctx) => {
    const mensaje = ctx.message.text.trim();
    const estado = ctx.session.estado;
    const userId = ctx.from.id;

    // Asegurarse de que la sesión tenga siempre el userId
    ctx.session.userId = userId;

    console.log(`Procesando mensaje: "${mensaje}" de usuario ${userId} en estado ${estado}`);

    // Comando especial para depuración - mostrar estado actual
    if (mensaje === '/debug') {
        return ctx.reply(`Estado actual: ${estado}\nDatos de sesión: ${JSON.stringify(ctx.session)}`);
    }

    // Comando especial para forzar estado
    if (mensaje.startsWith('/estado_')) {
        const nuevoEstado = mensaje.replace('/estado_', '');
        const estadosValidos = ['inicio', 'esperandoArchivo', 'seleccionandoCategoria', 'esperandoMonto', 'esperandoRangoFecha', 'esperandoArchivos'];
        
        if (estadosValidos.includes(nuevoEstado)) {
            const oldSession = { ...ctx.session };
            ctx.session = { 
                ...oldSession,
                estado: nuevoEstado 
            };
            return ctx.reply(`Estado cambiado a: ${nuevoEstado}`);
        } else {
            return ctx.reply(`Estados válidos: ${estadosValidos.join(', ')}`);
        }
    }

    // Reinicio manual con 000
    if (mensaje === '000') {
        return mostrarMenuInicial(ctx);
    }

    // Manejo del menú inicial
    if (estado === 'inicio') {
        if (mensaje === '1') {
            ctx.session.estado = 'esperandoArchivo';
            return ctx.reply('Envíame una foto o PDF de tu factura para comenzar 🧾');
        } else if (mensaje === '2') {
            return gastosMultiplesFlow.handleInicio(ctx);
        } else {
            return mostrarMenuInicial(ctx);
        }
    }

    // Manejo de estados para gastos múltiples
    if (['seleccionandoCategoria', 'esperandoMonto', 'esperandoRangoFecha', 'esperandoArchivos'].includes(estado)) {
        return gastosMultiplesFlow.handleMessage(ctx);
    }

    // Manejo de estados para gasto individual
    if (['tipo', 'monto', 'comentario', 'comentarioLibre', 'metodo', 'esperandoOtro'].includes(estado)) {
        if (estado === 'tipo') return gastosFlow.handleTipo(ctx);
        if (estado === 'monto') return gastosFlow.handleMonto(ctx);
        if (estado === 'comentario' || estado === 'comentarioLibre') return gastosFlow.handleComentario(ctx);
        if (estado === 'metodo') return gastosFlow.handleMetodo(ctx);
        if (estado === 'esperandoOtro') return gastosFlow.handleConfirmacion(ctx);
    }
});

// Manejo de archivos (fotos y documentos)
bot.on(['photo', 'document'], async (ctx) => {
    const estado = ctx.session.estado;
    const userId = ctx.from.id;

    // Asegurarse de que la sesión tenga siempre el userId
    ctx.session.userId = userId;

    console.log(`Recibido archivo, usuario ${userId}, estado actual: ${estado}`, JSON.stringify(ctx.session));

    // Si no hay estado, mostrar menú inicial
    if (!estado) {
        return mostrarMenuInicial(ctx);
    }

    // Manejo de archivos para gasto individual
    if (estado === 'esperandoArchivo') {
        return gastosFlow.handleArchivo(ctx);
    }

    // Manejo de archivos para gastos múltiples
    if (estado === 'esperandoArchivos') {
        // Guardar una referencia local de la sesión para verificar después
        const sessionAntes = JSON.stringify(ctx.session);
        
        // Manejar el archivo
        await gastosMultiplesFlow.handleArchivos(ctx);
        
        // Verificar si la sesión cambió correctamente
        console.log('Sesión antes:', sessionAntes);
        console.log('Sesión después:', JSON.stringify(ctx.session));
        
        return;
    }

    // Si estamos en cualquier otro estado, solo responder una vez por cada 5 segundos
    if (!messageRateLimiter.shouldLimit(userId, 'wrongStateMedia')) {
        return ctx.reply('Por favor, sigue las instrucciones anteriores antes de enviar archivos 🙏');
    }
});

// Manejo de errores
bot.catch((err, ctx) => {
    console.error('Error del bot:', err);
    
    // Solo mostrar mensaje de error al usuario si no es un error de procesamiento de archivo
    if (!err.message || !err.message.includes('ETELEGRAM')) {
        ctx.reply('❌ Ocurrió un error inesperado. Escribe 000 para reiniciar.');
    } else {
        console.log('Error de Telegram al procesar archivo, continuando silenciosamente...');
    }
});

// Iniciar el bot
bot.launch()
    .then(() => {
        console.log('🤖 Bot de gastos iniciado y listo para usar...');
    })
    .catch(err => {
        console.error('Error al iniciar el bot:', err);
        process.exit(1);
    });

// Habilitar el cierre elegante
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
