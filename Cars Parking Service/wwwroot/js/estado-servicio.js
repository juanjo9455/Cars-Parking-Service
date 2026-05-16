// Tiempo estimado de llegada en minutos (puede ser dinámico desde BD)
const TIEMPO_ESTIMADO_MINUTOS = 20;

// Variable para controlar el intervalo del contador
let intervaloContador = null;
let tiempoRestante = TIEMPO_ESTIMADO_MINUTOS * 60; // Convertir a segundos
let tiempoFinServicio = null;

// Variables para manejo de propina y totales
let propinaActual = 0;
const TARIFA_BASE = 30000;
const INCREMENTO_PROPINA = 100;

let idIngresoActual = null;
let claveTemporizador = null;


document.addEventListener("DOMContentLoaded", function () {
    console.log('📋 Inicializando Estado de Servicio...');

    // Obtener referencias a elementos del DOM
    const btnPagar = document.getElementById('btn-pagar');
    const btnConfirmarPago = document.getElementById('btn-confirmar-pago');
    const modal = document.getElementById('modal-pagar');
    const informacion1 = document.getElementById('informacion_1');
    const informacion2 = document.getElementById('informacion_2');
    const confirmacion = document.getElementById('modal-confirmacion');
    const btn_confirmacion = document.getElementById('btn-confirmacion');
    const btnSolicitar = document.getElementById('btn-solicitar');
    const tiempoEspera = document.getElementById('tiempoEspera');
    const idIngresoInput = document.getElementById('idIngreso');
    const fechaFinServicioInput = document.getElementById('fechaFinServicio');


    idIngresoActual = idIngresoInput?.value ?? null;
    claveTemporizador = idIngresoActual ? `estado-servicio-timer-${idIngresoActual}` : null;
    const fechaFinServicioServidor = fechaFinServicioInput?.value ? new Date(fechaFinServicioInput.value) : null;

    // ========== Estado inicial del contador ========== //
    inicializarTemporizadorPersistente(fechaFinServicioServidor);

    // ========== Evento: Solicitar vehículo ========== //
    if (btnSolicitar) {
        btnSolicitar.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirmacion) {
                confirmacion.style.display = 'block';
            }
        });
    }

    if (btn_confirmacion) {
        btn_confirmacion.addEventListener('click', function (e) {
            e.preventDefault();

            if (btn_confirmacion.disabled) return;
            btn_confirmacion.disabled = true;
            btn_confirmacion.textContent = '⏳ Procesando...';

            solicitarVehiculo();
        });
    }

    if (btnPagar) {
        btnPagar.addEventListener('click', function () {
            abrirModalPagar(modal, informacion1, informacion2);
        });
    }

    if (btnConfirmarPago) {
        btnConfirmarPago.addEventListener('click', function () {
            Pagar(informacion1, informacion2);
        });
    }

    // ========== Evento: Agregar Propina ==========
    const selectPropina = document.getElementById('select-propina');

    if (selectPropina) {
        selectPropina.addEventListener('change', function () {
            propinaActual = parseInt(this.value) || 0;
            actualizarPropinayTotal();
            console.log('💰 Propina seleccionada:', propinaActual);
        });
    }

    // ========== Evento: Cerrar Modal (click en overlay) - SOLO EN PANTALLA 1 ========== 
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === this && informacion1 && informacion1.style.display !== 'none') {
                cerrarModalPagar();
            }
        });
    }

    // ========== Inicialización: Esconder segunda pantalla ==========
    if (informacion2) {
        informacion2.style.display = 'none';
    }

    console.log('✅ Inicialización completada');
});


// ============================================================
// 3. GESTIÓN DE MODAL
// ============================================================

function abrirModalPagar(modal, informacion1, informacion2) {
    if (!modal) {
        console.error('❌ Modal no encontrado');
        return;
    }

    modal.classList.remove('oculto');

    if (informacion1) informacion1.style.display = 'block';
    if (informacion2) informacion2.style.display = 'none';

    console.log('✅ Modal abierto - Solicitar vehículo');
}

function cerrarModalPagar() {
    const modal = document.getElementById('modal-pagar');
    if (modal) {
        modal.classList.add('oculto');
        detenerContador();
        console.log('✅ Modal cerrado');
    }
}


// ============================================================
// 4. GESTIÓN DE MÉTODOS DE PAGO
// ============================================================

function seleccionar(button) {
    const metodosBtns = document.querySelectorAll('.metodo-btn');
    metodosBtns.forEach(btn => btn.classList.remove('activo'));
    button.classList.add('activo');
    console.log('✅ Método de pago seleccionado:', button.textContent.trim());
}

// ============================================================
// 4.5. GESTIÓN DE PROPINA
// ============================================================

function actualizarPropinayTotal() {
    const propinaElement = document.getElementById('propina-value');
    if (propinaElement) {
        propinaElement.textContent = formatearMoneda(propinaActual);
    }

    const totalNuevo = TARIFA_BASE + propinaActual;
    const totalElement = document.getElementById('total-value');
    if (totalElement) {
        totalElement.textContent = formatearMoneda(totalNuevo);
    }
}

function formatearMoneda(cantidad) {
    return '$' + cantidad.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}


// ============================================================
// 5. CONFIRMACIÓN Y PAGO
// ============================================================

function confirmarYPagar(informacion1, informacion2) {
    console.log('🔄 Confirmando pago...');

    if (informacion1) informacion1.style.display = 'block';
    if (informacion2) informacion2.style.display = 'none';

    tiempoRestante = TIEMPO_ESTIMADO_MINUTOS * 60;
    iniciarContador();

    console.log('✅ Pago confirmado - Temporizador iniciado');
}

function Pagar(informacion1, informacion2) {
    console.log('🔄 Confirmando pago...');

    if (informacion1) informacion1.style.display = 'none';
    if (informacion2) informacion2.style.display = 'block';

    console.log('✅ Cambio a pantalla 2 sin reiniciar contador');
}


// ============================================================
// 6. CONTADOR DE TIEMPO
// ============================================================

function obtenerClaveTemporizador() {
    return claveTemporizador;
}

function guardarTemporizador(finMs) {
    const clave = obtenerClaveTemporizador();
    if (!clave) return;

    localStorage.setItem(clave, JSON.stringify({ finMs }));
}

function leerTemporizador() {
    const clave = obtenerClaveTemporizador();
    if (!clave) return null;

    const valor = localStorage.getItem(clave);
    if (!valor) return null;

    try {
        const data = JSON.parse(valor);
        return typeof data.finMs === 'number' ? data : null;
    } catch {
        return null;
    }
}

function limpiarTemporizador() {
    const clave = obtenerClaveTemporizador();
    if (!clave) return;

    localStorage.removeItem(clave);
}

function mostrarTiempoEspera() {
    const tiempoEspera = document.getElementById('tiempoEspera');
    if (tiempoEspera) {
        tiempoEspera.style.display = 'block';
    }
}

function ocultarTiempoEspera() {
    const tiempoEspera = document.getElementById('tiempoEspera');
    if (tiempoEspera) {
        tiempoEspera.style.display = 'none';
    }
}

function inicializarTemporizadorPersistente(fechaFinServicioServidor) {
    if (fechaFinServicioServidor instanceof Date && !Number.isNaN(fechaFinServicioServidor.getTime())) {
        const restanteServidor = Math.ceil((fechaFinServicioServidor.getTime() - Date.now()) / 1000);
        if (restanteServidor > 0) {
            tiempoFinServicio = fechaFinServicioServidor.getTime();
            tiempoRestante = restanteServidor;
            guardarTemporizador(tiempoFinServicio);
            mostrarTiempoEspera();
            iniciarContador();
            return;
        }
    }

    const guardado = leerTemporizador();
    if (!guardado) {
        ocultarTiempoEspera();
        return;
    }

    const restante = Math.ceil((guardado.finMs - Date.now()) / 1000);
    if (restante <= 0) {
        limpiarTemporizador();
        ocultarTiempoEspera();
        return;
    }

    tiempoFinServicio = guardado.finMs;
    tiempoRestante = restante;
    mostrarTiempoEspera();
    iniciarContador();
}

function iniciarTemporizadorDesdeAhora() {
    const finMs = Date.now() + (TIEMPO_ESTIMADO_MINUTOS * 60 * 1000);
    tiempoFinServicio = finMs;
    guardarTemporizador(finMs);
    mostrarTiempoEspera();
    iniciarContador();
}

function renderizarBotonPagar() {
    let btnPagar = document.getElementById('btn-pagar');
    if (!btnPagar) {
        const contenedorVehiculo = document.querySelector('.vehiculo');
        if (!contenedorVehiculo) return;

        btnPagar = document.createElement('button');
        btnPagar.className = 'btn-pagar';
        btnPagar.id = 'btn-pagar';
        btnPagar.innerHTML = '<span>🔒</span> Pagar';
        contenedorVehiculo.appendChild(btnPagar);

        const modal = document.getElementById('modal-pagar');
        const informacion1 = document.getElementById('informacion_1');
        const informacion2 = document.getElementById('informacion_2');
        btnPagar.addEventListener('click', function () {
            abrirModalPagar(modal, informacion1, informacion2);
        });
    }

    btnPagar.style.display = 'block';
}

function solicitarVehiculo() {
    const idIngreso = document.getElementById('idIngreso')?.value;
    const btnSolicitarActual = document.getElementById('btn-solicitar');
    const btnConfirmacionActual = document.getElementById('btn-confirmacion');
    const confirmacion = document.getElementById('modal-confirmacion');

    if (btnSolicitarActual) {
        btnSolicitarActual.disabled = true;
        btnSolicitarActual.textContent = '⏳ Solicitando...';
    }

    fetch('/Payment/SolicitarVehiculo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idIngreso: parseInt(idIngreso) })
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json();
        })
        .then(data => {
            console.log('✅ Estado actualizado');

            if (confirmacion) {
                confirmacion.style.display = 'none';
            }

            if (btnSolicitarActual) {
                btnSolicitarActual.style.display = 'none';
            }

            renderizarBotonPagar();
            iniciarTemporizadorDesdeAhora();

            if (btnConfirmacionActual) {
                btnConfirmacionActual.disabled = false;
                btnConfirmacionActual.textContent = 'Aceptar';
            }
        })
        .catch(error => {
            console.error('❌ Error:', error);
            alert('Error al solicitar vehículo: ' + error.message);

            if (btnSolicitarActual) {
                btnSolicitarActual.disabled = false;
                btnSolicitarActual.textContent = '🚇 Solicitar Vehículo';
            }
            if (btnConfirmacionActual) {
                btnConfirmacionActual.disabled = false;
                btnConfirmacionActual.textContent = 'Aceptar';
            }
        });
}

/**
    * Inicia el contador de tiempo regresivo
    * Actualiza cada segundo
    */
function iniciarContador() {
    // Evitar múltiples contadores
    if (intervaloContador !== null) {
        clearInterval(intervaloContador);
        intervaloContador = null;
    }

    if (!tiempoFinServicio) {
        return;
    }

    console.log('⏱ Iniciando contador: ' + TIEMPO_ESTIMADO_MINUTOS + ' minutos');

    // Actualizar inmediatamente
    actualizarDisplayTiempo();

    // Actualizar cada segundo
    intervaloContador = setInterval(function () {
        tiempoRestante = Math.max(0, Math.ceil((tiempoFinServicio - Date.now()) / 1000));
        actualizarDisplayTiempo();

        // Si el tiempo se agota
        if (tiempoRestante <= 0) {
            detenerContador();
            limpiarTemporizador();
            handleTiempoAgotado();
        }
    }, 1000);
}

/**
    * Detiene el contador de tiempo
    */
function detenerContador() {
    if (intervaloContador !== null) {
        clearInterval(intervaloContador);
        intervaloContador = null;
        console.log('⏹ Contador detenido');
    }
}

/**
    * Actualiza la visualización del tiempo en el DOM
    */
function actualizarDisplayTiempo() {
    // Convertir segundos a minutos y segundos
    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;

    // Formato: "MM:SS"
    const tiempoFormato =
        String(minutos).padStart(2, '0') + ':' +
        String(segundos).padStart(2, '0');

    // ========== Actualizar Contador en Pantalla 1 ========== 
    const tiempoEspera = document.getElementById('tiempoEspera');
    if (tiempoEspera) {
        tiempoEspera.style.display = 'block';
    }

    const etiquetaLlegada = document.querySelector('.etiqueta-llegada');
    if (etiquetaLlegada) {
        etiquetaLlegada.innerHTML = '⏱ Tu vehículo llega en: <strong>' + tiempoFormato + '</strong>';
    }

    const etiquetaLlegadaConfirmacion = document.querySelector('.etiqueta-llegada-confirmacion');
    if (etiquetaLlegadaConfirmacion) {
        etiquetaLlegadaConfirmacion.innerHTML = '⏱ Tu vehículo llega en: <strong>' + tiempoFormato + '</strong>';
    }

    // ========== Actualizar Contador en Pantalla 2 ========== 
    const elementoConfirmacion = document.getElementById('confirmacion-minutos');
    if (elementoConfirmacion) {
        elementoConfirmacion.textContent = minutos;
    }

    // ========== Actualizar Contador en Pantalla 2 (Timer Display) ========== 
    const timers = document.querySelectorAll('.timer-display');

    timers.forEach(timer => {
        timer.textContent = tiempoFormato;
    });
    // ========== Actualizar Barra de Progreso (Pantalla 1) ========== 
    const barraFill = document.querySelector('.barra-fill');
    if (barraFill) {
        const tiempoTotal = TIEMPO_ESTIMADO_MINUTOS * 60;
        const tiempoTranscurrido = tiempoTotal - tiempoRestante;
        const porcentajeCompleto = (tiempoTranscurrido / tiempoTotal) * 100;
        barraFill.style.width = porcentajeCompleto + '%';
    }

    // ========== Actualizar Barra de Progreso (Pantalla 2) ========== 
    const barraFillConfirmacion = document.querySelector('.barra-fill-confirmacion');
    if (barraFillConfirmacion) {
        const tiempoTotal = TIEMPO_ESTIMADO_MINUTOS * 60;
        const tiempoTranscurrido = tiempoTotal - tiempoRestante;
        const porcentajeCompleto = (tiempoTranscurrido / tiempoTotal) * 100;
        barraFillConfirmacion.style.width = porcentajeCompleto + '%';
    }

    console.log(`⏱ Tiempo restante: ${tiempoFormato}`);
}

/**
    * Maneja cuando el tiempo se agota
    */
function handleTiempoAgotado() {
    console.log('⚠️ ¡Tiempo agotado!');

    alert('⚠️ El vehículo ha llegado. Por favor, dirígete al punto de entrega.');
}
