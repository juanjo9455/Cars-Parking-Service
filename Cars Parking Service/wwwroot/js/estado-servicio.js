// ============================================================
// VARIABLES GLOBALES
// ============================================================

const TIEMPO_ESTIMADO_MINUTOS = 20;

let intervaloContador = null;
let tiempoRestante = TIEMPO_ESTIMADO_MINUTOS * 60;
let tiempoFinServicio = null;

let propinaActual = 0;
let tarifaActual = 0;

let idIngresoActual = null;
let claveTemporizador = null;

let intervaloCodigo = null;
let estadoActual = null; // ← guarda el estado global para bloquear cierre

// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

    console.log('📋 Inicializando Estado de Servicio...');

    const idIngreso = document.getElementById('idIngreso')?.value;
    const modal = document.getElementById('modal-pagar');

    // ── Recuperar estado real desde BD al cargar/recargar ──
    if (idIngreso) {

        fetch(`/Payment/ObtenerEstadoIngreso?id=${idIngreso}`)
            .then(res => res.json())
            .then(data => {

                if (!data.success) return;

                console.log("📦 Estado BD:", data.estadoPago);

                estadoActual = data.estadoPago;

                if (data.estadoPago === "solicitado") {

                    // 1. Abrir el modal (quitar clase oculto)
                    if (modal) modal.classList.remove('oculto');

                    // 2. Mostrar pantalla 2 dentro del modal
                    mostrarInformacion2(data.codigo);

                    // 3. Restaurar el temporizador desde el servidor
                    if (data.fechaFinServicio) {
                        inicializarTemporizadorPersistente(data.fechaFinServicio);
                    } else {
                        // Fallback: intentar desde localStorage
                        const guardado = leerTemporizador();
                        if (guardado) {
                            const restante = Math.ceil((guardado.finMs - Date.now()) / 1000);
                            if (restante > 0) {
                                tiempoFinServicio = guardado.finMs;
                                tiempoRestante = restante;
                                mostrarTiempoEspera();
                                iniciarContador();
                            }
                        }
                    }

                    // 4. Iniciar verificación de código de seguridad
                    iniciarVerificacionCodigo();

                    // 5. Bloquear botón cerrar del modal
                    bloquearCierreModal();

                } else {
                    mostrarInformacion1();
                }
            })
            .catch(err => console.error("❌ Error cargando estado:", err));
    }

    // ── Botón Solicitar Vehículo ──
    const btnSolicitar = document.getElementById('btn-solicitar');
    const btn_confirmacion = document.getElementById('btn-confirmacion');
    const confirmacion = document.getElementById('modal-confirmacion');

    if (btnSolicitar) {
        btnSolicitar.addEventListener('click', function (e) {
            e.preventDefault();
            if (confirmacion) confirmacion.style.display = 'block';
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

    // ── Botón Pagar ──
    const btnPagar = document.getElementById('btn-pagar');
    if (btnPagar) {
        btnPagar.addEventListener('click', function () {
            obtenerYestablecerTarifa();
            abrirModalPagar(modal,
                document.getElementById('informacion_1'),
                document.getElementById('informacion_2'));
        });
    }

    // ── Confirmar pago ──
    const btnConfirmarPago = document.getElementById('btn-confirmar-pago');
    if (btnConfirmarPago) {
        btnConfirmarPago.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            Pagar(document.getElementById('informacion_1'),
                document.getElementById('informacion_2'));
        });
    }

    // ── Propina ──
    const selectPropina = document.getElementById('select-propina');
    if (selectPropina) {
        selectPropina.addEventListener('change', actualizarPropinayTotal);
        actualizarPropinayTotal();
    }

    // ── Evitar cierre del modal haciendo click fuera si está en "solicitado" ──
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (estadoActual === 'solicitado' && e.target === modal) {
                e.stopPropagation();
            }
        });
    }

    console.log('✅ Inicialización completada');
});

// ============================================================
// BLOQUEAR CIERRE DEL MODAL (pantalla de confirmación final)
// ============================================================

function bloquearCierreModal() {
    // Ocultar el botón X del modal-pagar
    const btnCerrar = document.querySelector('#modal-pagar .btn-cerrar-modal');
    if (btnCerrar) btnCerrar.style.display = 'none';

    // Deshabilitar la función cerrarModalPagar
    estadoActual = 'solicitado';

    console.log('🔒 Modal bloqueado — no se puede cerrar');
}

// ============================================================
// MOSTRAR / OCULTAR PANTALLAS INTERNAS DEL MODAL
// ============================================================

function mostrarInformacion1() {
    const i1 = document.getElementById('informacion_1');
    const i2 = document.getElementById('informacion_2');
    if (i1) i1.style.display = 'block';
    if (i2) i2.style.display = 'none';
}

function mostrarInformacion2(codigo) {
    const i1 = document.getElementById('informacion_1');
    const i2 = document.getElementById('informacion_2');
    if (i1) i1.style.display = 'none';
    if (i2) i2.style.display = 'block';

    const codigoValor = document.getElementById('codigo-valor');
    if (codigoValor && codigo) codigoValor.textContent = codigo;
}

// ============================================================
// ABRIR / CERRAR MODAL PAGAR
// ============================================================

function abrirModalPagar(modal, informacion1, informacion2) {
    if (!modal) return;
    modal.classList.remove('oculto');
    if (informacion1) informacion1.style.display = 'block';
    if (informacion2) informacion2.style.display = 'none';
}

function cerrarModalPagar() {
    // Si está en estado solicitado NO se puede cerrar
    if (estadoActual === 'solicitado') {
        console.warn('🔒 Modal bloqueado — pago en proceso');
        return;
    }
    const modal = document.getElementById('modal-pagar');
    if (modal) modal.classList.add('oculto');
}

// ============================================================
// SELECCIONAR MÉTODO DE PAGO
// ============================================================

function seleccionar(button) {
    event.preventDefault();
    document.querySelectorAll('.metodo-btn').forEach(btn => btn.classList.remove('activo'));
    button.classList.add('activo');
}

// ============================================================
// TARIFA Y PROPINA
// ============================================================

function obtenerYestablecerTarifa() {
    const tarifaInput = document.getElementById('tarifaValor');
    tarifaActual = parseFloat(tarifaInput?.value || 0);
    actualizarPropinayTotal();
}

function actualizarPropinayTotal() {
    const tarifaInput = document.getElementById('tarifaValor');
    const selectPropina = document.getElementById('select-propina');
    tarifaActual = parseInt(tarifaInput?.value || 0);
    propinaActual = parseInt(selectPropina?.value || 0);
    const total = tarifaActual + propinaActual;
    const totalEl = document.getElementById('total-value');
    if (totalEl) totalEl.textContent = formatearMoneda(total);
}

function formatearMoneda(cantidad) {
    return '$' + cantidad.toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

// ============================================================
// SOLICITAR VEHÍCULO
// ============================================================

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idIngreso: parseInt(idIngreso) })
    })
        .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
        .then(data => {
            console.log('✅ Vehículo solicitado');
            if (confirmacion) confirmacion.style.display = 'none';
            if (btnSolicitarActual) btnSolicitarActual.style.display = 'none';
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
                btnSolicitarActual.textContent = '🚗 Solicitar Vehículo';
            }
            if (btnConfirmacionActual) {
                btnConfirmacionActual.disabled = false;
                btnConfirmacionActual.textContent = 'Aceptar';
            }
        });
}

// ============================================================
// PAGAR
// ============================================================

function Pagar(informacion1, informacion2) {
    const idIngreso = document.getElementById('idIngreso')?.value;
    const propina = parseInt(document.getElementById('select-propina')?.value || '0');
    const total = tarifaActual + propina;
    const metodoSeleccionado = document.querySelector('.metodo-btn.activo');
    const metodoPago = metodoSeleccionado?.innerText?.trim().split('\n').pop().trim() || 'Efectivo';

    if (!idIngreso) { alert('Error: No se pudo obtener el ID del ingreso'); return; }

    fetch('/Payment/GuardarPago', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: new URLSearchParams({
            idIngreso: idIngreso,
            tarifa: tarifaActual,
            propina: propina,
            metodoPago: metodoPago
        })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log('✅ Pago guardado');

                estadoActual = 'solicitado'; // ← bloquear cierre desde este momento

                // Sincronizar método y total en pantalla 2
                const ico = metodoSeleccionado?.querySelector('.ico')?.innerHTML ?? '💵';
                const iconoEl = document.getElementById('confirmacion-metodo-icono');
                const textoEl = document.getElementById('confirmacion-metodo-texto');
                const totalEl = document.getElementById('confirmacion-total');
                if (iconoEl) iconoEl.innerHTML = ico;
                if (textoEl) textoEl.innerText = metodoPago;
                if (totalEl) totalEl.innerText = formatearMoneda(total);

                // Cambiar a pantalla 2
                const i1 = informacion1 || document.getElementById('informacion_1');
                const i2 = informacion2 || document.getElementById('informacion_2');
                if (i1) i1.style.display = 'none';
                if (i2) i2.style.display = 'block';

                // Ocultar el botón X del modal
                bloquearCierreModal();

                // Iniciar verificación de código
                iniciarVerificacionCodigo();

            } else {
                alert('Error al guardar pago: ' + data.message);
            }
        })
        .catch(error => {
            console.error('❌ Error en fetch:', error);
            alert('Error de conexión al guardar pago');
        });
}

// ============================================================
// TEMPORIZADOR
// ============================================================

function obtenerClaveTemporizador() {
    const idIngreso = document.getElementById('idIngreso')?.value;
    return idIngreso ? `timer_ingreso_${idIngreso}` : null;
}

function guardarTemporizador(finMs) {
    const clave = obtenerClaveTemporizador();
    if (clave) localStorage.setItem(clave, JSON.stringify({ finMs }));
}

function leerTemporizador() {
    const clave = obtenerClaveTemporizador();
    if (!clave) return null;
    try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
}

function limpiarTemporizador() {
    const clave = obtenerClaveTemporizador();
    if (clave) localStorage.removeItem(clave);
}

function mostrarTiempoEspera() {
    const el = document.getElementById('tiempoEspera');
    if (el) el.style.display = 'block';
}

function ocultarTiempoEspera() {
    const el = document.getElementById('tiempoEspera');
    if (el) el.style.display = 'none';
}

function inicializarTemporizadorPersistente(fechaFinServicioServidor) {
    const fechaFin = new Date(fechaFinServicioServidor);
    if (!isNaN(fechaFin.getTime())) {
        const restante = Math.ceil((fechaFin.getTime() - Date.now()) / 1000);
        if (restante > 0) {
            tiempoFinServicio = fechaFin.getTime();
            tiempoRestante = restante;
            guardarTemporizador(tiempoFinServicio);
            mostrarTiempoEspera();
            iniciarContador();
            return;
        }
    }
    // Fallback localStorage
    const guardado = leerTemporizador();
    if (!guardado) { ocultarTiempoEspera(); return; }
    const restante = Math.ceil((guardado.finMs - Date.now()) / 1000);
    if (restante <= 0) { limpiarTemporizador(); ocultarTiempoEspera(); return; }
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

function iniciarContador() {
    if (intervaloContador !== null) { clearInterval(intervaloContador); intervaloContador = null; }
    if (!tiempoFinServicio) return;
    actualizarDisplayTiempo();
    intervaloContador = setInterval(function () {
        tiempoRestante = Math.max(0, Math.ceil((tiempoFinServicio - Date.now()) / 1000));
        actualizarDisplayTiempo();
        if (tiempoRestante <= 0) {
            detenerContador();
            limpiarTemporizador();
            handleTiempoAgotado();
        }
    }, 1000);
}

function detenerContador() {
    if (intervaloContador !== null) { clearInterval(intervaloContador); intervaloContador = null; }
}

function actualizarDisplayTiempo() {
    const minutos = Math.floor(tiempoRestante / 60);
    const segundos = tiempoRestante % 60;
    const tiempoFormato = String(minutos).padStart(2, '0') + ':' + String(segundos).padStart(2, '0');

    const tiempoEspera = document.getElementById('tiempoEspera');
    if (tiempoEspera) tiempoEspera.style.display = 'block';

    document.querySelectorAll('.etiqueta-llegada-confirmacion, .etiqueta-llegada').forEach(el => {
        el.innerHTML = '⏱ Tu vehículo llega en: <strong>' + tiempoFormato + '</strong>';
    });

    document.querySelectorAll('.timer-display').forEach(el => { el.textContent = tiempoFormato; });

    const tiempoTotal = TIEMPO_ESTIMADO_MINUTOS * 60;
    const porcentaje = ((tiempoTotal - tiempoRestante) / tiempoTotal) * 100;
    document.querySelectorAll('.barra-fill, .barra-fill-confirmacion').forEach(el => {
        el.style.width = porcentaje + '%';
    });
}

function handleTiempoAgotado() {
    alert('⚠️ El vehículo ha llegado. Por favor, dirígete al punto de entrega.');
}

// ============================================================
// CÓDIGO DE SEGURIDAD
// ============================================================

/*function iniciarVerificacionCodigo() {
    if (intervaloCodigo !== null) clearInterval(intervaloCodigo);
    intervaloCodigo = setInterval(() => {
        const idIngreso = document.getElementById('idIngreso')?.value;
        if (!idIngreso) return;
        fetch(`/Payment/VerificarCodigoSeguridad?id=${idIngreso}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.tieneCodigo) {
                    clearInterval(intervaloCodigo);
                    mostrarCodigoSeguridad(data.codigo);
                }
            })
            .catch(err => console.error('❌ Error verificando código:', err));
    }, 3000);
}

function mostrarCodigoSeguridad(codigo) {
    const contenedor = document.getElementById('codigo-generado');
    const valor = document.getElementById('codigo-valor');
    if (contenedor) contenedor.style.display = 'block';
    if (valor) valor.textContent = codigo;
}*/

// ============================================================
// BOTÓN PAGAR DINÁMICO
// ============================================================

function renderizarBotonPagar() {
    let btnPagar = document.getElementById('btn-pagar');
    if (!btnPagar) {
        const contenedor = document.querySelector('.vehiculo');
        if (!contenedor) return;
        btnPagar = document.createElement('button');
        btnPagar.className = 'btn-pagar';
        btnPagar.id = 'btn-pagar';
        btnPagar.innerHTML = '<span>🔒</span> Solicitar Pago';
        contenedor.appendChild(btnPagar);
        btnPagar.addEventListener('click', function () {
            obtenerYestablecerTarifa();
            abrirModalPagar(
                document.getElementById('modal-pagar'),
                document.getElementById('informacion_1'),
                document.getElementById('informacion_2')
            );
        });
    }
    btnPagar.style.display = 'block';
}