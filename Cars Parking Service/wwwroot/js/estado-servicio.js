// Tiempo estimado de llegada en minutos (puede ser dinámico desde BD)
const TIEMPO_ESTIMADO_MINUTOS = 8;

// Variable para controlar el intervalo del contador
let intervaloContador = null;
let tiempoRestante = TIEMPO_ESTIMADO_MINUTOS * 60; // Convertir a segundos

// Variables para manejo de propina y totales
let propinaActual = 0;
const TARIFA_BASE = 30000;
const INCREMENTO_PROPINA = 100;


document.addEventListener("DOMContentLoaded", function () {
    console.log('📋 Inicializando Estado de Servicio...');

    // Obtener referencias a elementos del DOM
    const btnPagar = document.getElementById('btn-pagar');
    const btnConfirmarPago = document.getElementById('btn-confirmar-pago')
    const Propina = document.getElementById('propina');
    const modal = document.getElementById('modal-pagar');
    const informacion1 = document.getElementById('informacion_1');
    const informacion2 = document.getElementById('informacion_2');
    const confirmacion = document.getElementById('modal-confirmacion');
    const btn_confirmacion = document.getElementById('btn-confirmacion');
    const btnSolicitar = document.getElementById('btn-solicitar');


    // ========== Evento: Confirmar Solicitud ========== //

    if (btnSolicitar) {

        btnSolicitar.addEventListener('click', function () {
            confirmacion.style.display = "block";
        });

    }

    if (btn_confirmacion) {

        btn_confirmacion.addEventListener('click', function () {
            confirmacion.style.display = 'none';
            btnSolicitar.style.display = 'none';
            btnPagar.style.display = 'block';

        });

    }

    if (btnPagar) {

        btnPagar.addEventListener('click', function () {
            abrirModalPagar(modal, informacion1, informacion2);
        });

    }

    // Verificar si el vehiculo se encuentra o no ya solicitado

    if (btnSolicitar) {
        btnSolicitar.addEventListener('click', function (e) {
            e.preventDefault(); // 🚫 evita recarga

            if (btnSolicitar.disabled) return; // evita doble click

            btnSolicitar.disabled = true;
            btnSolicitar.textContent = "⏳ Procesando...";

            solicitarVehiculo();
        });
    }

    function solicitarVehiculo() {
        const idIngreso = document.getElementById('idIngreso').value;
        const btnSolicitar = document.getElementById('btn-solicitar'); 

        if (btnSolicitar) {
            btnSolicitar.disabled = true;
            btnSolicitar.textContent = "⏳ Solicitando...";
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

            // ✅ Ocultar btn-solicitar
            if (btnSolicitar) btnSolicitar.style.display = 'none';

            // ✅ Crear el btn-pagar dinámicamente si no existe
            let btnPagar = document.getElementById('btn-pagar');
            if (!btnPagar) {
                btnPagar = document.createElement('button');
                btnPagar.id = 'btn-pagar';
                btnPagar.className = 'btn-pagar';
                btnPagar.innerHTML = '<span>🔒</span> Pagar';
                btnSolicitar.parentNode.appendChild(btnPagar);
            } else {
                btnPagar.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('❌ Error:', error);
            alert('Error al solicitar vehículo: ' + error.message);

            // ✅ btnSolicitar ahora sí existe en este scope
            if (btnSolicitar) {
                btnSolicitar.disabled = false;
                btnSolicitar.textContent = "🚗 Solicitar Vehículo";
            }
        });
    }

    // ========== Evento: Confirmar y Pagar ==========
    if (btnPagar) {
        btnPagar.addEventListener('click', function () {
            confirmarYPagar(informacion1, informacion2);
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
            // Solo cerrar si hace click directamente en el modal (fondo oscuro)
            // Y solo si estamos en la primera pantalla (informacion_1 visible)
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

/**
    * Abre el modal y muestra la primera pantalla (información de pago)
    * @param {HTMLElement} modal - Elemento del modal
    * @param {HTMLElement} informacion1 - Primera pantalla
    * @param {HTMLElement} informacion2 - Segunda pantalla
    */
function abrirModalPagar(modal, informacion1, informacion2) {
    if (!modal) {
        console.error('❌ Modal no encontrado');
        return;
    }

    // Mostrar modal
    modal.classList.remove('oculto');

    // Mostrar primera pantalla (información de pago)
    if (informacion1) informacion1.style.display = 'block';
    if (informacion2) informacion2.style.display = 'none';

    // ⚠️ NO iniciamos contador aquí - se inicia en confirmarYPagar()

    console.log('✅ Modal abierto - Solicitar vehículo');
}

/**
    * Cierra el modal y detiene el contador
    */
function cerrarModalPagar() {
    const modal = document.getElementById('modal-pagar');
    if (modal) {
        modal.classList.add('oculto');
        detenerContador(); // Detener el contador al cerrar
        console.log('✅ Modal cerrado');
    }
}


// ============================================================
// 4. GESTIÓN DE MÉTODOS DE PAGO
// ============================================================

/**
    * Selecciona un método de pago
    * @param {HTMLElement} button - Botón del método de pago seleccionado
    */
function seleccionar(button) {
    const metodosBtns = document.querySelectorAll('.metodo-btn');

    // Remover clase activo de todos los botones
    metodosBtns.forEach(btn => btn.classList.remove('activo'));

    // Agregar clase activo al botón clickeado
    button.classList.add('activo');

    console.log('✅ Método de pago seleccionado:', button.textContent.trim());
}

// ============================================================
// 4.5. GESTIÓN DE PROPINA
// ============================================================

/**
    * Actualiza la visualización de propina y total
    */
function actualizarPropinayTotal() {
    // Actualizar propina en el DOM
    const propinaElement = document.getElementById('propina-value');
    if (propinaElement) {
        propinaElement.textContent = formatearMoneda(propinaActual);
    }

    // Calcular y actualizar total
    const totalNuevo = TARIFA_BASE + propinaActual;
    const totalElement = document.getElementById('total-value');
    if (totalElement) {
        totalElement.textContent = formatearMoneda(totalNuevo);
    }
}

/**
    * Formatea un número como moneda colombiana
    * @param {number} cantidad - Cantidad a formatear
    * @returns {string} Cantidad formateada como $X.XXX
    */
function formatearMoneda(cantidad) {
    return '$' + cantidad.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}


// ============================================================
// 5. CONFIRMACIÓN Y PAGO
// ============================================================

/**
    * Confirma el pago y cambia a la pantalla de confirmación
    * INICIA EL TEMPORIZADOR AQUÍ
    * @param {HTMLElement} informacion1 - Primera pantalla
    * @param {HTMLElement} informacion2 - Segunda pantalla
    */
function confirmarYPagar(informacion1, informacion2) {
    console.log('🔄 Confirmando pago...');

    // Cambiar a pantalla de confirmación
    if (informacion1) informacion1.style.display = 'block';
    if (informacion2) informacion2.style.display = 'none';

    // ✅ INICIAR TEMPORIZADOR AL CONFIRMAR PAGO
    tiempoRestante = TIEMPO_ESTIMADO_MINUTOS * 60;
    iniciarContador();

    console.log('✅ Pago confirmado - Temporizador iniciado');
}

function Pagar(informacion1, informacion2) {
    console.log('🔄 Confirmando pago...');

    if (informacion1) informacion1.style.display = 'none';
    if (informacion2) informacion2.style.display = 'block';

    // 🚫 NO reiniciar contador aquí
    console.log('✅ Cambio a pantalla 2 sin reiniciar contador');
}


// ============================================================
// 6. CONTADOR DE TIEMPO
// ============================================================

/**
    * Inicia el contador de tiempo regresivo
    * Actualiza cada segundo
    */
function iniciarContador() {
    // Evitar múltiples contadores
    if (intervaloContador !== null) {
        console.warn('⚠️ Contador ya está activo');
        return;
    }

    console.log('⏱ Iniciando contador: ' + TIEMPO_ESTIMADO_MINUTOS + ' minutos');

    // Actualizar inmediatamente
    actualizarDisplayTiempo();

    // Actualizar cada segundo
    intervaloContador = setInterval(function () {
        tiempoRestante--;

        // Actualizar display
        actualizarDisplayTiempo();

        // Si el tiempo se agota
        if (tiempoRestante <= 0) {
            detenerContador();
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
    const etiquetaLlegada = document.querySelector('.etiqueta-llegada');
    if (etiquetaLlegada) {
        etiquetaLlegada.innerHTML = '⏱ Tu vehículo llega en: <strong>' + tiempoFormato + '</strong>';
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
        // Calcular porcentaje completado (0% al inicio, 100% al final)
        const tiempoTotal = TIEMPO_ESTIMADO_MINUTOS * 60;
        const tiempoTranscurrido = tiempoTotal - tiempoRestante;
        const porcentajeCompleto = (tiempoTranscurrido / tiempoTotal) * 100;

        // Actualizar el ancho de la barra
        barraFill.style.width = porcentajeCompleto + '%';
    }

    // ========== Actualizar Barra de Progreso (Pantalla 2) ==========
    const barraFillConfirmacion = document.querySelector('.barra-fill-confirmacion');
    if (barraFillConfirmacion) {
        // Calcular porcentaje completado (0% al inicio, 100% al final)
        const tiempoTotal = TIEMPO_ESTIMADO_MINUTOS * 60;
        const tiempoTranscurrido = tiempoTotal - tiempoRestante;
        const porcentajeCompleto = (tiempoTranscurrido / tiempoTotal) * 100;

        // Actualizar el ancho de la barra
        barraFillConfirmacion.style.width = porcentajeCompleto + '%';
    }

    console.log(`⏱ Tiempo restante: ${tiempoFormato}`);
}

/**
    * Maneja cuando el tiempo se agota
    */
function handleTiempoAgotado() {
    console.log('⚠️ ¡Tiempo agotado!');

    // Aquí puedes agregar lógica adicional
    // Por ejemplo: notificar al usuario, cambiar estado, etc.

    alert('⚠️ El vehículo ha llegado. Por favor, dirígete al punto de entrega.');
}
