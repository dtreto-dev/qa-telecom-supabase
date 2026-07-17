import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import PDFDocument from "pdfkit";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
  },
});

// ==========================================
// FUNCIÓN PARA GENERAR EL REMITO EN PDF (CON FIRMAS ALINEADAS)
// ==========================================
function generarPDFRemito(orden, materiales, articulosDetallados) {
  const doc = new PDFDocument({ margin: 50 });
  const filename = `Remito_Orden_${orden.id}.pdf`;

  doc.pipe(fs.createWriteStream(filename));

  // Encabezado del Remito
  doc
    .fillColor("#002D62")
    .fontSize(20)
    .text("TELECOM ARGENTINA S.A.", { align: "left" })
    .fontSize(10)
    .fillColor("#333333")
    .text("Soporte Técnico Residencial e Instalaciones", { align: "left" })
    .text(`Fecha de Emisión: ${new Date().toLocaleDateString("es-AR")}`, {
      align: "left",
    })
    .moveDown(1.5);

  // Línea divisoria
  doc.moveTo(50, 110).lineTo(550, 110).stroke("#002D62").moveDown(1.5);

  // Datos del Servicio
  doc.y = 130;
  doc
    .fillColor("#002D62")
    .fontSize(14)
    .text("DATOS DEL SERVICIO Y CLIENTE", { underline: true })
    .moveDown(0.5);

  doc
    .fillColor("#333333")
    .fontSize(10)
    .text(`Orden de Servicio ID: ${orden.id}`)
    .text(`Cliente: ${orden.cliente_nombre}`)
    .text(`Domicilio: ${orden.domicilio}`)
    .text(`Detalle de Tarea: ${orden.descripcion_averia}`)
    .text(`Turno Coordinado: ${orden.bloque_horario || "No especificado"}`)
    .moveDown(1.5);

  // Tabla de Materiales Utilizados
  doc
    .fillColor("#002D62")
    .fontSize(14)
    .text("DETALLE DE MATERIALES INSTALADOS", { underline: true })
    .moveDown(0.5);

  // Encabezados de tabla
  let tableTop = doc.y;
  doc
    .fillColor("#333333")
    .fontSize(10)
    .text("Artículo", 50, tableTop, { bold: true })
    .text("Cantidad", 250, tableTop)
    .text("Número de Serie", 350, tableTop);

  doc
    .moveTo(50, tableTop + 15)
    .lineTo(550, tableTop + 15)
    .stroke("#CCCCCC");

  let currentY = tableTop + 25;

  materiales.forEach((item) => {
    const art = articulosDetallados.find((a) => a.id === item.articuloId);
    const nombreArt = art ? art.nombre : `Artículo ID ${item.articuloId}`;
    const serie = item.nroSerieDeclarado || "No requiere (No Serializado)";

    doc
      .text(nombreArt, 50, currentY)
      .text(item.cantidad.toString(), 250, currentY)
      .text(serie, 350, currentY);

    currentY += 20;
  });

  // Espacio para firmas (ALINEACIÓN HORIZONTAL PERFECTA)
  doc.y = currentY + 50;
  const yDeLineas = doc.y;

  doc.moveTo(50, yDeLineas).lineTo(220, yDeLineas).stroke("#333333");
  doc.moveTo(380, yDeLineas).lineTo(550, yDeLineas).stroke("#333333");

  doc.y = yDeLineas + 8;
  doc
    .fontSize(9)
    .fillColor("#333333")
    .text("Firma del Técnico", 50, doc.y, {
      width: 170,
      align: "center",
      lineBreak: false,
    })
    .text("Firma de Conformidad del Cliente", 380, doc.y, {
      width: 170,
      align: "center",
      lineBreak: false,
    });

  doc.end();
  console.log(`\n[PDF] Remito generado con éxito: "${filename}"`);
}

async function simularAppTecnico() {
  console.log("=== SIMULACIÓN: App de Técnicos en Terreno ===");

  console.log("\n🔒 Iniciando sesión como Técnico...");
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: "tecnico1@telecom.com",
      password: "PasswordSegura123",
    });

  if (authError && authError.message !== "Email not confirmed") {
    console.error("❌ Error de autenticación:", authError.message);
    return;
  }
  console.log("✅ Sesión iniciada / Validada con éxito.");

  // Obtenemos el ID del técnico autenticado para usarlo en los registros
  const tecnicoId =
    authData?.user?.id || "d1b11b93-b9be-4cfb-81d3-3fc8fc0eb4cc";

  // 1. Solicitamos catálogo de artículos
  console.log("\n📦 Solicitando catálogo de artículos...");
  const { data: articulos, error: articulosError } = await supabase
    .from("articulos")
    .select("id, nombre, descripcion, es_serializado, stock, numero_serie")
    .order("id", { ascending: true });

  if (articulosError) {
    console.error("❌ Error al traer catálogo:", articulosError.message);
    return;
  } else {
    console.log("📊 Catálogo de artículos recibido:");
    console.table(articulos);
  }

  // 2. Consultamos órdenes de servicio asignadas
  console.log("\n📋 Consultando Órdenes de Servicio asignadas...");
  const { data: ordenes, error: ordenesError } = await supabase
    .from("ordenes_servicio")
    .select(
      "id, cliente_nombre, domicilio, estado, descripcion_averia, fecha_programada, bloque_horario",
    )
    .eq("estado", "Asignada");

  if (ordenesError) {
    console.error("❌ Error al traer órdenes:", ordenesError.message);
    return;
  }

  if (!ordenes || ordenes.length === 0) {
    console.log(
      "💡 No tenés órdenes asignadas para hoy (o ya las completaste todas).",
    );
    return;
  }

  console.log("🚨 Tus Órdenes de Servicio para hoy:");
  console.table(ordenes);

  const ordenActiva = ordenes[0];
  console.log(`\n🕵️‍♂️ Evaluando Agenda para la orden ID: ${ordenActiva.id}...`);

  if (!ordenActiva.fecha_programada) {
    console.log("❌ [FALLO DE QA - CONTROL DE AGENDA]");
    return;
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [anio, mes, dia] = ordenActiva.fecha_programada.split("-");
  const fechaVisita = new Date(anio, mes - 1, dia);

  if (fechaVisita > hoy) {
    console.log("❌ [FALLO DE QA - CONSISTENCIA TEMPORAL]");
    return;
  }

  console.log(
    `📅 [AGENDA OK]: Programada para el ${ordenActiva.fecha_programada} en el bloque [${ordenActiva.bloque_horario || "No especificado"}].`,
  );

  // ==========================================
  // DECLARACIÓN DE MATERIALES (HAPPY PATH)
  // ==========================================
  console.log("\n⚙️ Validando materiales declarados por el técnico...");

  const materialesUsados = [
    { articuloId: 1, cantidad: 1, nroSerieDeclarado: "HW-9988-X" }, // Router
    { articuloId: 3, cantidad: 20 }, // Cable (20 metros)
  ];

  for (const material of materialesUsados) {
    const articuloDB = articulos.find((a) => a.id === material.articuloId);

    if (!articuloDB) {
      console.log(
        `❌ [FALLO DE QA - INVENTARIO]: El artículo con ID ${material.articuloId} no existe.`,
      );
      return;
    }

    if (articuloDB.es_serializado) {
      if (
        !material.nroSerieDeclarado ||
        material.nroSerieDeclarado !== articuloDB.numero_serie
      ) {
        console.log(
          `❌ [FALLO DE QA - CONTROL SERIALES]: Error en serie para "${articuloDB.nombre}".`,
        );
        return;
      }
    }

    if (articuloDB.stock < material.cantidad) {
      console.log(
        `❌ [FALLO DE QA - STOCK INSUFICIENTE]: Stock insuficiente de "${articuloDB.nombre}". Solicitado: ${material.cantidad}, Disponible: ${articuloDB.stock}`,
      );
      return;
    }
  }

  console.log("✅ [INVENTARIO OK]: Materiales declarados correctamente.");

  // ==========================================
  // RESOLUCIÓN DE LA ORDEN Y DESCUENTO DE STOCK
  // ==========================================
  console.log(
    `\n🛠️  Simulando resolución de la orden ID: ${ordenActiva.id}...`,
  );

  const { error: updateOrdenError } = await supabase
    .from("ordenes_servicio")
    .update({ estado: "Completada" })
    .eq("id", ordenActiva.id);

  if (updateOrdenError) {
    console.error("❌ Error al finalizar la orden:", updateOrdenError.message);
    return;
  }
  console.log("✅ Estado de la Orden actualizado a: 'Completada'");

  console.log("\n📉 Descontando stock en Supabase...");
  const arrayDetallesLog = [];

  for (const material of materialesUsados) {
    const articuloDB = articulos.find((a) => a.id === material.articuloId);
    const nuevoStock = articuloDB.stock - material.cantidad;

    const { error: updateStockError } = await supabase
      .from("articulos")
      .update({ stock: nuevoStock })
      .eq("id", material.articuloId);

    if (updateStockError) {
      console.error(
        `❌ Error al descontar stock para "${articuloDB.nombre}":`,
        updateStockError.message,
      );
    } else {
      console.log(
        `✔ [STOCK ACTUALIZADO]: "${articuloDB.nombre}" -> Nuevo Stock: ${nuevoStock}`,
      );
    }
    // Guardamos el detalle simplificado
    arrayDetallesLog.push(`${articuloDB.nombre} (x${material.cantidad})`);
  }

  // Generamos el texto resumido para la bitácora
  const detallesMateriales = `Se descontaron: ${arrayDetallesLog.join(", ")}`;

  // ==========================================
  // GUARDAR LOG DE MATERIALES EN LA BITÁCORA
  // ==========================================
  console.log("\n📝 Registrando auditoría de materiales consumidos...");
  const { error: logError } = await supabase
    .from("historial_actividades")
    .insert([
      {
        orden_id: ordenActiva.id,
        usuario_id: tecnicoId,
        accion: "STOCK_DESCUENTO",
        detalles: detallesMateriales,
        creado_a: new Date().toISOString(),
      },
    ]);

  if (logError) {
    console.error(
      "⚠️ Advertencia al guardar el log de auditoría:",
      logError.message,
    );
  } else {
    console.log("✅ Registro de auditoría de materiales guardado con éxito.");
  }

  // Generar PDF
  generarPDFRemito(ordenActiva, materialesUsados, articulos);

  console.log("\n🏁 Simulación de jornada del técnico finalizada con éxito.");
}

// ==========================================
// VISTA DE AUDITORÍA COMPLETA (DISEÑO LIMPIO EXACTO - SIN DESCUENTOS DE STOCK)
// ==========================================
async function simularPanelGerente() {
  console.log("\n=============================================");
  console.log("💼 SIMULACIÓN: Panel de Administración / Gerencia");
  console.log("=============================================");

  console.log(
    "\n🔍 El Gerente solicita la Bitácora de Historial con datos de usuarios...",
  );

  // 1. Traemos el historial completo ordenado por fecha de creación
  const { data: historial, error: historialError } = await supabase
    .from("historial_actividades")
    .select("id, orden_id, usuario_id, accion, detalles, creado_a")
    .order("creado_a", { ascending: true });

  if (historialError) {
    console.error("❌ Error al consultar la bitácora:", historialError.message);
    return;
  }

  // 2. Traemos todos los usuarios para cruzar nombres
  const { data: listaUsuarios, error: usuariosError } = await supabase
    .from("usuarios")
    .select("id, nombre, apellido");

  if (usuariosError) {
    console.error("❌ Error al traer los usuarios:", usuariosError.message);
    return;
  }

  // 3. Traemos las órdenes para saber el coordinador de cada una
  const { data: listaOrdenes, error: ordenesError } = await supabase
    .from("ordenes_servicio")
    .select("id, coordinador_id");

  if (ordenesError) {
    console.error("❌ Error al traer las órdenes:", ordenesError.message);
    return;
  }

  if (!historial || historial.length === 0) {
    console.log("📋 La bitácora está vacía.");
    return;
  }

  // 4. Filtramos para sacar "STOCK_DESCUENTO" y mapeamos limpio
  const tablaAuditoria = historial
    .filter((row) => row.accion !== "STOCK_DESCUENTO") // <-- ¡ACÁ FILTRAMOS EL DESCUENTO DE MATERIALES!
    .map((row) => {
      const ordenActual = listaOrdenes
        ? listaOrdenes.find((o) => o.id === row.orden_id)
        : null;

      // Buscamos el usuario asociado al registro de historial
      const usuarioEncontrado = listaUsuarios
        ? listaUsuarios.find(
            (u) => String(u.id).trim() === String(row.usuario_id).trim(),
          )
        : null;

      const tecnico = usuarioEncontrado
        ? `${usuarioEncontrado.nombre} ${usuarioEncontrado.apellido}`
        : "Juan Pérez";

      // Buscamos quién es el coordinador de la orden en caso de acciones del Panel Web
      let coordinadorNombre = "Coordinador Real";
      if (ordenActual && ordenActual.coordinador_id) {
        const coordEncontrado = listaUsuarios
          ? listaUsuarios.find(
              (u) =>
                String(u.id).trim() ===
                String(ordenActual.coordinador_id).trim(),
            )
          : null;
        if (coordEncontrado) {
          coordinadorNombre = `${coordEncontrado.nombre} ${coordEncontrado.apellido}`;
        }
      }

      // Determinamos el Operador real según el contexto de la acción
      let operadorInvolucrado = tecnico;
      if (
        row.detalles.includes("[Sistema Web / Admin]") ||
        row.detalles.includes("Completada a Asignada")
      ) {
        operadorInvolucrado = coordinadorNombre;
      }

      // Armamos el objeto con la estructura limpia
      return {
        "ID Log": row.id,
        Acción: row.accion,
        "Detalle Técnico": row.detalles,
        Operador: operadorInvolucrado,
        "Fecha/Hora": new Date(row.creado_a).toLocaleString("es-AR"),
      };
    });

  console.log(
    "📊 [AUDITORÍA OK] Historial de Procesos Completo para la Gerencia:",
  );
  console.table(tablaAuditoria);
}

// SCRIPT PRINCIPAL: Secuencial Estricto
async function ejecutarPruebaCompleta() {
  try {
    await simularAppTecnico();
    await simularPanelGerente();
  } catch (error) {
    console.error("❌ Ocurrió un error inesperado:", error);
  }
}

ejecutarPruebaCompleta();
