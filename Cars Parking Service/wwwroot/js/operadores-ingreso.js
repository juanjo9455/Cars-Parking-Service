// Lápiz del admin en Información (tabla de vehículos): cambia el valet, el valet de despacho, quién lo parqueó o el
// banco a cargo. site.js dibuja el lápiz donde el servidor lo permite (ObtenerInfoIngreso.operadores) y deja los
// datos en window.infoOperadores. HomeController.CambiarOperador vuelve a validar todo.
// También: el lugar de ingreso y el de entrega (CambiarLugar, punto 3) y cancelar el servicio (CancelarServicio,
// punto 8). Este archivo solo lo carga el admin (Tabla_Vehiculos.cshtml)

const PAPELES_OPERADOR = {
    valet: 'el valet',
    despacho: 'el valet de despacho',
    parqueo: 'quién lo parqueó',
    banco: 'el banco a cargo'
};

// El dato se vuelve una lista con los usuarios que pueden tener ese papel, con Cancelar y Guardar
function editarOperador(campo) {
    cancelarEdicionOperador();

    const { operadores } = window.infoOperadores;
    const lista = campo === 'banco' ? operadores.bancos : campo === 'parqueo' ? operadores.parqueadores : operadores.valets;
    const actual = operadores[campo];
    const caja = document.getElementById(`op-${campo}`);

    caja.dataset.completo = caja.classList.contains('info-item-completo');
    caja.classList.add('info-item-completo', 'op-editando');
    caja.querySelector('.dc-editable').hidden = true;

    caja.insertAdjacentHTML('beforeend', `
        <div class="dc-edicion">
            <select id="op-nuevo" aria-label="Nuevo: ${PAPELES_OPERADOR[campo]}">
                <option value="" disabled ${lista.some(u => u.id === actual) ? '' : 'selected'}>Escoge a quién</option>
                ${lista.map(u => `<option value="${u.id}" ${u.id === actual ? 'selected' : ''}>${escaparHtml(u.nombre)}</option>`).join('')}
            </select>
            <div class="dc-edicion-botones">
                <button type="button" class="btn btn-secondary" onclick="cancelarEdicionOperador()">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="guardarOperador('${campo}', this)">Guardar</button>
            </div>
        </div>`);

    caja.querySelector('select').focus();
}

function cancelarEdicionOperador() {
    document.querySelectorAll('.op-editando').forEach(caja => {
        caja.querySelector('.dc-edicion')?.remove();
        caja.querySelector('.dc-editable').hidden = false;
        caja.classList.remove('op-editando');
        if (caja.dataset.completo !== 'true') caja.classList.remove('info-item-completo');
    });
}

// Pregunta "¿Estás seguro?" con el antes y el después, guarda y vuelve a cargar Información
async function guardarOperador(campo, boton) {
    const { idIngreso, placa, operadores } = window.infoOperadores;
    const select = document.getElementById('op-nuevo');
    const id = Number(select.value);

    if (!id) {
        mostrarAlertaWhatsApp('Escoge a quién vas a poner.', 'error');
        select.focus();
        return;
    }

    if (id === operadores[campo]) {
        cancelarEdicionOperador();
        return;
    }

    const antes = document.querySelector(`#op-${campo} .info-valor`)?.textContent.trim() || 'sin registro';
    const ahora = select.selectedOptions[0].textContent.trim();

    let pregunta = `¿Estás seguro de cambiar ${PAPELES_OPERADOR[campo]} de ${placa}?\n\nAntes: ${antes}\nAhora: ${ahora}`;
    if (campo === 'banco') {
        pregunta += '\n\nEl vehículo pasa a su cargo para cobrarlo y queda registrado el traspaso.';
    }

    if (!confirm(pregunta)) return;

    const datos = new FormData();
    datos.append('id_ingreso', idIngreso);
    datos.append('campo', campo);
    datos.append('id_usuario', id);
    datos.append('__RequestVerificationToken', document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '');

    boton.disabled = true;

    try {
        const respuesta = await fetch('/Home/CambiarOperador', { method: 'POST', body: datos });
        const data = await respuesta.json();

        mostrarAlertaWhatsApp(data.mensaje, data.success ? 'success' : 'error');

        if (data.success) {
            abrirModalInformacion(window.infoOperadores.boton);
        } else {
            boton.disabled = false;
        }
    } catch (error) {
        console.error('[OPERADORES] No se pudo guardar:', error);
        mostrarAlertaWhatsApp('No se pudo guardar el cambio. Revisa la conexión e intenta de nuevo.', 'error');
        boton.disabled = false;
    }
}

// Manda un cambio del admin (FormData con el token) y vuelve a cargar Información si salió bien
async function enviarCambioAdmin(url, datos, boton, alTerminar) {
    datos.append('__RequestVerificationToken', document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '');
    boton.disabled = true;

    try {
        const respuesta = await fetch(url, { method: 'POST', body: datos });
        const data = await respuesta.json();

        mostrarAlertaWhatsApp(data.mensaje, data.success ? 'success' : 'error');

        if (data.success) {
            alTerminar();
        } else {
            boton.disabled = false;
        }
    } catch (error) {
        console.error('[ADMIN] No se pudo guardar:', error);
        mostrarAlertaWhatsApp('No se pudo guardar el cambio. Revisa la conexión e intenta de nuevo.', 'error');
        boton.disabled = false;
    }
}

// =========================== Lugares (punto 3) =========================== \\

// El lugar se vuelve una lista: ingreso, las ubicaciones de la zona del vehículo; entrega, las mismas por nombre y
// "Otra ubicación…" para escribirlo (como en la solicitud)
function editarLugar(campo) {
    cancelarEdicionOperador();

    const { lugares } = window.infoOperadores;
    const caja = document.getElementById(`op-lugar-${campo}`);
    const actual = caja.querySelector('.info-valor')?.textContent.trim() ?? '';
    const esIngreso = campo === 'ingreso';
    const hayActual = esIngreso
        ? lugares.ubicaciones.some(u => u.id === lugares.ingreso)
        : lugares.ubicaciones.some(u => u.nombre === actual);

    caja.dataset.completo = caja.classList.contains('info-item-completo');
    caja.classList.add('info-item-completo', 'op-editando');
    caja.querySelector('.dc-editable').hidden = true;

    const opciones = lugares.ubicaciones.map(u => esIngreso
        ? `<option value="${u.id}" ${u.id === lugares.ingreso ? 'selected' : ''}>${escaparHtml(u.nombre)}</option>`
        : `<option value="${escaparHtml(u.nombre)}" ${u.nombre === actual ? 'selected' : ''}>${escaparHtml(u.nombre)}</option>`);

    caja.insertAdjacentHTML('beforeend', `
        <div class="dc-edicion">
            <select id="op-nuevo-lugar" aria-label="Nuevo ${esIngreso ? 'lugar de ingreso' : 'lugar de entrega'}"
                    ${esIngreso ? '' : 'onchange="cambiarOtroLugar(this)"'}>
                <option value="" disabled ${hayActual ? '' : 'selected'}>Escoge el lugar</option>
                ${opciones.join('')}
                ${esIngreso ? '' : '<option value="__otra">Otra ubicación…</option>'}
            </select>
            ${esIngreso ? '' : '<input type="text" id="op-otro-lugar" maxlength="50" placeholder="Escribe el lugar de entrega" aria-label="Lugar de entrega" hidden />'}
            <div class="dc-edicion-botones">
                <button type="button" class="btn btn-secondary" onclick="cancelarEdicionOperador()">Cancelar</button>
                <button type="button" class="btn btn-primary" onclick="guardarLugar('${campo}', this)">Guardar</button>
            </div>
        </div>`);

    caja.querySelector('select').focus();
}

// "Otra ubicación…" muestra el campo para escribir el lugar
function cambiarOtroLugar(select) {
    const otro = document.getElementById('op-otro-lugar');
    otro.hidden = select.value !== '__otra';
    if (!otro.hidden) otro.focus();
}

async function guardarLugar(campo, boton) {
    const { idIngreso, placa } = window.infoOperadores;
    const select = document.getElementById('op-nuevo-lugar');
    const esIngreso = campo === 'ingreso';
    const otro = select.value === '__otra';
    const nuevo = otro ? document.getElementById('op-otro-lugar').value.trim() : select.value;
    const textoNuevo = otro ? nuevo : select.selectedOptions[0]?.textContent.trim();

    if (!nuevo) {
        mostrarAlertaWhatsApp(otro ? 'Escribe el lugar de entrega.' : 'Escoge el lugar.', 'error');
        (otro ? document.getElementById('op-otro-lugar') : select).focus();
        return;
    }

    const antes = document.querySelector(`#op-lugar-${campo} .info-valor`)?.textContent.trim() || 'sin lugar';

    if (textoNuevo === antes) {
        cancelarEdicionOperador();
        return;
    }

    let pregunta = `¿Estás seguro de cambiar el lugar de ${esIngreso ? 'ingreso' : 'entrega'} de ${placa}?\n\nAntes: ${antes}\nAhora: ${textoNuevo}`;
    if (esIngreso) {
        pregunta += '\n\nSi todavía no se ha cobrado (ni pagado por el enlace), se cobra con la tarifa del lugar nuevo.';
    }

    if (!confirm(pregunta)) return;

    const datos = new FormData();
    datos.append('id_ingreso', idIngreso);
    datos.append('campo', campo);
    datos.append(esIngreso ? 'id_ubicacion' : 'lugar_entrega', nuevo);

    await enviarCambioAdmin('/Home/CambiarLugar', datos, boton, () => abrirModalInformacion(window.infoOperadores.boton));
}

// =========================== Cancelar servicio (punto 8) =========================== \\

// Al final de Información y plegado. El botón necesita doble clic (o dos toques seguidos en el celular), motivo y
// confirmación
function seccionCancelarServicio(idIngreso, placa) {
    return `
        <details class="info-admin-opciones">
            <summary><i class="fa-solid fa-user-shield"></i> Opciones del administrador</summary>
            <div class="info-cancelar">
                <p class="info-nota">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    Cancelar el servicio de ${escaparHtml(placa ?? '')}: deja de estar activo y no se cobra. No se puede deshacer.
                </p>
                <label for="motivo-cancelacion">Motivo (obligatorio)</label>
                <textarea id="motivo-cancelacion" maxlength="250" rows="2"
                          placeholder="Ej.: ingreso duplicado, el cliente se fue sin el carro"></textarea>
                <button type="button" class="btn-cancelar-servicio" onclick="clicCancelarServicio(${Number(idIngreso)}, this)">
                    <i class="fa-solid fa-ban"></i> Cancelar servicio
                </button>
                <span class="info-cancelar-ayuda" id="ayuda-cancelar">Haz doble clic (o toca dos veces seguidas)</span>
            </div>
        </details>`;
}

// Doble clic hecho a mano: dos clics o toques en menos de 0,8 s. dblclick no llega igual en todos los celulares
let ultimoClicCancelar = 0;

function clicCancelarServicio(idIngreso, boton) {
    const ahora = Date.now();

    if (ahora - ultimoClicCancelar > 800) {
        ultimoClicCancelar = ahora;
        document.getElementById('ayuda-cancelar')?.classList.add('resaltada');
        return;
    }

    ultimoClicCancelar = 0;
    cancelarServicio(idIngreso, boton);
}

async function cancelarServicio(idIngreso, boton) {
    const { placa } = window.infoOperadores;
    const campoMotivo = document.getElementById('motivo-cancelacion');
    const motivo = campoMotivo.value.trim();

    if (motivo.length < 5) {
        mostrarAlertaWhatsApp('Escribe el motivo de la cancelación (mínimo 5 letras).', 'error');
        campoMotivo.focus();
        return;
    }

    if (!confirm(`¿Seguro que quieres CANCELAR el servicio de ${placa}?\n\nMotivo: ${motivo}\n\nNo se puede deshacer.`)) return;

    const datos = new FormData();
    datos.append('id_ingreso', idIngreso);
    datos.append('motivo', motivo);

    await enviarCambioAdmin('/Home/CancelarServicio', datos, boton, () => {
        cerrarModalAcciones();
        window.refrescarTablaIngresos?.();
    });
}
