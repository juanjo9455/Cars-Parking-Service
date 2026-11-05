// Despachos y cobros (solo administrador): la placa (o su fila) abre la ventana con toda la información del
// vehículo, que viene en data-info (DespachosCobros.cshtml). En un vehículo cobrado y sin liquidar, los lápices
// cambian el método de pago o el valor total (HomeController.EditarCobro, que valida todo otra vez).
// Usa de site.js: escaparHtml, PESOS, mostrarAlertaWhatsApp y cerrarModalAcciones

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

    const conLapiz = (campo, etiqueta, valor) => `
        <div class="info-item" id="dc-${campo}">
            <span class="info-label">${etiqueta}</span>
            <div class="dc-editable">
                <span class="info-valor">${escaparHtml(valor)}</span>
                ${editable ? `
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

    const cobro = info.pagado
        ? `<div class="info-grid">
               ${conLapiz('metodo', 'Método de pago', info.metodo || 'Sin método')}
               ${conLapiz('valor', 'Valor total', PESOS.format(info.total))}
               ${dato('Servicio', PESOS.format(info.servicio))}
               ${dato('Propina', PESOS.format(info.propina))}
               ${dato('Cobró', info.cobro, 'Sin registro')}
               ${dato('Hora del cobro', info.horaCobro)}
               <div class="info-item info-item-completo">
                   <span class="info-label">Liquidación</span>
                   <span>${liquidacion}</span>
               </div>
           </div>
           ${info.liquidado
                ? `<p class="dc-nota"><i class="fa-solid fa-circle-info"></i>
                       Ya está ${info.liquidacion ? `en la liquidación #${escaparHtml(info.liquidacion)}` : 'liquidado'}: no se puede cambiar.</p>`
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
        </div>`;

    document.getElementById('modal-acciones').style.display = 'flex';
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

        // Mismo reparto que hará el servidor: hasta la tarifa es servicio; lo de más, propina
        const servicio = Math.min(valor, Number(infoDespacho.tarifa));
        const propina = valor - servicio;

        pregunta = `¿Estás seguro de cambiar el valor total de ${placa} de ${PESOS.format(infoDespacho.total)} a ${PESOS.format(valor)}?\n\n` +
                   `Queda: servicio ${PESOS.format(servicio)}${propina > 0 ? ` + propina ${PESOS.format(propina)}` : ''}`;
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
