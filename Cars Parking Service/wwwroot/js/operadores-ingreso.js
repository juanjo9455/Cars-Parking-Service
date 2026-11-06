// Lápiz del admin en Información (tabla de vehículos): cambia el valet, el valet de despacho, quién lo parqueó o el
// banco a cargo. site.js dibuja el lápiz donde el servidor lo permite (ObtenerInfoIngreso.operadores) y deja los
// datos en window.infoOperadores. HomeController.CambiarOperador vuelve a validar todo.

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
