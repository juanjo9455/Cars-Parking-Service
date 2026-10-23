document.addEventListener('DOMContentLoaded', () => {

    console.log('Solicitudes inciado correctamente');

    // Cargamos los ingresos solicitados
    // Refrescamos solicitudes cada 3 segundos
    setInterval(() => {
        cargarSolicitudes();
        mostrarSolicitados();
    }, 5000);
    
    setInterval(() => {
        cargarDespachados();
        mostrarDespachados();
    }, 5000);

    setInterval(() => {
        cargarEsperandoValet();
        mostrarEperandoValet();
    }, 5000);

});

// Creamos la funcion para abrir y cerrar el panel de solicitudes //

const burbuja = document.getElementById('vehiculoBubble');
const panelSolicitudes = document.getElementById('reqPanel');
let ultimaCantidadSolicitudes = 0;

function actualizarEstadoBurbuja(cantidadActual) {
    if (!burbuja) return;

    const contadorBurbuja = document.getElementById('bubbleCount');

    // Aura/palpito mientras existan solicitudes
    burbuja.classList.toggle('active', cantidadActual > 0);

    // Efecto pop cuando entra una nueva solicitud
    if (cantidadActual > ultimaCantidadSolicitudes) {
        burbuja.classList.remove('popping');
        void burbuja.offsetWidth;
        burbuja.classList.add('popping');

        if (contadorBurbuja) {
            contadorBurbuja.classList.remove('bump');
            void contadorBurbuja.offsetWidth;
            contadorBurbuja.classList.add('bump');
        }
    }

    ultimaCantidadSolicitudes = cantidadActual;
}

function abrirPanelSolicitudes() {

    if (burbuja) {

        if (panelSolicitudes) {

            panelSolicitudes.style.display = 'block';
            setInterval(mostrarSolicitados, 60000);

        } else {

            console.log("no se encontro panel de solicitudes");

        }

    } else {

        console.log("no se encontro burbuja de solicitudes");
    }

}

function cerrarPanelSolicitudes() {

    if (burbuja) {

        if (panelSolicitudes) {

            panelSolicitudes.style.display = 'none';

        } else {

            console.log("no se encontro panel de solicitudes");

        }

    } else {

        console.log("no se encontro burbuja de solicitudes");
    }

}

// Creamos array con las solicitudes
let solicitudes = [];

// Creamos array con los vehiculos en curso
let vehiculosDespachados = [];

let vehiculosEsperandoValet = [];

// Hora de la última campana de solicitados (la burbuja consulta cada 5 s, pero suena como máximo cada 10 s)
let ultimaCampana = 0;


// ============= Cargar Estados ============= //
// Creamos metodo para leer el JSON de las solicitudes de HomeController //
// Función asíncrona para consultar las solicitudes al servidor
async function cargarSolicitudes(){

    // fetch() hace una petición HTTP al método del HomeController
    // En este caso:
    // /Home/ObtenerSolicitudes
    //
    // El servidor responde un JSON con:
    // {
    //    cantidad: 5,
    //    solicitudes: [...]
    // }
    const url = `/Home/ObtenerSolicitudes?ts=${Date.now()}`;
    const response = await fetch(url, {
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });

    if (!response.ok) {
        console.error('Error consultando solicitudes:', response.status);
        return;
    }


    // Convertimos la respuesta JSON del servidor
    // en un objeto JavaScript utilizable
    //
    // response.json() transforma:
    //
    // {
    //    "cantidad": 5
    // }
    //
    // en:
    //
    // {
    //    cantidad: 5
    // }
    const ingresos = await response.json();

    // Llenamos el array global con solicitudes
    solicitudes = ingresos.solicitudes;

    // Mientras haya solicitados suena y vibra en cada refresco, para que siempre estén alertas
    // (7,5 s y no 10: si una respuesta llega tarde no se salta un turno; igual suena una consulta sí y otra no)
    if (solicitudes.length && Date.now() - ultimaCampana >= 7500) {
        ultimaCampana = Date.now();
        window.reproducirSonido?.('solicitud');
    }

    // Buscamos el elemento donde mostrar resultados
    const contadorBurbuja = document.getElementById('bubbleCount');
    const contadorPend = document.getElementById('statPend');
    const totalAcum = document.getElementById('totalAcum');
    const badgeSolicitados = document.getElementById('badge-solicitados');

    if (contadorBurbuja) contadorBurbuja.textContent = ingresos.cantidad;
    if (contadorPend) contadorPend.textContent = ingresos.cantidad;
    if (totalAcum) totalAcum.textContent = ingresos.cantidad;
    if (badgeSolicitados) badgeSolicitados.textContent = ingresos.cantidad;

    actualizarEstadoBurbuja(Number(ingresos.cantidad) || 0);

}

async function cargarDespachados() {

    const url = `/Home/ObtenerDespachados?ts=${Date.now()}`;

    const response = await fetch(url, {
        cache: 'no-store'
    });

    if (!response.ok) {
        console.error('Error obteniendo vehículos despachados');
        return;
    }

    const data = await response.json();

    // Guardamos array global
    vehiculosDespachados = data.vehiculos;

    // Contador visual
    const statActv = document.getElementById('statActv');
    const badgeDespachados = document.getElementById('badge-despachados');

    if (statActv) statActv.textContent = data.cantidad;
    if (badgeDespachados) badgeDespachados.textContent = data.cantidad;
}

async function cargarEsperandoValet() {

    const url = `/Home/ObtenerEsperandoValet?ts=${Date.now()}`;

    const response = await fetch(url, {
        cache: 'no-store'
    });

    if (!response.ok) {
        console.error('Error obteniendo vehiculos esperando valet');
        return;
    }

    const data = await response.json();

    vehiculosEsperandoValet = data.vehiculos;

    // Aviso una sola vez por cada vehículo nuevo esperando valet
    window.sonarSiHayNuevos?.('sonido-esperando-valet', vehiculosEsperandoValet.map(v => v.id), 'advertencia');

    const statDone = document.getElementById('statDone');
    const badgeEsperandoValet = document.getElementById('badge-esperando-valet');

    if (statDone) statDone.textContent = data.cantidad;
    if (badgeEsperandoValet) badgeEsperandoValet.textContent = data.cantidad;

}

// ============= Mostrar Estados ============= //

// Datos de un vehículo en la burbuja: placa, banco y valet uno al lado del otro, para aprovechar
// el ancho del panel (se acomodan en otra línea si no caben). Los textos se escapan
function filaVehiculoBurbuja(vehiculo) {
    return `
        <div class="req-item-fila">
            <span class="req-item-placa">${escaparHtml(vehiculo.placa ?? '')}</span>
            <span class="req-item-sub"><span class="req-item-etq">Banco:</span> ${escaparHtml(vehiculo.nombre_banco ?? '')}</span>
            <span class="req-item-sub"><span class="req-item-etq">Valet:</span> ${escaparHtml(vehiculo.nombre_valet ?? '')}</span>
        </div>`;
}

// Funcion para mostrar los vehiculos solicitados en el html
function mostrarSolicitados() {

    // Localizamos el contenedor donde se van a almacenar las solicitudes
    const panelSolicitados = document.getElementById("panelPendingList");

    // Localizamos el mensaeje cuando no hay ingresos solicitados
    const panelEmpty = document.getElementById("panelEmpty");

    if (!panelSolicitados || !panelEmpty) {
        console.error('Elementos panelSolicitados o panelEmpty no encontrados');
        return;
    }

    if (solicitudes.length === 0) {

        panelEmpty.style.display = "block";
        panelSolicitados.style.display = "none";

        return;
    }

    panelSolicitados.style.display = "block";
    panelEmpty.style.display = "none";

    // Limpiamos Contenedor
    panelSolicitados.innerHTML = '';

    // Recorremos las solicitudes
    solicitudes.forEach(solicitud => {

        // Al tocar un vehículo se abren sus acciones: Despachar (punto 33) y Reversar (punto 21).
        // El lugar de entrega (punto 25) se ve siempre, debajo de los datos
        const abierta = solicitud.id === solicitudAbierta;
        const despachando = solicitud.id === despachandoId;
        const confirmandoReversar = solicitud.id === reversarConfirmandoId;

        const detalle = abierta
            ? `<div class="req-item-detalle" onclick="event.stopPropagation()">
                   <button type="button" class="btn-despachar-burbuja" ${despachando ? 'disabled' : ''}
                           onclick="despacharDesdeBurbuja(${solicitud.id})">
                       <i class="fa-solid fa-right-from-bracket"></i>
                       ${despachando ? 'Despachando...' : 'Despachar (asignarme como valet de despacho)'}
                   </button>
                   <button type="button" class="btn-reversar-burbuja" ${despachando ? 'disabled' : ''}
                           ${confirmandoReversar ? 'data-confirmar="true"' : ''}
                           onclick="reversarDesdeBurbuja(${solicitud.id}, this)">
                       ${confirmandoReversar
                           ? '<i class="fa-solid fa-triangle-exclamation"></i> Toca de nuevo para reversar'
                           : '<i class="fa-solid fa-rotate-left"></i> Reversar solicitud'}
                   </button>
               </div>`
            : '';

        // Creamos el html dinamicamente (los textos se escapan: el lugar puede venir escrito a mano)
        const solicitudHTML = `

            <div class="req-item${abierta ? ' abierta' : ''}" role="button" tabindex="0"
                 onclick="alternarSolicitud(${solicitud.id})">

                <div class="req-item-info">

                    ${filaVehiculoBurbuja(solicitud)}

                    <div class="req-item-lugar">
                        <i class="fa-solid fa-location-dot"></i>
                        Entrega en: <strong>${escaparHtml(solicitud.lugar_entrega || 'Sin lugar registrado')}</strong>
                    </div>

                    ${detalle}

                </div>
            </div>

        `;

        // Insertamos el HTML en el panel
        panelSolicitados.innerHTML += solicitudHTML;

    })
}
// Vehículo de la lista de solicitados que está abierto, el que se está despachando y el que espera
// el segundo toque para reversar. Se guardan aparte porque la lista se vuelve a dibujar cada 5 s
let solicitudAbierta = null;
let despachandoId = null;
let reversarConfirmandoId = null;

// Abre o cierra el detalle de un vehículo solicitado
function alternarSolicitud(id) {
    solicitudAbierta = solicitudAbierta === id ? null : id;
    reversarConfirmandoId = null;
    mostrarSolicitados();
}

// Reversar desde la burbuja (punto 21): el primer toque pide confirmar y el segundo reversa
// (reversarSolicitud, en site.js, es la misma de Información)
function reversarDesdeBurbuja(id, boton) {
    if (reversarConfirmandoId !== id) {
        reversarConfirmandoId = id;
        mostrarSolicitados();
        return;
    }

    reversarConfirmandoId = null;
    reversarSolicitud(id, boton);
}

// Despachar desde la burbuja (puntos 25 y 33): quien despacha queda como valet de despacho.
// Se hace sin recargar la página (la burbuja también está en el ingreso de vehículos)
async function despacharDesdeBurbuja(id) {

    if (despachandoId) return;

    despachandoId = id;
    mostrarSolicitados();

    let data;

    try {
        // redirect 'manual': si la sesión venció no se sigue al login
        const respuesta = await fetch('/Home/DespacharDesdeBurbuja', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `id_ingreso=${encodeURIComponent(id)}`,
            redirect: 'manual'
        });

        data = respuesta.ok
            ? await respuesta.json()
            : { success: false, mensaje: 'No se pudo despachar. Revisa tu sesión e intenta de nuevo.' };
    } catch (error) {
        console.error('Error al despachar desde la burbuja:', error);
        data = { success: false, mensaje: 'No se pudo despachar. Revisa tu conexión e intenta de nuevo.' };
    }

    // mostrarAlertaWhatsApp es la alerta general de site.js (verde o roja, con sonido)
    mostrarAlertaWhatsApp(data.mensaje, data.success ? 'success' : 'error');

    despachandoId = null;

    if (data.success) {
        solicitudAbierta = null;
        await Promise.all([cargarSolicitudes(), cargarDespachados()]);
        mostrarDespachados();

        // La tabla de ingresos no espera su refresco de 10 s
        window.refrescarTablaIngresos?.();
    }

    mostrarSolicitados();
}

// Funcion para mostrar los vehiculos en curso en el html
function mostrarDespachados() {

    const panelDespachados = document.getElementById('panelActiveList');

    const panelEmpty = document.getElementById('panelEmptyDespachados');

    if (!panelDespachados || !panelEmpty) {
        console.error('Elementos panelDespachados o panelEmptyDespachados no encontrados');
        return;
    }

    if (vehiculosDespachados.length == 0) {

        panelEmpty.style.display = "block"
        panelDespachados.style.display = "none";

        return;
    }

    panelEmpty.style.display = "none";
    panelDespachados.style.display = "block";


    panelDespachados.innerHTML = '';

    vehiculosDespachados.forEach(vehiculos => {

        // Creamos el html dinamicamente
        const DespachadosHTML = `

            <div class="req-item">
                <div class="req-item-info">
                    ${filaVehiculoBurbuja(vehiculos)}
                </div>
            </div>

        `;

        // Insertamos el HTML en el panel
        panelDespachados.innerHTML += DespachadosHTML;

    })

}

function mostrarEperandoValet() {

    const panelEsperandoValet = document.getElementById('panelEperandoValetList');

    const panelEmpty = document.getElementById('panelEmptyEsperandoValet');

    if (!panelEsperandoValet || !panelEmpty) {
        console.error('Elementos panelEsperandoValet o panelEmpty no encontrados');
        return;
    }

    if (vehiculosEsperandoValet.length == 0) {

        panelEmpty.style.display = "block"
        panelEsperandoValet.style.display = "none";

        return;
    }

    panelEmpty.style.display = "none";
    panelEsperandoValet.style.display = "block";

    panelEsperandoValet.innerHTML = '';

    vehiculosEsperandoValet.forEach(vehiculos => {

        // Creamos el html dinamicamente
        const EsperandoValetHTML = `

            <div class="req-item">
                <div class="req-item-info">
                    ${filaVehiculoBurbuja(vehiculos)}
                </div>
            </div>

        `;

        // Insertamos el HTML en el panel
        panelEsperandoValet.innerHTML += EsperandoValetHTML;

    })

}
// Funcion para tomar la solicitud de un vehiculo
// Lo que queremos es que pase de estar en solicitud a En Curso
async function tomarSolicitud(idIngreso) {

    const btnSolicitar = document.getElementById("tomarSolicitud");

    if (btnSolicitar) {

        btnSolicitar.innerHTML = '';
        btnSolicitar.innerHTML = 'Tomar Solicitud';

    }

    const response = await fetch(`/Home/TomarSolicitud?idIngreso=${idIngreso}`,{

        method: 'post'

    });

        if (response.ok) {

        console.log('Solicitud tomada');

            cargarSolicitudes();
            cargarDespachados();
    }

}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    document.getElementById('btn-' + tab).classList.add('active');
    document.getElementById('btn-' + tab).setAttribute('aria-selected', 'true');
    document.getElementById('tab-' + tab).classList.add('active');
    
    // Renderizar contenido al cambiar pestaña
    if (tab === 'solicitados') {
        mostrarSolicitados();
    } else if (tab === 'despachados') {
        mostrarDespachados();
    }
}


// ================= solicitud para tomar vehiculo cuando no hay un valet asignado ================= //

function abrirModalTomarVehiculo(btn) {

    const modalAcciones = document.getElementById('modal-acciones');
    const id = btn.getAttribute('data-id');
    const placa = btn.getAttribute('data-placa');
    const nombre_cliente = btn.getAttribute('data-cliente');
    const id_valet = btn.getAttribute('data-id-valet');

    document.getElementById("contenido-modal-acciones").innerHTML = `
    
        <form method="post" action="/Home/actualizarValet">

            <input type="hidden" name="id_ingreso" value="${id}" />

            <input type="hidden" name="id_valet" value="${id_valet}" />

            <span class="close-btn" onclick="cerrarModalTomarVehiculo()">&times;</span>

            <h3>Confirmar Asignacion</h3>

            <div class="info-auto" style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>Placa:</strong> ${escaparHtml(placa)}</p>
                <p><strong>Cliente:</strong> ${escaparHtml(nombre_cliente)}</p>
            </div>
            <div class="alerta-confirmacion">
                <div class="alerta-warning">
                    <span class="alerta-icono">&#9888;</span>
                    <div class="alerta-texto">
                        <p class="alerta-titulo">¿Estás seguro?</p>
                        <p class="alerta-mensaje">
                            Estás a punto de tomar la solicitud del vehículo con placa
                            <strong>${escaparHtml(placa)}</strong>. Esta acción te asignará como valet responsable.
                        </p>
                    </div>
                </div>
            </div>
            <button type="submit" class="ingreso-btn" id="confirmar" onclick="tomarSolicitud()">Confirmar</button>
        </form>
    
    `;

    if (modalAcciones) { modalAcciones.style.display = "flex"; }

}

// ================= banco y admin asignan valet a un vehículo que no tiene (punto 4) ================= //
// Se abre desde el botón "Asignar valet" de la tabla o desde el modal de Información.
// Las opciones salen de <template id="plantilla-valets"> (lista ValetsDisponibles del servidor).
function abrirModalAsignarValet(btn) {

    const modalAcciones = document.getElementById('modal-acciones');
    const plantilla = document.getElementById('plantilla-valets');
    if (!plantilla) return;

    const id = btn.getAttribute('data-id');
    const placa = btn.getAttribute('data-placa') ?? '';
    const cliente = btn.getAttribute('data-cliente') ?? '';

    // Si venía del panel "Solicitar vehículo", ese modo escondería este formulario
    const contenido = document.getElementById("contenido-modal-acciones");
    contenido.classList.remove('modo-solicitud');

    contenido.innerHTML = `

        <form method="post" action="/Home/actualizarValet" onsubmit="tomarSolicitud()">

            <input type="hidden" name="id_ingreso" value="${escaparHtml(id)}" />

            <span class="close-btn" onclick="cerrarModalTomarVehiculo()">&times;</span>

            <h3>Asignar valet</h3>

            <div class="info-auto" style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                <p><strong>Placa:</strong> ${escaparHtml(placa)}</p>
                <p><strong>Cliente:</strong> ${escaparHtml(cliente || 'Sin nombre registrado')}</p>
            </div>

            <div class="form-group-modal" style="margin-bottom: 20px;">
                <label for="asignar-valet">Valet responsable</label>
                <select id="asignar-valet" name="id_valet" required style="width:100%;">
                    <option value="">Selecciona un valet</option>
                    ${plantilla.innerHTML}
                </select>
            </div>

            <button type="submit" class="ingreso-btn" id="confirmar">Asignar valet</button>
        </form>
    `;

    // El admin aparece preseleccionado: así se lo toma él mismo con un clic
    const select = document.getElementById('asignar-valet');
    if (select.querySelector(`option[value="${plantilla.dataset.usuario}"]`)) {
        select.value = plantilla.dataset.usuario;
    }

    if (modalAcciones) { modalAcciones.style.display = "flex"; }
}

function cerrarModalTomarVehiculo() {

    const modalAcciones = document.getElementById('modal-acciones');

    if (modalAcciones) { modalAcciones.style.display = "none"; }
}

function tomarSolicitud() {

    const btnConfirmar = document.getElementById('confirmar');

    if (btnConfirmar) { btnConfirmar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...'; }

}