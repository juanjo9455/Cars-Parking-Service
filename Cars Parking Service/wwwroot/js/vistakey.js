
function mostrarDebugKeyAlerta(mensaje, tipo = 'info') {
    const containerId = 'debugKeyAlertContainer';
    let container = document.getElementById(containerId);

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'debug-alert-container';
        document.body.appendChild(container);
    }

    const alerta = document.createElement('div');
    alerta.className = `debug-alert ${tipo}`;
    alerta.innerHTML = '<div class="debug-alert-title"></div><div class="debug-alert-message"></div>';
    alerta.querySelector('.debug-alert-title').textContent = 'Parqueadero';
    alerta.querySelector('.debug-alert-message').textContent = mensaje;

    container.appendChild(alerta);

    requestAnimationFrame(() => alerta.classList.add('show'));

    setTimeout(() => {
        alerta.classList.remove('show');
        setTimeout(() => alerta.remove(), 300);
    }, 5000);
}

window.mostrarDebugKeyAlerta = mostrarDebugKeyAlerta;

const btnAcceder = document.getElementById('btnAccederParqueadero');

if (btnAcceder) {

    btnAcceder.addEventListener('click', function () {

        const idParqueadero =
            document.getElementById('selectParqueadero').value;

        if (!idParqueadero) {
            alert('Selecciona un parqueadero');
            return;
        }

        fetch('/Home/GuardarParqueaderoSesion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idParqueadero: parseInt(idParqueadero)
            })
        })
        .then(r => r.json())
        .then(data => {

            if (data.success) {
                location.reload();
            }

        });

    });

}

/**
 * Abre el modal para despacho de vehículos
 * @param {HTMLElement} btn - El botón que abrió el modal, contiene la información del vehículo.
 */
function abrirModalDespacho(btn) {
    // Leer atributos usados en la vista
    const idIngreso = btn.getAttribute('data-id-ingreso') || btn.getAttribute('data-id');
    const placa = btn.getAttribute('data-placa') || '';
    const idValet = btn.getAttribute('data-id-valet');

    const modalElement = document.getElementById('modalDespachoKey');
    const labelPlaca = document.getElementById('modalPlacaKey');
    const inputId = document.getElementById('modalIdIngresoKey');   // hidden input name="id_ingreso"
    const selectValet = document.getElementById('modalIdValetKey'); // select name="id_valet"

    // Poner placa en la UI
    if (labelPlaca) {
        labelPlaca.textContent = placa;
    }

    // Rellenar el input oculto con el id del ingreso
    if (inputId && idIngreso) {
        inputId.value = idIngreso;
    }

    // Seleccionar el valet por defecto si viene en el atributo
    if (selectValet) {
        if (idValet) {
            // Si el valor existe en las opciones, se selecciona; si no, queda la primera opción
            const optionExists = Array.from(selectValet.options).some(o => o.value === String(idValet));
            if (optionExists) {
                selectValet.value = String(idValet);
            } else {
                selectValet.selectedIndex = 0;
            }
        } else {
            selectValet.selectedIndex = 0;
        }
    }

    // Mostrar modal
    const modal = new bootstrap.Modal(modalElement);
    modal.show();
}

window.abrirModalDespacho = abrirModalDespacho;

document.addEventListener('submit', function (event) {
    const form = event.target;

    if (!(form instanceof HTMLFormElement)) {
        return;
    }

    const action = form.getAttribute('action') || '';

    if (!action.includes('/Home/ActualizarEstadoKey')) {
        return;
    }

    if (form.dataset.debugSubmitting === 'true') {
        return;
    }

    event.preventDefault();

    const submitter = event.submitter;
    const formData = new FormData(form);

    if (submitter?.name) {
        formData.set(submitter.name, submitter.value ?? '');
    }

    const idIngreso = formData.get('id_ingreso');
    const nuevoEstado = formData.get('nuevo_estado');

    const mensajeAccion = nuevoEstado === 'parqueado'
        ? 'Parqueando...'
        : nuevoEstado === 'despachado'
            ? 'Despachando...'
            : 'Actualizando estado...';

    mostrarDebugKeyAlerta(mensajeAccion, 'info');

    form.dataset.debugSubmitting = 'true';

    if (submitter?.name) {
        const debugClone = document.createElement('input');
        debugClone.type = 'hidden';
        debugClone.name = submitter.name;
        debugClone.value = submitter.value ?? '';
        debugClone.setAttribute('data-debug-submit-clone', 'true');
        form.appendChild(debugClone);
    }

    setTimeout(() => {
        form.submit();
    }, 500);
});

// ===== ACTUALIZACIÓN DINÁMICA DE LA TABLA =====
// Cada 10 s se piden al servidor las filas ya armadas (vista parcial _FilasKey, acción FilasVistaKey),
// con los mismos filtros de la página. Así los botones salen de las mismas reglas que valida el
// servidor; antes se armaban aquí en JS con otras reglas.
let actualizacionEnProceso = false;

// Cada 10 s: suficiente para enterarse de una solicitud sin cargar de más el servidor
const INTERVALO_ACTUALIZACION = 10000;

async function actualizarTabla() {
    if (actualizacionEnProceso) return;

    // Si se está enviando un formulario (Parqueando..., Despachando...) no se cambian las filas:
    // el formulario quedaría fuera de la página y no se enviaría
    if (document.querySelector('form[data-debug-submitting="true"]')) return;

    actualizacionEnProceso = true;

    try {
        // redirect 'manual': si la sesión venció, HomeController redirige al login y esa página
        // no debe terminar dentro de la tabla (la respuesta llega con ok = false)
        const response = await fetch(`/Home/FilasVistaKey${location.search}`, { cache: 'no-store', redirect: 'manual' });

        // Sin sesión, sin turno o sin parqueadero: se dejan las filas que hay
        if (!response.ok) return;

        const html = await response.text();
        const tbody = document.querySelector('table.tabla-key tbody');
        if (!tbody) return;

        tbody.innerHTML = html;

        // Mientras haya solicitados suena y vibra en cada refresco, para que siempre estén alertas
        if (tbody.querySelector('tr.alerta-solicitado')) window.reproducirSonido?.('solicitud');

    } catch (error) {
        console.error('Error al actualizar la tabla:', error);
    } finally {
        actualizacionEnProceso = false;
    }
}

// Inicializar solo al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    setInterval(actualizarTabla, INTERVALO_ACTUALIZACION);
});

// Limpiar al cerrar la página
window.addEventListener('beforeunload', function() {
    console.log('Cerrando VistaKey');
});