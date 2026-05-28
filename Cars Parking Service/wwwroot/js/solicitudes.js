document.addEventListener('DOMContentLoaded', () => {

    console.log('Solicitudes inciado correctamente');

    // Cargamos los ingresos solicitados
    // Refrescamos solicitudes cada 3 segundos
    setInterval(() => {
        cargarSolicitudes();
        mostrarSolicitados();
    }, 60000);
    
    setInterval(() => {
        cargarEnCurso();
        mostrarEnCurso();
    }, 60000);

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
let vehiculosEnCurso = [];

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

async function cargarEnCurso() {

    const url = `/Home/ObtenerEnCurso?ts=${Date.now()}`;

    const response = await fetch(url, {
        cache: 'no-store'
    });

    if (!response.ok) {
        console.error('Error obteniendo vehículos en curso');
        return;
    }

    const data = await response.json();

    // Guardamos array global
    vehiculosEnCurso = data.vehiculos;

    // Contador visual
    const statActv = document.getElementById('statActv');
    const badgeEnCurso = document.getElementById('badge-encurso');

    if (statActv) statActv.textContent = data.cantidad;
    if (badgeEnCurso) badgeEnCurso.textContent = data.cantidad;
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

        // Creamos el html dinamicamente
        const solicitudHTML = `

            <div class="req-item">

                <div class="req-item-icon">
                    <i class="fa-solid fa-car-side"></i>
                </div>

                <div class="req-item-info">

                    <div class="req-item-title">
                        ${solicitud.placa}
                    </div>

                    <div class="req-item-sub">
                        Banco: ${solicitud.nombre_banco}
                    </div>

                    <div class="req-item-sub">
                        Valet: ${solicitud.nombre_valet}
                    </div>

                </div>

               <!--<div class="req-item-actions" display="none">

                    <button class="btn-solicitud" onclick="tomarSolicitud(${solicitud.id})" id="tomarSolicitud">
                        Tomar
                    </button>

                </div>-->
            </div>

        `;

        // Insertamos el HTML en el panel
        panelSolicitados.innerHTML += solicitudHTML;

    })
}

// Funcion para mostrar los vehiculos en curso en el html
function mostrarEnCurso() {

    const panelEnCurso = document.getElementById('panelActiveList');

    const panelEmpty = document.getElementById('panelEmptyEnCurso');

    if (!panelEnCurso || !panelEmpty) {
        console.error('Elementos panelEnCurso o panelEmptyEnCurso no encontrados');
        return;
    }

    if (vehiculosEnCurso.length == 0) {

        panelEmpty.style.display = "block"
        panelEnCurso.style.display = "none";

        return;
    }

    panelEmpty.style.display = "none";
    panelEnCurso.style.display = "block";


    panelEnCurso.innerHTML = '';

    vehiculosEnCurso.forEach(vehiculos => {

        // Creamos el html dinamicamente
        const enCursoHTML = `

            <div class="req-item">

                <div class="req-item-icon">
                    <i class="fa-solid fa-car-side"></i>
                </div>

                <div class="req-item-info">

                    <div class="req-item-title">
                        ${vehiculos.placa}
                    </div>

                    <div class="req-item-sub">
                        Banco: ${vehiculos.nombre_banco}
                    </div>

                    <div class="req-item-sub">
                        Valet: ${vehiculos.nombre_valet}
                    </div>

                </div>

            </div>

        `;

        // Insertamos el HTML en el panel
        panelEnCurso.innerHTML += enCursoHTML;

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
        cargarEnCurso();
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
    } else if (tab === 'encurso') {
        mostrarEnCurso();
    }
}