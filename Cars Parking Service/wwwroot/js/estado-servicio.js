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

// Lugar de entrega elegido en el primer paso: se envía al confirmar la solicitud, junto con el pago
let lugarEntregaSolicitud = '';

// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", function () {

    console.log('📋 Inicializando Estado de Servicio...');

    const idIngreso = document.getElementById('idIngreso')?.value;
    const modal = document.getElementById('modal-pagar');

    // ── Recuperar estado real desde BD al cargar/recargar ──
    if (idIngreso) {

        fetch(`/Payment/ObtenerEstadoIngreso?id=${idIngreso}&_=${Date.now()}`, {
            cache: 'no-store'
        })
            .then(res => res.json())
            .then(data => {

                console.log("Respuesta completa:", data);

                if (!data.success) return;

                console.log("id ingreso:", idIngreso)
                console.log("id ingreso consulta:", data.idConsulta)
                console.log("Estado servicio:", data.estadoServicio);
                console.log("Estado pago:", data.estadoPago);
                console.log("Fecha fin:", data.fechaFinServicio);

                console.log("📦 Estado BD:", data.estadoPago);

                if (data.lugarEntrega) {

                    const LugarLI = document.getElementById('lugar_entrega');
                    const LugarLabel = document.getElementById('lugar_entrega_label');

                    if (LugarLI && LugarLabel) {

                        LugarLI.style.display = "block";

                        // El lugar puede venir escrito a mano por el operador ("Otra ubicación"):
                        // se pone como texto para que no se interprete como HTML
                        LugarLabel.innerHTML = '<strong>📍 Punto de entrega:</strong> ';
                        LugarLabel.append(data.lugarEntrega);

                    }

                }

                if (data.estadoServicio === "solicitado") {

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

                }

                // Ya pidió con su pago: la espera (no cerrar, valor, método y código) se ve en la página
                if (data.estadoPago === "solicitado") {
                    mostrarPanelEspera();
                    mostrarCodigoSeguridad(data.codigo);
                    iniciarVerificacionCodigo();
                }
            })
            .catch(err => console.error("❌ Error cargando estado:", err));
    }

const btnSolicitar = document.getElementById('btn-solicitar');

if (btnSolicitar) {

    btnSolicitar.addEventListener('click', function (e) {
        e.preventDefault();

        // 1. Obtener las referencias del modal PRIMERO
        const confirmacion = document.getElementById('modal-confirmacion');
        const contenidoConfirmacion = document.getElementById('confirmacion');

        // 2. Mostrar el modal si existe
        if (confirmacion) {
            confirmacion.style.display = 'block';
        }

        // 3. Renderizar la vista de selección de ubicación
        if (contenidoConfirmacion) {

            contenidoConfirmacion.innerHTML = `
                <h2 class="confirmacion-titulo">
                    ¡Ubicación De Entrega!
                </h2>

                <p class="confirmacion-sub">
                    Por favor selecciona en qué lugar deseas recibir el vehículo.
                    <br>
                    Llevaremos el vehículo a esta ubicación.
                </p>

                <select id="lugar-entrega" name="lugar" style="width:100%;">
                    <option value="">Cargando ubicaciones...</option>
                </select>

                <input type="text" id="lugar-entrega-otra" class="lugar-entrega-otra" maxlength="50"
                       placeholder="Escribe dónde quieres recibirlo" hidden />

                <p class="lugar-entrega-error" id="lugar-entrega-error" hidden></p>

                <button type="button" class="btn-confirmacion btn-pagar" id="btn-confirmacion-lugar">
                    Aceptar
                </button>
            `;

            // Con "Otra ubicación…" aparece el campo para escribir el lugar (igual que para los operadores)
            const selectLugar = document.getElementById('lugar-entrega');
            const campoOtra = document.getElementById('lugar-entrega-otra');
            const avisoLugar = document.getElementById('lugar-entrega-error');

            selectLugar.addEventListener('change', function () {
                campoOtra.hidden = selectLugar.value !== OTRA_UBICACION;
                avisoLugar.hidden = true;
                if (!campoOtra.hidden) campoOtra.focus();
            });

            campoOtra.addEventListener('input', () => { avisoLugar.hidden = true; });

            const btnConfirmacionLugar = document.getElementById('btn-confirmacion-lugar');

            if (btnConfirmacionLugar) {
                btnConfirmacionLugar.addEventListener('click', function (e) {
                    e.preventDefault();

                    const lugarEntrega = lugarEntregaElegido();

                    if (!lugarEntrega) {
                        avisoLugar.textContent = selectLugar.value === OTRA_UBICACION
                            ? 'Escribe el lugar donde quieres recibir el vehículo.'
                            : 'Selecciona en qué lugar quieres recibir el vehículo.';
                        avisoLugar.hidden = false;
                        window.reproducirSonido?.('error');
                        return;
                    }

                    // Todavía no se pide: sigue el pago (propina y método) y ahí se confirma la solicitud
                    lugarEntregaSolicitud = lugarEntrega;
                    abrirPagoDeSolicitud();
                });
            }
        }

        // 4. Cargar las ubicaciones activas desde la BD (evitando caché en móviles)
        // Solo las de la zona del carro
        const idIngresoCarro = document.getElementById('idIngreso')?.value || '';
        fetch(`/Payment/ObtenerUbicaciones?idIngreso=${encodeURIComponent(idIngresoCarro)}&_=${Date.now()}`, { cache: 'no-store' })
            .then(response => response.json())
            .then(data => {

                if (!data.success) {
                    alert(data.message);
                    return;
                }

                const select = document.getElementById('lugar-entrega');
                if (!select) return;

                select.innerHTML = '<option value="">Selecciona una ubicación</option>';

                const fragment = document.createDocumentFragment();
                data.data.forEach(u => {
                    const option = document.createElement('option');
                    option.value = u.nombre;
                    option.textContent = u.nombre;
                    fragment.appendChild(option);
                });

                // Al final, la opción para escribir un lugar que no está en la lista
                // (OTRA_UBICACION viene de site.js, la misma de los operadores)
                const otra = document.createElement('option');
                otra.value = OTRA_UBICACION;
                otra.textContent = 'Otra ubicación…';
                fragment.appendChild(otra);

                select.appendChild(fragment);

            })
            .catch(error => {
                console.error(error);
                alert('Error cargando las ubicaciones');
            });

    });

}

    // ── "Solicitar vehículo" de la ventana de pago: primero pregunta si está seguro ──
    const btnConfirmarPago = document.getElementById('btn-confirmar-pago');
    if (btnConfirmarPago) {
        btnConfirmarPago.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            mostrarAdvertenciaSolicitud();
        });
    }

    // ── Propina ──
    const selectPropina = document.getElementById('select-propina');
    if (selectPropina) {
        selectPropina.addEventListener('change', actualizarPropinayTotal);
        actualizarPropinayTotal();
    }

    // ── Tocar afuera de la ventana de pago la cierra (todavía no se ha pedido nada) ──
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === modal) cerrarModalPagar();
        });
    }

    console.log('✅ Inicialización completada');
});

// ============================================================
// PANEL DE ESPERA (en la página, después de solicitar)
// ============================================================

function mostrarPanelEspera() {
    const panel = document.getElementById('panel-espera');
    if (panel) panel.style.display = 'flex';
}

// ============================================================
// ABRIR / CERRAR MODAL PAGAR
// ============================================================

function abrirModalPagar() {
    const modal = document.getElementById('modal-pagar');
    if (modal) modal.classList.remove('oculto');
}

// Cerrarla antes de confirmar cancela la solicitud: todavía no se ha pedido nada
function cerrarModalPagar() {
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

// Lugar de entrega que eligió el cliente: una ubicación de la lista o el que escribió en "Otra ubicación…"
function lugarEntregaElegido() {
    const select = document.getElementById('lugar-entrega');
    if (!select) return '';

    return select.value === OTRA_UBICACION
        ? (document.getElementById('lugar-entrega-otra')?.value.trim() || '')
        : select.value;
}

// Paso 2: la ventana de pago (tarifa, propina y método). Todavía no se pide nada: eso es al confirmar
function abrirPagoDeSolicitud() {
    const confirmacion = document.getElementById('modal-confirmacion');
    if (confirmacion) confirmacion.style.display = 'none';

    obtenerYestablecerTarifa();
    abrirModalPagar();
}

// Método de pago elegido en la ventana: el texto del botón activo (Efectivo, QR o Nequi) y su ícono
function metodoPagoElegido() {
    const boton = document.querySelector('.metodo-btn.activo');
    return {
        texto: boton?.innerText?.trim().split('\n').pop().trim() || 'Efectivo',
        icono: boton?.querySelector('.ico')?.innerHTML ?? '💵'
    };
}

// Paso 3: "¿Estás seguro?" con el resumen. Las dos ventanas van en la misma capa: la de pago se esconde
// mientras tanto y con "Cancelar" vuelve tal como estaba
function mostrarAdvertenciaSolicitud() {
    const confirmacion = document.getElementById('modal-confirmacion');
    const contenido = document.getElementById('confirmacion');
    if (!confirmacion || !contenido) return;

    const propina = parseInt(document.getElementById('select-propina')?.value || '0');
    const metodo = metodoPagoElegido();

    contenido.innerHTML = `
        <div class="confirmacion-header">
            <h2 class="confirmacion-titulo">¿Estás seguro que quieres solicitar el vehículo?</h2>
            <p class="confirmacion-sub">Nuestro equipo lo llevará al lugar de entrega en unos 20 minutos.</p>
        </div>

        <div class="confirmacion-resumen">
            <p><strong>Lugar de entrega:</strong> <span id="resumen-lugar"></span></p>
            <p><strong>Valor a pagar:</strong> ${formatearMoneda(tarifaActual + propina)}</p>
            <p><strong>Método de pago:</strong> <span id="resumen-metodo"></span></p>
        </div>

        <div class="confirmacion-botones">
            <button type="button" class="btn-confirmacion btn-pagar" id="btn-confirmar-solicitud">Sí, solicitar vehículo</button>
            <button type="button" class="btn-cancelar-solicitud" id="btn-cancelar-solicitud">Cancelar</button>
        </div>
    `;

    // El lugar puede venir escrito por el cliente: va como texto, no como HTML
    document.getElementById('resumen-lugar').textContent = lugarEntregaSolicitud;
    document.getElementById('resumen-metodo').textContent = metodo.texto;

    cerrarModalPagar();
    confirmacion.style.display = 'block';

    document.getElementById('btn-cancelar-solicitud').addEventListener('click', function () {
        confirmacion.style.display = 'none';
        abrirModalPagar();
    });

    document.getElementById('btn-confirmar-solicitud').addEventListener('click', function () {
        enviarSolicitudConPago(this, propina, metodo);
    });
}

// Paso 4: pide el carro y guarda el pago en una sola llamada (PaymentController.SolicitarConPago)
function enviarSolicitudConPago(boton, propina, metodo) {
    if (boton.disabled) return;

    const idIngreso = document.getElementById('idIngreso')?.value;
    if (!idIngreso) { alert('Error: No se pudo obtener el ID del ingreso'); return; }

    boton.disabled = true;
    boton.textContent = '⏳ Solicitando...';

    const reintentar = () => {
        boton.disabled = false;
        boton.textContent = 'Sí, solicitar vehículo';
    };

    fetch('/Payment/SolicitarConPago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            idIngreso: parseInt(idIngreso),
            lugarEntrega: lugarEntregaSolicitud,
            propina: propina,
            metodoPago: metodo.texto
        })
    })
        .then(async response => {
            const data = await response.json().catch(() => ({}));

            // Ya entregado, sin valet o ya pedido: se avisa y se recarga para mostrar el estado real (como antes)
            if (response.status === 409) {
                window.reproducirSonido?.('error');
                alert(data.mensaje || 'Tu vehículo no se puede solicitar en este momento.');
                location.reload();
                return;
            }

            if (!response.ok) {
                window.reproducirSonido?.('error');
                alert(data.mensaje || 'No se pudo solicitar el vehículo. Intenta otra vez.');
                reintentar();
                return;
            }

            console.log('✅ Vehículo solicitado con su pago');
            window.reproducirSonido?.('confirmacion');
            mostrarSolicitudHecha(data, metodo);
        })
        .catch(error => {
            console.error('❌ Error:', error);
            window.reproducirSonido?.('error');
            alert('Error de conexión al solicitar el vehículo. Revisa tu internet e intenta otra vez.');
            reintentar();
        });
}

// Después de solicitar: sin ventanas, el lugar en la información, el temporizador y el panel de espera con el código
function mostrarSolicitudHecha(data, metodo) {
    const confirmacion = document.getElementById('modal-confirmacion');
    if (confirmacion) confirmacion.style.display = 'none';
    cerrarModalPagar();

    const btnSolicitar = document.getElementById('btn-solicitar');
    if (btnSolicitar) btnSolicitar.style.display = 'none';

    // Lugar de entrega en la información (escrito por el cliente: como texto, no como HTML)
    const LugarLI = document.getElementById('lugar_entrega');
    const LugarLabel = document.getElementById('lugar_entrega_label');
    if (LugarLI && LugarLabel) {
        LugarLI.style.display = 'block';
        LugarLabel.innerHTML = '<strong>📍 Punto de entrega:</strong> ';
        LugarLabel.append(lugarEntregaSolicitud);
    }

    // Valor (el que guardó el servidor) y método en el panel
    const iconoEl = document.getElementById('confirmacion-metodo-icono');
    const textoEl = document.getElementById('confirmacion-metodo-texto');
    const totalEl = document.getElementById('confirmacion-total');
    if (iconoEl) iconoEl.innerHTML = metodo.icono;
    if (textoEl) textoEl.innerText = data.metodo || metodo.texto;
    if (totalEl) totalEl.innerText = formatearMoneda(Number(data.total) || 0);

    mostrarPanelEspera();

    // Temporizador con la hora del servidor (la misma que al recargar) y la espera del código de seguridad
    if (data.fechaFinServicio) {
        inicializarTemporizadorPersistente(data.fechaFinServicio);
    } else {
        iniciarTemporizadorDesdeAhora();
    }
    iniciarVerificacionCodigo();

    document.getElementById('panel-espera')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    console.log("fecha servidor: ", fechaFinServicioServidor);

    const fechaFin = new Date(fechaFinServicioServidor);

    console.log("Ahora: ", new Date());

    console.log("Diferencia segundos: ", Math.ceil((fechaFin.getTime() - Date.now()) / 1000));


    //const fechaFin = new Date(fechaFinServicioServidor);
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
    window.reproducirSonido?.('solicitud');
    alert('⚠️ El vehículo ha llegado. Por favor, dirígete al punto de entrega.');
}

// ============================================================
// CÓDIGO DE SEGURIDAD
// ============================================================

// Consulta cada 3 s si el operador generó (o venció) el código, sin recargar
function iniciarVerificacionCodigo() {
    if (intervaloCodigo !== null) clearInterval(intervaloCodigo);

    const idIngreso = document.getElementById('idIngreso')?.value;
    if (!idIngreso) return;

    intervaloCodigo = setInterval(() => {
        fetch(`/Payment/ObtenerEstadoIngreso?id=${idIngreso}&_=${Date.now()}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (!data.success) return;

                mostrarCodigoSeguridad(data.codigo);

                // Cobro terminado: ya no hay código que esperar
                if (data.estadoPago === 'pagado') {
                    window.reproducirSonido?.('pago');
                    clearInterval(intervaloCodigo);
                    intervaloCodigo = null;
                }
            })
            .catch(err => console.error('❌ Error verificando código:', err));
    }, 3000);
}

// Muestra el código vigente o lo oculta si no hay / venció
function mostrarCodigoSeguridad(codigo) {
    const contenedor = document.getElementById('codigo-generado');
    const valor = document.getElementById('codigo-valor');

    // Suena solo cuando llega un código nuevo, no en cada consulta
    if (codigo && valor && valor.textContent !== codigo) window.reproducirSonido?.('codigo');

    if (contenedor) contenedor.style.display = codigo ? 'block' : 'none';
    if (valor) valor.textContent = codigo || '------';
}
