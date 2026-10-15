
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
let actualizacionEnProceso = false;

// Cada 10 s: suficiente para enterarse de una solicitud sin cargar de más el servidor
const INTERVALO_ACTUALIZACION = 10000;

/**
 * Obtiene los ingresos actualizados del servidor
 */
async function obtenerIngresosPorParqueadero() {
    try {
        const response = await fetch('/Home/ObtenerIngresosPorParqueadero');
        if (!response.ok) {
            console.error('Error al obtener ingresos:', response.status);
            return null;
        }
        const data = await response.json();
        console.log('Datos obtenidos del servidor:', data);
        return data;
    } catch (error) {
        console.error('Error en fetch:', error);
        return null;
    }
}

/**
 * Construye una fila de tabla HTML a partir de un ingreso
 */
function construirFilaTabla(ingreso) {

    const estado = ingreso.estado_servicio?.trim().toLowerCase();
    let claseAlerta = '';

    if (estado === 'solicitado') {
        claseAlerta = 'alerta-solicitado';
    }
    else if (estado === 'esperando valet' || ingreso.id_valet == null) {
        claseAlerta = 'alerta-sin-valet';
    }

    // Ahora claseBadge afuera
    const claseBadge = estado === 'solicitado' ? 'status-pendiente'
        : estado === 'esperando valet' ? 'status-esperando-valet'
            : estado === 'parqueado' ? 'status-pagado'
                : 'status-en-uso';
    
    const fechaFormato = new Date(ingreso.fecha_ingreso).toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    let botonesAccion = '';

    // Botón Marcar como Parqueado
    if (ingreso.estado_servicio !== 'parqueado' && ingreso.estado_servicio !== 'despachado') {
        botonesAccion += `
            <form method="post" action="/Home/ActualizarEstadoKey" class="d-inline actions-form">
                <input type="hidden" name="id_ingreso" value="${ingreso.id}" />
                <button type="submit" name="nuevo_estado" value="parqueado" class="btn-icon btn-icon-success" title="Marcar como Parqueado">
                    <i class="fa-solid fa-square-parking"></i>
                </button>
            </form>
        `;
    }

    // Botón Despachar
    if (ingreso.estado_servicio !== 'despachado' && ingreso.estado_servicio?.trim().toLowerCase() === 'parqueado') {
        botonesAccion += `
            <button type="button"
                    class="btn-icon btn-icon-warning"
                    title="Despachar"
                    onclick="abrirModalDespacho(this)"
                    data-id-ingreso="${ingreso.id}"
                    data-placa="${ingreso.placa}"
                    data-id-valet="${ingreso.id_valet}">
                <i class="fa-solid fa-right-from-bracket"></i>
            </button>
        `;
    }

    // Botón Ver Info
    botonesAccion += `
        <button type="button"
                class="btn-icon btn-icon-info"
                title="Ver información del vehículo"
                onclick="abrirModalInformacion(this)"
                data-id-ingreso="${ingreso.id}"
                data-sin-solicitar="true">
            <i class="fa-solid fa-circle-info"></i>
        </button>
    `;

    const html = `
        <tr class="${claseAlerta}">
            <td class="fw-bold" data-label="Placa">${ingreso.placa}</td>
            <td data-label="Estado">
                <span class="status-badge ${claseBadge}">
                    ${ingreso.estado_servicio?.toUpperCase()}
                </span>
            </td>
            <td data-label="Valet Asignado">${ingreso.nombre_valet}</td>
            <td data-label="Banco Asignado">${ingreso.nombre_banco}</td>
            <td data-label="Fecha Ingreso">${fechaFormato}</td>
            <td data-label="Acciones" class="cell-action">
                ${botonesAccion}
            </td>
        </tr>
    `;

    return html;
}

/**
 * Actualiza la tabla with los ingresos del servidor
 */
async function actualizarTabla() {
    if (actualizacionEnProceso) return;
    
    actualizacionEnProceso = true;

    try {
        const datos = await obtenerIngresosPorParqueadero();
        if (!datos || !datos.ingresos) {
            console.warn('No hay datos para actualizar');
            actualizacionEnProceso = false;
            return;
        }

        // Campana una sola vez por cada solicitud nueva de este parqueadero
        const idsSolicitados = datos.ingresos
            .filter(i => i.estado_servicio?.trim().toLowerCase() === 'solicitado')
            .map(i => i.id);
        window.sonarSiHayNuevos?.('sonido-solicitudes-key', idsSolicitados, 'solicitud');

        const tbody = document.querySelector('table tbody');
        if (!tbody) {
            console.warn('No se encontró tbody en la tabla');
            actualizacionEnProceso = false;
            return;
        }

        console.log('Cantidad de ingresos:', datos.cantidad);
        console.log('IDs de ingresos:', datos.ingresos.map(i => i.id));

        // Si no hay ingresos y antes había, mostrar mensaje vacío
        if (datos.cantidad === 0) {
            console.log('No hay ingresos, mostrando mensaje vacío');
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="padding: 30px; color:#888;">
                        No se encontraron vehículos.
                    </td>
                </tr>
            `;
        } else {
            console.log('Renderizando ' + datos.cantidad + ' filas');
            // Construir HTML de todas las filas
            const filasHTML = datos.ingresos.map(ingreso => construirFilaTabla(ingreso)).join('');
            tbody.innerHTML = filasHTML;

            // Re-asignar event listeners si es necesario
            reinicializarEventos();
        }

    } catch (error) {
        console.error('Error al actualizar tabla:', error);
    } finally {
        actualizacionEnProceso = false;
    }
}

/**
 * Reinicializa los eventos de los elementos después de actualizar la tabla
 */
function reinicializarEventos() {
    // Si hay botones de despacho, asegurarse de que tengan el evento
    document.querySelectorAll('.btn-icon-warning').forEach(btn => {
        btn.onclick = function() {
            abrirModalDespacho(this);
        };
    });

    // Si hay botones de info, asegurarse de que tengan el evento
    document.querySelectorAll('.btn-icon-info').forEach(btn => {
        btn.onclick = function () {
            abrirModalInformacion(this);
        };
    });
}

// Inicializar solo al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    setInterval(actualizarTabla, INTERVALO_ACTUALIZACION);
});

// Limpiar al cerrar la página
window.addEventListener('beforeunload', function() {
    console.log('Cerrando VistaKey');
});