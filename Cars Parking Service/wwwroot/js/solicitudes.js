document.addEventListener('DOMContentLoaded', () => {

    console.log('Solicitudes inciado correctamente');

    // Cargamos los ingresos solicitados
    // Refrescamos solicitudes cada 3 segundos
    setInterval(cargarSolicitudes, 1000);

});

// Creamos la funcion para abrir y cerrar el panel de solicitudes //

const burbuja = document.getElementById('vehiculoBubble');
const panelSolicitudes = document.getElementById('reqPanel');

function abrirPanelSolicitudes() {

    if (burbuja) {

        if (panelSolicitudes) {

            panelSolicitudes.style.display = 'block';
            setInterval(mostrarSolicitados, 1000);

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

    if (contadorBurbuja) contadorBurbuja.textContent = ingresos.cantidad;
    if (contadorPend) contadorPend.textContent = ingresos.cantidad;
    if (totalAcum) totalAcum.textContent = ingresos.cantidad;

}

// Funcion para mostrar los vehiculos solicitados en el html

function mostrarSolicitados() {

    // Localizamos el contenedor donde se van a almacenar las solicitudes
    const panelSolicitados = document.getElementById("panelPendingList");

    // Localizamos el mensaeje cuando no hay ingresos solicitados
    const panelEmpty = document.getElementById("panelEmpty");

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

                <div class="req-item-actions">

                    <button class="btn-solicitud" id="tomarSolicitud" onclick="tomarSolicitud(${solicitud.id})">
                        Tomar
                    </button>

                </div>

            </div>

        `;

        // Insertamos el HTML en el panel
        panelSolicitados.innerHTML += solicitudHTML;

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
    }

}