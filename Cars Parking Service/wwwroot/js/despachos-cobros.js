// Despachos y cobros (solo administrador): la placa (o su fila) abre la ventana con toda la información del
// vehículo, que viene en data-info (DespachosCobros.cshtml). En un vehículo cobrado y sin liquidar, los lápices
// cambian el método de pago o el valor total (HomeController.EditarCobro, que valida todo otra vez).
// Usa de site.js: escaparHtml, PESOS, mostrarAlertaWhatsApp, cerrarModalAcciones y listaCambios

const METODOS_PAGO_COBRO = ['Efectivo', 'QR', 'Transferencia', 'Nequi'];

// Vehículo que está abierto en la ventana
let infoDespacho = null;

document.querySelector('.tabla-despachos tbody')?.addEventListener('click', e => {
    const placa = e.target.closest('tr')?.querySelector('.dc-placa-btn');

    if (placa) {
        abrirInfoDespacho(JSON.parse(placa.dataset.info));
    }
});

function abrirInfoDespacho(info) {
    infoDespacho = info;

    const contenido = document.getElementById('contenido-modal-acciones');
    const editable = info.pagado && !info.liquidado;

    // Etiquetas fijas; los valores vienen de la base y se escriben como texto
    const dato = (etiqueta, valor, vacio = '—', completo = false) => `
        <div class="info-item ${completo ? 'info-item-completo' : ''}">
            <span class="info-label">${etiqueta}</span>
            <span class="info-valor">${escaparHtml(valor || vacio)}</span>
        </div>`;

    // En efectivo el valor es la tarifa y no se cambia (FinalizarServicio y EditarCobro); el método sí
    const conLapiz = (campo, etiqueta, valor, conPermiso = true) => `
        <div class="info-item" id="dc-${campo}">
            <span class="info-label">${etiqueta}</span>
            <div class="dc-editable">
                <span class="info-valor">${escaparHtml(valor)}</span>
                ${editable && conPermiso ? `
                    <button type="button" class="dc-lapiz" onclick="editarCampoCobro('${campo}')" aria-label="Cambiar ${etiqueta.toLowerCase()}">
                        <i class="fa-solid fa-pen"></i>
                    </button>` : ''}
            </div>
        </div>`;

    const liquidacion = info.liquidacion
        ? `<span class="status-badge status-pagado">#${escaparHtml(info.liquidacion)}</span>`
        : info.pagado
            ? '<span class="status-badge wa-badge-error">Sin liquidar</span>'
            : '<span class="info-valor">—</span>';

    // Foto del comprobante (punto 7): con QR, transferencia o Nequi. El admin la toma o la cambia mientras no esté
    // liquidado (HomeController.CambiarComprobante)
    const comprobante = info.pagado && info.conComprobante
        ? `<div class="info-item info-item-completo" id="dc-comprobante">
               <span class="info-label">Foto del comprobante</span>
               ${info.foto
                   ? `<img src="${escaparHtml(info.foto)}" alt="Comprobante de pago de ${escaparHtml(info.placa)}" loading="lazy"
                           class="imagen-galeria dc-comprobante-img" />`
                   : '<span class="info-valor info-vacio">Sin foto</span>'}
               ${editable
                   ? `<button type="button" class="info-btn-solicitar dc-btn-comprobante" onclick="tomarFotoComprobante()">
                          <i class="fa-solid fa-camera"></i> ${info.foto ? 'Cambiar foto del comprobante' : 'Tomar foto del comprobante'}
                      </button>
                      <input type="file" id="dc-foto-comprobante" accept="image/*" capture="environment" hidden
                             onchange="previsualizarComprobante(this)" />`
                   : ''}
           </div>`
        : '';

    const cobro = info.pagado
        ? `<div class="info-grid">
               ${conLapiz('metodo', 'Método de pago', info.metodo || 'Sin método')}
               ${conLapiz('valor', 'Valor total', PESOS.format(info.total), info.metodo !== 'Efectivo')}
               ${dato('Servicio', PESOS.format(info.servicio))}
               ${dato('Propina', PESOS.format(info.propina))}
               ${dato('Cobró', info.cobro, 'Sin registro')}
               ${dato('Hora del cobro', info.horaCobro)}
               <div class="info-item info-item-completo">
                   <span class="info-label">Liquidación</span>
                   <span>${liquidacion}</span>
               </div>
               ${comprobante}
           </div>
           ${info.liquidado
                ? `<p class="dc-nota"><i class="fa-solid fa-circle-info"></i>
                       Ya está ${info.liquidacion ? `en la liquidación #${escaparHtml(info.liquidacion)}` : 'liquidado'}: no se puede cambiar.</p>`
                : editable && info.metodo === 'Efectivo'
                    ? `<p class="dc-nota"><i class="fa-solid fa-circle-info"></i>
                           En efectivo el valor es la tarifa, sin propina. Si pagó por QR o transferencia, cambia primero el método.</p>`
                    : ''}`
        : `<div class="info-grid">${dato('Estado', 'Pendiente de cobro', '—', true)}</div>`;

    contenido.innerHTML = `
        <h2>Despacho y cobro</h2>
        <div class="info-panel">
            <div class="info-header">
                <span class="info-placa">${escaparHtml(info.placa ?? '—')}</span>
            </div>
            <p class="dc-subtitulo">
                ${escaparHtml(info.ubicacion ?? 'Sin ubicación')} ·
                ${info.pagado
                    ? '<span class="status-badge status-pagado">Pagado</span>'
                    : `<span class="status-badge status-pendiente">${escaparHtml(info.estado ?? 'Pendiente')}</span>`}
            </p>

            <h3 class="info-seccion"><i class="fa-solid fa-cash-register"></i> Cobro</h3>
            ${cobro}

            <h3 class="info-seccion"><i class="fa-solid fa-truck-fast"></i> Despacho</h3>
            <div class="info-grid">
                ${dato('Solicitó', info.solicito, 'Aún no se ha solicitado')}
                ${dato('Hora de la solicitud', info.horaSolicitud)}
                ${dato('Despachó', info.despacho, 'Sin despachar')}
                ${dato('Hora del despacho', info.horaDespacho)}
                ${dato('Lugar de entrega', info.lugarEntrega, '—', true)}
            </div>

            <h3 class="info-seccion"><i class="fa-regular fa-clock"></i> Ingreso y parqueo</h3>
            <div class="info-grid">
                ${dato('Ingreso', info.horaIngreso)}
                ${dato('Recibió', info.recibio, 'Sin valet')}
                ${dato('Parqueo', info.horaParqueo, 'Sin registro')}
                ${dato('Parqueó', info.parqueo, 'Sin registro')}
                ${dato('Parqueadero', info.parqueadero, 'Sin parqueadero', true)}
                ${dato('Banco que registró', info.banco, '—', true)}
            </div>

            <h3 class="info-seccion"><i class="fa-solid fa-user"></i> Cliente</h3>
            <div class="info-grid">
                ${dato('Nombre', info.cliente, 'Sin nombre registrado')}
                ${dato('Celular', info.celular, 'Sin celular')}
            </div>

            <h3 class="info-seccion"><i class="fa-solid fa-clock-rotate-left"></i> Cambios</h3>
            ${listaCambios(info.cambios)}
        </div>`;

    document.getElementById('modal-acciones').style.display = 'flex';
}

// Foto del comprobante (punto 7): abre la cámara; la foto se ve antes de guardarla
function tomarFotoComprobante() {
    const campo = document.getElementById('dc-foto-comprobante');
    campo.value = '';
    campo.click();
}

// Achica la foto como las demás del sistema (máx. 1600 px, JPEG): la de la cámara puede pasar los 4 MB que acepta el
// servidor por campo. Así el texto del comprobante se sigue leyendo
function achicarComprobante(archivo) {
    return new Promise((resolve, reject) => {
        const imagen = new Image();

        imagen.onload = () => {
            const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(imagen.width * escala);
            canvas.height = Math.round(imagen.height * escala);
            canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(imagen.src);
            resolve(canvas.toDataURL('image/jpeg', 0.8));
        };

        imagen.onerror = () => {
            URL.revokeObjectURL(imagen.src);
            reject(new Error('No se pudo leer la imagen'));
        };

        imagen.src = URL.createObjectURL(archivo);
    });
}

async function previsualizarComprobante(campo) {
    const archivo = campo.files?.[0];
    if (!archivo || !archivo.type.startsWith('image/')) return;

    let foto;
    try {
        foto = await achicarComprobante(archivo);
    } catch {
        mostrarAlertaWhatsApp('No se pudo leer esa foto. Toma otra.', 'error');
        return;
    }

    const caja = document.getElementById('dc-comprobante');
    caja.querySelector('.dc-edicion')?.remove();
    caja.querySelector('.dc-btn-comprobante').hidden = true;

    caja.insertAdjacentHTML('beforeend', `
        <div class="dc-edicion">
            <img src="${foto}" alt="Foto nueva del comprobante" class="dc-comprobante-img" />
            <div class="dc-edicion-botones">
                <button type="button" class="btn btn-secondary" onclick="abrirInfoDespacho(infoDespacho)">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="guardarComprobante(this)">Guardar foto</button>
            </div>
        </div>`);

    caja.querySelector('.dc-edicion').dataset.foto = foto;
}

async function guardarComprobante(boton) {
    const foto = boton.closest('.dc-edicion').dataset.foto;
    const placa = infoDespacho.placa;

    const pregunta = infoDespacho.foto
        ? `¿Estás seguro de cambiar la foto del comprobante de ${placa}?\n\nLa foto anterior se reemplaza por esta.`
        : `¿Guardar esta foto como comprobante de ${placa}?`;

    if (!confirm(pregunta)) return;

    const datos = new FormData();
    datos.append('id_ingreso', infoDespacho.id);
    datos.append('fotoBase64', foto);
    datos.append('__RequestVerificationToken', document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '');

    boton.disabled = true;
    boton.textContent = 'Guardando...';

    try {
        const respuesta = await fetch('/Home/CambiarComprobante', { method: 'POST', body: datos });
        const data = await respuesta.json();

        mostrarAlertaWhatsApp(data.mensaje, data.success ? 'success' : 'error');

        if (data.success) {
            setTimeout(() => location.reload(), 1200);
        } else {
            boton.disabled = false;
            boton.textContent = 'Guardar foto';
        }
    } catch {
        mostrarAlertaWhatsApp('No se pudo guardar la foto. Revisa la conexión e intenta de nuevo.', 'error');
        boton.disabled = false;
        boton.textContent = 'Guardar foto';
    }
}

// Lápiz: el dato se vuelve una lista (método) o un número (valor), con Cancelar y Guardar
function editarCampoCobro(campo) {
    abrirInfoDespacho(infoDespacho);   // cierra otra edición abierta

    const caja = document.getElementById(`dc-${campo}`);
    caja.classList.add('info-item-completo');
    caja.querySelector('.dc-editable').hidden = true;

    const control = campo === 'metodo'
        ? `<select id="dc-nuevo-metodo" aria-label="Nuevo método de pago">
               ${METODOS_PAGO_COBRO.map(m => `<option value="${m}" ${m === infoDespacho.metodo ? 'selected' : ''}>${m}</option>`).join('')}
           </select>`
        : `<input type="text" inputmode="numeric" autocomplete="off" id="dc-nuevo-valor" class="campo-pesos"
                  aria-label="Nuevo valor total" value="${Number(infoDespacho.total)}" />
           <span class="campo-pesos-ver" data-pesos-de="dc-nuevo-valor">${PESOS.format(infoDespacho.total)}</span>`;

    caja.insertAdjacentHTML('beforeend', `
        <div class="dc-edicion">
            ${control}
            <div class="dc-edicion-botones">
                <button type="button" class="btn btn-secondary" onclick="abrirInfoDespacho(infoDespacho)">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="guardarCampoCobro('${campo}', this)">Guardar</button>
            </div>
        </div>`);

    caja.querySelector('select, input').focus();
}

// Pregunta "¿Estás seguro?" con el cambio exacto y lo guarda; el servidor vuelve a validar
async function guardarCampoCobro(campo, boton) {
    const placa = infoDespacho.placa;
    const datos = new FormData();
    datos.append('id_ingreso', infoDespacho.id);
    datos.append('__RequestVerificationToken', document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '');

    let pregunta;

    if (campo === 'metodo') {
        const metodo = document.getElementById('dc-nuevo-metodo').value;

        if (metodo === infoDespacho.metodo) {
            abrirInfoDespacho(infoDespacho);
            return;
        }

        pregunta = `¿Estás seguro de cambiar el método de pago de ${placa} de ${infoDespacho.metodo || 'sin método'} a ${metodo}?`;

        // En efectivo no hay propina: el cobro queda en el servicio (EditarCobro)
        if (metodo === 'Efectivo' && Number(infoDespacho.total) !== Number(infoDespacho.servicio)) {
            pregunta += `\n\nEn efectivo no hay propina: el cobro queda en ${PESOS.format(infoDespacho.servicio)}.`;
        }

        datos.append('metodo_pago', metodo);
    } else {
        const campoValor = document.getElementById('dc-nuevo-valor');
        const valor = Number(campoValor.value);

        // Menos de $1.000 casi siempre es "20.000" mal escrito
        if (!Number.isInteger(valor) || valor < 1000 || valor > 10000000) {
            mostrarAlertaWhatsApp('Escribe el valor completo en pesos, de $1.000 en adelante (por ejemplo 20000).', 'error');
            campoValor.focus();
            return;
        }

        if (valor === Number(infoDespacho.total)) {
            abrirInfoDespacho(infoDespacho);
            return;
        }

        // Mismo reparto que hará el servidor: el servicio no cambia (la tarifa); lo de más es propina y si es
        // menos, la liquidación lo muestra como diferencia
        const servicio = Number(infoDespacho.servicio) > 0 ? Number(infoDespacho.servicio) : Number(infoDespacho.tarifa);
        const propina = Math.max(0, valor - servicio);

        pregunta = `¿Estás seguro de cambiar el valor total de ${placa} de ${PESOS.format(infoDespacho.total)} a ${PESOS.format(valor)}?\n\n` +
                   (valor >= servicio
                       ? `Queda: servicio ${PESOS.format(servicio)}${propina > 0 ? ` + propina ${PESOS.format(propina)}` : ''}`
                       : `Queda: servicio ${PESOS.format(servicio)}, cobrado ${PESOS.format(servicio - valor)} menos (sale como diferencia en la liquidación)`);
        datos.append('valor_total', String(valor));
    }

    if (!confirm(pregunta)) return;

    boton.disabled = true;

    try {
        const respuesta = await fetch('/Home/EditarCobro', { method: 'POST', body: datos });
        const data = await respuesta.json();

        if (!data.success) {
            mostrarAlertaWhatsApp(data.mensaje, 'error');
            boton.disabled = false;
            return;
        }

        // Se recarga con los mismos filtros para que la tabla y el resumen queden al día
        mostrarAlertaWhatsApp(data.mensaje, 'success');
        setTimeout(() => location.reload(), 1200);
    } catch {
        mostrarAlertaWhatsApp('No se pudo guardar. Revisa la conexión e intenta de nuevo.', 'error');
        boton.disabled = false;
    }
}
