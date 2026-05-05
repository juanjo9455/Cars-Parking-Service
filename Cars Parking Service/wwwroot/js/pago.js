document.addEventListener("DOMContentLoaded", function () {
    // ========== Inicialización de Variables ==========
    const methodCards = document.querySelectorAll('.pago-method-card');
    const confirmBtn = document.querySelector('.pago-btn-primary');
    const cancelBtn = document.querySelector('.pago-btn-secondary');
    const modal = document.getElementById('modal-confirmacion-pago');

    let selectedMethod = null;

    // ========== Seleccionar Método de Pago ==========
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
