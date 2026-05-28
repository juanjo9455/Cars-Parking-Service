// Funciones para gestionar el flujo de pago con código de seguridad en Tabla_Vehiculos

function abrirModalPago(idIngreso, placa, nombreCliente) {
    const modal = document.getElementById(`modal-pago-${idIngreso}`);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function cerrarModalPago(idIngreso) {
    const modal = document.getElementById(`modal-pago-${idIngreso}`);
    if (modal) {
        modal.style.display = 'none';
        limpiarModalPago(idIngreso);
    }
}

function cerrarModalFinalizacion(idIngreso) {
    const modal = document.getElementById(`modal-${idIngreso}`);
    if (modal) {
        modal.style.display = 'none';
    }
}

function limpiarModalPago(idIngreso) {
    // Limpiar campos para próxima apertura
    const codigoValidacion = document.getElementById(`codigo-validacion-${idIngreso}`);
    if (codigoValidacion) {
        codigoValidacion.value = '';
    }
    
    // Esconder la barra de código generado
    const codigoGenerado = document.getElementById(`codigo-generado-${idIngreso}`);
    if (codigoGenerado) {
        codigoGenerado.style.display = 'none';
    }
    
    // Esconder la sección de validación
    const validacionContenedor = document.getElementById(`validacion-contenedor-${idIngreso}`);
    if (validacionContenedor) {
        validacionContenedor.style.display = 'none';
    }
    
    // Mostrar el botón de generar código nuevamente
    const btnContenedor = document.getElementById(`btn-generar-contenedor-${idIngreso}`);
    if (btnContenedor) {
        btnContenedor.style.display = 'block';
        const btnGenerar = btnContenedor.querySelector('button');
        if (btnGenerar) {
            btnGenerar.disabled = false;
            btnGenerar.textContent = '<i class="fa-solid fa-key"></i> Generar Código de Seguridad';
        }
    }
    
    // Habilitar el selector de método de pago nuevamente
    const metodoSelect = document.getElementById(`metodo-pago-${idIngreso}`);
    if (metodoSelect) {
        metodoSelect.disabled = false;
    }
}

function generarCodigoSeguridad(idIngreso) {
    const metodoPago = document.getElementById(`metodo-pago-${idIngreso}`)?.value;
    
    if (!metodoPago) {
        alert('Selecciona un método de pago');
        return;
    }

    // Deshabilitar botón mientras se procesa
    const btnContenedor = document.getElementById(`btn-generar-contenedor-${idIngreso}`);
    const btnGenerar = btnContenedor?.querySelector('button');
    
    if (btnGenerar) btnGenerar.disabled = true;

    fetch(`/Home/GenerarCodigoSeguridad?id=${idIngreso}&metodoPago=${metodoPago}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Mostrar el código generado
            document.getElementById(`codigo-valor-${idIngreso}`).textContent = data.codigo;
            document.getElementById(`codigo-generado-${idIngreso}`).style.display = 'block';
            
            // Mostrar la sección de validación
            document.getElementById(`validacion-contenedor-${idIngreso}`).style.display = 'block';
            
            // Esconder el botón de generar código
            if (btnContenedor) btnContenedor.style.display = 'none';
            
            document.getElementById(`metodo-pago-actual-${idIngreso}`).textContent = metodoPago;
            
            // Deshabilitar cambios posteriores en el método de pago
            document.getElementById(`metodo-pago-${idIngreso}`).disabled = true;
        } else {
            alert('Error: ' + (data.message || 'No se pudo generar el código'));
            if (btnGenerar) btnGenerar.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al generar el código de seguridad');
        if (btnGenerar) btnGenerar.disabled = false;
    });
}

function validarCodigoYAbrir(idIngreso, modalId) {
    const codigoIngresado = document.getElementById(`codigo-validacion-${idIngreso}`)?.value;
    
    if (!codigoIngresado || codigoIngresado.length !== 6) {
        alert('Ingresa un código válido de 6 dígitos');
        return;
    }

    // Mostrar estado de procesamiento
    const btnValidar = document.querySelector(`#modal-pago-${idIngreso} button[onclick*="validarCodigoYAbrir"]`);
    if (btnValidar) {
        btnValidar.disabled = true;
        btnValidar.textContent = 'Validando...';
    }

    fetch(`/Home/ValidarCodigoSeguridad?id=${idIngreso}&codigo=${codigoIngresado}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            cerrarModalPago(idIngreso);
            // Abrir el modal de finalización
            const modalFinalizacion = document.getElementById(modalId);
            if (modalFinalizacion) {
                modalFinalizacion.style.display = 'flex';
            }
        } else {
            alert('Error: ' + (data.message || 'Código inválido o expirado'));
            if (btnValidar) {
                btnValidar.disabled = false;
                btnValidar.textContent = '✓ Validar y Continuar';
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al validar el código');
        if (btnValidar) {
            btnValidar.disabled = false;
            btnValidar.textContent = '✓ Validar y Continuar';
        }
    });
}

function finalizarServicio(idIngreso) {
    const estadoServicio = document.getElementById(`estado-servicio-${idIngreso}`)?.value;
    
    if (!estadoServicio) {
        alert('Selecciona un estado para el servicio');
        return;
    }

    // Deshabilitar botón mientras se procesa
    const btnConfirmar = document.querySelector(`#modal-${idIngreso} button[onclick*="finalizarServicio"]`);
    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.textContent = 'Procesando...';
    }

    fetch(`/Home/FinalizarServicio?id=${idIngreso}&estadoServicio=${estadoServicio}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Servicio finalizado con éxito');
            location.reload();
        } else {
            alert('Error: ' + (data.message || 'No se pudo finalizar el servicio'));
            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.textContent = '✓ Confirmar';
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al finalizar el servicio');
        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.textContent = '✓ Confirmar';
        }
    });
}

// ========== CÓDIGO ORIGINAL DEL ARCHIVO ==========

document.addEventListener("DOMContentLoaded", function () {
    // ========== Inicialización de Variables ==========
    const methodCards = document.querySelectorAll('.pago-method-card');
    const confirmBtn = document.querySelector('.pago-btn-primary');
    const cancelBtn = document.querySelector('.pago-btn-secondary');
    const modal = document.getElementById('modal-confirmacion-pago');

    let selectedMethod = null;

    // ========== Seleccionar Método de Pago ========== //

    methodCards.forEach((card, index) => {
        card.addEventListener('click', function () {
            // Remover clase activo de todos
            methodCards.forEach(c => c.classList.remove('activo'));

            // Agregar clase activo al clickeado
            this.classList.add('activo');

            // Guardar método seleccionado
            const methods = ['efectivo', 'qr', 'nequi'];
            selectedMethod = methods[index];

            // Habilitar botón de confirmación
            if (confirmBtn) {
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
            }

            // Feedback visual
            console.log('✅ Método seleccionado:', selectedMethod);
        });
    });

    // ========== Confirmar Pago ==========
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
            if (!selectedMethod) {
                alert('⚠️ Por favor, selecciona un método de pago');
                return;
            }

            confirmarPago();
        });
    }

    // ========== Cancelar/Cerrar ==========
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
            if (modal && !modal.classList.contains('oculto')) {
                cerrarModalConfirmacion();
            }
        });
    }

    // ========== Cerrar modal haciendo click en overlay ==========
    if (modal) {
        const overlay = modal.querySelector('.pago-modal-overlay');
        if (overlay) {
            overlay.addEventListener('click', cerrarModalConfirmacion);
        }
    }
});

// ========== FUNCIÓN: Confirmar Pago ==========
function confirmarPago() {
    const modal = document.getElementById('modal-confirmacion-pago');
    const montoPagoModal = document.getElementById('montoPagoModal');
    const montoPago = document.getElementById('montoPago');

    if (!modal) {
        console.error('❌ Modal de confirmación no encontrado');
        return;
    }

    // Copiar monto al modal
    if (montoPagoModal && montoPago) {
        montoPagoModal.textContent = montoPago.textContent;
    }

    // Mostrar modal con animación
    modal.classList.remove('oculto');

    // Feedback visual
    console.log('✅ Modal de confirmación mostrado');

    // Simular procesamiento de pago (opcional)
    const confirmBtn = modal.querySelector('.pago-btn-primary');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function () {
            procesarPago();
        }, { once: true }); // Solo ejecutar una vez
    }
}

// ========== FUNCIÓN: Procesar Pago ==========
function procesarPago() {
    const confirmBtn = document.querySelector('.pago-modal-footer .pago-btn-primary');

    if (!confirmBtn) return;

    // Mostrar estado de carga
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
    confirmBtn.disabled = true;

    // Simular procesamiento
    setTimeout(() => {
        // Aquí iría el POST al servidor
        // Por ahora solo simulamos

        console.log('✅ Pago procesado exitosamente');

        // Mostrar éxito
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Pago Confirmado!';
        confirmBtn.style.background = 'linear-gradient(135deg, #4CAF50, #388E3C)';

        // Redirigir después de 2 segundos
        setTimeout(() => {
            window.location.href = '/Payment/Estado_Servicio'; // Redirigir a estado del servicio
        }, 2000);
    }, 1500);
}

// ========== FUNCIÓN: Cerrar Modal de Confirmación ==========
function cerrarModalConfirmacion() {
    const modal = document.getElementById('modal-confirmacion-pago');

    if (modal) {
        modal.classList.add('oculto');
        console.log('✅ Modal cerrado');
    }
}

// ========== FUNCIÓN: Seleccionar Método (alternativa) ==========
function seleccionarMetodo(tipo) {
    const methodCards = document.querySelectorAll('.pago-method-card');
    const methodMap = {
        'efectivo': 0,
        'qr': 1,
        'nequi': 2
    };

    methodCards.forEach(c => c.classList.remove('activo'));

    if (methodMap[tipo] !== undefined) {
        methodCards[methodMap[tipo]].classList.add('activo');
    }

    console.log('✅ Método selectio nado:', tipo);
}
