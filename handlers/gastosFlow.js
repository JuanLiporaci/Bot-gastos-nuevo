// handlers/gastosFlow.js
const googleDrive = require('../services/drive');
const googleSheets = require('../services/sheets');

const opcionesTipo = ["Gasolina", "Gastos de oficina", "Gastos de reparaciones", "Compras"];
const opcionesMetodo = ["Efectivo", "Zelle", "Transferencia", "Tarjeta"];

module.exports = {
  handleArchivo: async (ctx) => {
    const file = ctx.message.document || ctx.message.photo?.slice(-1)[0];
    if (!file) return ctx.reply('Por favor, envía una foto o un documento PDF.');

    if (ctx.session.estado === 'esperandoOtro' || ctx.session.estado === 'terminado') {
      ctx.session.estado = 'tipo';
      ctx.session.fileId = file.file_id;
    }

    if (!ctx.session.estado || ctx.session.estado === 'esperandoArchivo') {
      ctx.session.fileId = file.file_id;
      ctx.session.estado = 'tipo';
    }

    await ctx.reply(`
¿Qué tipo de gasto es?

1. Gasolina ⛽️
2. Gastos de oficina 🖇️
3. Gastos de reparaciones 🔧
4. Compras 🛒
0. Para reiniciar el proceso 💀

O escribe el tipo de gasto:`);
  },

  handleTipo: async (ctx) => {
    const input = ctx.message.text.trim();

    if (input === '0') {
      ctx.session = { estado: 'esperandoArchivo' };
      return ctx.reply('Proceso reiniciado. Envíame una foto o PDF de tu factura para comenzar 🧾');
    }

    const index = parseInt(input);
    if (!isNaN(index) && index >= 1 && index <= 4) {
      ctx.session.tipo = opcionesTipo[index - 1];
    } else {
      ctx.session.tipo = input;
    }

    ctx.session.estado = 'monto';
    return ctx.reply('¿Cuál fue el monto total del gasto? 💰');
  },

  handleMonto: async (ctx) => {
    const text = ctx.message.text.trim();
    ctx.session.monto = text;
    ctx.session.estado = 'comentario';
    return ctx.reply(`¿Deseas añadir un comentario o detalle adicional? ✏️
1. Sí ✅
2. No ❌
3. Modificar monto 🔁`);
  },

  handleComentario: async (ctx) => {
    const text = ctx.message.text.trim();

    if (ctx.session.estado === 'comentarioLibre') {
      ctx.session.comentario = text;
      ctx.session.estado = 'metodo';
      return module.exports.handleMetodoPrompt(ctx);
    }

    if (ctx.session.estado === 'comentario') {
      if (text === '1') {
        ctx.session.estado = 'comentarioLibre';
        await ctx.reply('Escribe tu comentario:');
        return;
      }

      if (text === '2') {
        ctx.session.comentario = '';
        ctx.session.estado = 'metodo';
        return module.exports.handleMetodoPrompt(ctx);
      }

      if (text === '3') {
        ctx.session.estado = 'monto';
        return ctx.reply('¿Cuál fue el monto total del gasto? 💰');
      }

      ctx.session.comentario = text;
      ctx.session.estado = 'metodo';
      return module.exports.handleMetodoPrompt(ctx);
    }

    ctx.session.estado = 'metodo';
    return module.exports.handleMetodoPrompt(ctx);
  },

  handleMetodoPrompt: async (ctx) => {
    await ctx.reply(`
¿Cuál fue el método de pago?
1. Efectivo 💵
2. Zelle 💻
3. Transferencia 🏦
4. Tarjeta 💳`);
  },

  handleMetodo: async (ctx) => {
    const input = ctx.message.text.trim();
    const index = parseInt(input);
    if (!isNaN(index) && index >= 1 && index <= 4) {
      ctx.session.metodo = opcionesMetodo[index - 1];
    } else {
      ctx.session.metodo = input;
    }

    ctx.session.estado = 'guardando';
    await ctx.reply('Guardando el gasto... 📦');

    try {
      const fileUrl = await googleDrive.saveFile(ctx);
      await googleSheets.appendGasto(ctx.from, ctx.session, fileUrl);
      await ctx.reply('✅ Gasto guardado con éxito.');
    } catch (err) {
      console.error('Error en gastosFlow:', err);
      await ctx.reply('❌ Ocurrió un error al guardar el gasto.');
    }

    ctx.session.estado = 'esperandoOtro';
    await ctx.reply(`¿Deseas registrar otro gasto?
1. Sí ✅
2. No ❌`);
  },

  handleConfirmacion: async (ctx) => {
    const input = ctx.message.text.trim();
    if (input === '1') {
      ctx.session.estado = 'esperandoArchivo';
      return ctx.reply('Envíame una foto o PDF de tu factura para comenzar 🧾');
    } else if (input === '2') {
      ctx.session.estado = 'terminado';
      return ctx.reply('¡Gracias! Puedes cerrar el bot o volver cuando quieras. 👋');
    } else if (input === '0') {
      ctx.session = { estado: 'esperandoArchivo' };
      return ctx.reply('Proceso reiniciado. Envíame una foto o PDF de tu factura para comenzar 🧾');
    } else {
      return ctx.reply(`Selecciona una opción válida:
1. Sí ✅
2. No ❌
0. Para reiniciar el proceso 💀`);
    }
  }
};