// vistakey.js

/**
 * Función sencilla para mostrar algo de información del vehículo
 */
function verInfoExtra(btn) {
    const idIngreso = btn?.dataset?.idIngreso;
    const data = window.vistaKeyInfoMap?.[String(idIngreso)];

    if (!data) {
        alert('No se encontró información del vehículo.');
        return;
    }

    const modal = document.getElementById('modalInfoKey');
    const placa = document.getElementById('infoKeyPlaca');
    const cliente = document.getElementById('infoKeyCliente');
    const valet = document.getElementById('infoKeyValet');
    const ubicacion = document.getElementById('infoKeyUbicacion');
    const gallery = document.getElementById('infoKeyGallery');
    const noPhotos = document.getElementById('infoKeyNoPhotos');

    if (!modal || !placa || !cliente || !valet || !ubicacion || !gallery || !noPhotos) return;

    placa.textContent = data.placa || 'N/A';
    cliente.textContent = data.cliente || 'N/A';
    valet.textContent = data.valet || 'N/A';
    ubicacion.textContent = data.ubicacion || 'N/A';

    gallery.innerHTML = '';

    const fotos = Array.isArray(data.fotos) ? data.fotos : [];
    if (fotos.length === 0) {
        noPhotos.style.display = 'block';
    } else {
        noPhotos.style.display = 'none';

        fotos.forEach((foto, index) => {
            const item = document.createElement('div');
            item.className = 'info-key-photo-item';

            const img = document.createElement('img');
            img.src = foto;
            img.alt = `Foto ${index + 1}`;
            img.loading = 'lazy';

            item.appendChild(img);
            gallery.appendChild(item);
        });
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
}

function cerrarModalInfoKey() {
    const modal = document.getElementById('modalInfoKey');
    if (!modal) return;

    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

/**
 * Abre el modal para despacho de vehículos
 * @param {HTMLElement} btn - El botón que abrió el modal, contiene la información del vehículo.
 */
console.log("JS cargado");

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

// ===== ACTUALIZACIÓN DINÁMICA DE LA TABLA =====
let actualizacionEnProceso = false;

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
    const claseAlerta = ingreso.estado_servicio?.trim().toLowerCase() === 'solicitado' ? 'alerta-solicitado' : '';
    const claseBadge = ingreso.estado_servicio === 'solicitado' ? 'status-pendiente' 
                     : ingreso.estado_servicio === 'parqueado' ? 'status-pagado' 
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
                onclick="verInfoExtra(this)"
                data-id-ingreso="${ingreso.id}">
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
            verInfoExtra(this);
        };
    });
}

// Inicializar solo al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('VistaKey cargado - SIN auto-refresco para diagnóstico');
    console.log('La página se mantendrá estática con los datos iniciales');
    
    // NO HACER AUTO-REFRESCO POR AHORA - Deshabilitado para diagnóstico
    // setInterval(actualizarTabla, INTERVALO_ACTUALIZACION);
});

// Limpiar al cerrar la página
window.addEventListener('beforeunload', function() {
    console.log('Cerrando VistaKey');
});