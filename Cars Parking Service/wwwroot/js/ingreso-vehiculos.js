document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('ingresoForm');
    const firmaCanvas = document.getElementById('firmaCanvas');
    const ctx = firmaCanvas.getContext('2d');
    const placaInput = document.getElementById('placa');
    const submitBtn = document.getElementById('acceder');
    const noValuablesBtn = document.getElementById('noValuablesBtn');
    const notasInput = document.getElementById('notas');
    const btnObjetosImagenes = document.getElementById("tomarFotoObjetosBtn");
    const sinObjetosHidden = document.getElementById('sin_objetos_valor_hidden');
    let firmando = false;
    let firmaRealizada = false;

    const mostrarAlerta = (mensaje, tipo = 'error') => {
        if (typeof window.mostrarAlertaServidor === 'function') {
            window.mostrarAlertaServidor(mensaje, tipo);
            return;
        }

        const containerId = 'customAlertContainer';
        let container = document.getElementById(containerId);

        if (!container) {
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'custom-alert-container';
            document.body.appendChild(container);
        }

        const alerta = document.createElement('div');
        alerta.className = `custom-alert ${tipo === 'success' ? 'success' : 'error'}`;
        alerta.innerHTML = `<div class="custom-alert-icon">${tipo === 'success' ? '✓' : '!'}</div><div class="custom-alert-message"></div>`;
        alerta.querySelector('.custom-alert-message').textContent = mensaje;

        container.appendChild(alerta);

        setTimeout(() => {
            alerta.classList.add('hide');
            setTimeout(() => alerta.remove(), 380);
        }, 3600);
    };

    if (noValuablesBtn && notasInput && sinObjetosHidden) {
        const aplicarEstadoNotas = (activo) => {

            if (activo) {

                notasInput.value = 'Sin objetos de valor';
                notasInput.readOnly = true;
                notasInput.classList.add('inactivo');

                noValuablesBtn.classList.add('active');

                btnObjetosImagenes.classList.add('inactivo');

                if (typeof window.limpiarObjetosValorSeleccionados === 'function') {
                    window.limpiarObjetosValorSeleccionados();
                }

                sinObjetosHidden.value = 'true';

            } else {

                notasInput.value = '';
                notasInput.readOnly = false;

                notasInput.classList.remove('inactivo');

                noValuablesBtn.classList.remove('active');

                btnObjetosImagenes.classList.remove('inactivo');

                sinObjetosHidden.value = 'false';
            }
        };

        noValuablesBtn.addEventListener('click', function() {
            const estaActivo = sinObjetosHidden.value === 'true';
            aplicarEstadoNotas(!estaActivo);
        });
    }

    if (placaInput) {
        placaInput.addEventListener('input', function () {
            this.value = this.value.toUpperCase();
        });
    }

    console.log('✅ Script ingreso-vehiculos.js cargado correctamente');

    // ========== SOLO FIRMA ==========
    // Configurar canvas para firma
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Eventos de firma
    firmaCanvas.addEventListener('mousedown', iniciarFirma);
    firmaCanvas.addEventListener('mousemove', dibujarFirma);
    firmaCanvas.addEventListener('mouseup', finalizarFirma);
    firmaCanvas.addEventListener('touchstart', iniciarFirma);
    firmaCanvas.addEventListener('touchmove', dibujarFirma);
    firmaCanvas.addEventListener('touchend', finalizarFirma);

    function iniciarFirma(e) {
        e.preventDefault();
        firmando = true;
        const rect = firmaCanvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.beginPath();
        ctx.moveTo(x, y);
    }

    function dibujarFirma(e) {
        if (!firmando) return;
        e.preventDefault();
        const rect = firmaCanvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;
        ctx.lineTo(x, y);
        ctx.stroke();
        firmaRealizada = true;
    }

    function finalizarFirma() {
        firmando = false;
    }

    // Limpiar firma
    const limpiarFirmaBtn = document.getElementById('limpiarFirma');
    if (limpiarFirmaBtn) {
        limpiarFirmaBtn.addEventListener('click', function(e) {
            e.preventDefault();
            ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
            firmaRealizada = false;
            const errorFirma = document.getElementById('errorFirma');
            if (errorFirma) errorFirma.style.display = 'none';
            console.log('🧹 Firma limpiada');
        });
    }

    // ========== VALIDACIÓN ANTES DE ENVÍO ==========
    // Este script SOLO valida los campos del formulario
    // NO previene el envío a menos que haya errores de validación
    // El controlador maneja todo lo demás (redirecciones, respuestas, etc)

    if (submitBtn && form) {
        submitBtn.addEventListener('click', function () {
            if (!form.checkValidity()) {
                mostrarAlerta('Por favor, completa todos los campos requeridos correctamente.', 'error');
            }
        });
    }

    form.addEventListener('submit', function(e) {
        console.log('📝 Validando formulario...');
        
        let errores = [];

        // Validar campos básicos
        const placaNormalizada = (document.getElementById('placa')?.value.trim() || '').toUpperCase();
        const placa = placaNormalizada;
        const telefono = document.getElementById('telefono')?.value.trim() || '';
        const idValet = document.getElementById('id_valet')?.value || '';
        const idBanco = document.querySelector('input[name="id_banco"]')?.value || '';
        const idParqueadero = document.getElementById('id_parqueadero')?.value || '';
        const videoBase64 = document.getElementById('videoBase64Input')?.value || '';
        //const idUbicacion = document.getElementById('id_ubicacion')?.value || '';

        console.log('=== VALIDACIÓN DE CAMPOS ===');
        console.log('Placa:', placa);
        console.log('Teléfono:', telefono);
        console.log('ID Valet:', idValet);
        console.log('ID Banco:', idBanco);
        console.log('ID Parqueadero:', idParqueadero);
        console.log('Video capturado:', !!videoBase64);
        //console.log('ID Ubicación:', idUbicacion);

        if (!placa || !/^[A-Z]{3}[0-9]{3}$/.test(placa)) {
            errores.push('Placa inválida');
            const errorPlaca = document.getElementById('errorPlaca');
            if (errorPlaca) errorPlaca.style.display = 'block';
        }

        if (!telefono) {
            errores.push('Teléfono requerido');
            const errorTelefono = document.getElementById('errorTelefono');
            if (errorTelefono) errorTelefono.style.display = 'block';
        }

        if (idValet === 'Selecciona un Valet') {
            errores.push('Valet requerido');
            const errorValet = document.getElementById('errorValet');
            if (errorValet) errorValet.style.display = 'block';
        }

        if (!idBanco) {
            errores.push('Banco requerido');
            const errorBanco = document.getElementById('errorBanco');
            if (errorBanco) errorBanco.style.display = 'block';
        }

        if (!idParqueadero) {
            errores.push('Parqueadero requerido');
            const errorParqueadero = document.getElementById('errorParqueadero');
            if (errorParqueadero) errorParqueadero.style.display = 'block';
        }

        /*if (!idUbicacion) {
            errores.push('Ubicación requerida');
            const errorUbicacion = document.getElementById('errorUbicacion');
            if (errorUbicacion) errorUbicacion.style.display = 'block';
        }*/

        const videoEsValido = typeof window.videoVehiculoEsValido === 'function'
            ? window.videoVehiculoEsValido()
            : !!videoBase64;

        if (!videoEsValido) {
            errores.push('Video obligatorio de mínimo 15 segundos');
            const errorMedia = document.getElementById('errorMedia');
            if (errorMedia) errorMedia.style.display = 'block';
            mostrarAlerta('Debes grabar y guardar un video de mínimo 15 segundos antes de ingresar el vehículo.', 'error');
        } else {
            const errorMedia = document.getElementById('errorMedia');
            if (errorMedia) errorMedia.style.display = 'none';
        }

        // Validar firma
        console.log('=== VALIDACIÓN DE FIRMA ===');
        console.log('Firma realizada:', firmaRealizada);

        if (!firmaRealizada) {
            errores.push('Firma requerida');
            const errorFirma = document.getElementById('errorFirma');
            if (errorFirma) errorFirma.style.display = 'block';
            console.error('❌ Firma NO realizada');
        } else {
            // Capturar firma como base64
            const firmaBase64Value = firmaCanvas.toDataURL('image/png');
            const firmaBase64Input = document.getElementById('firmaBase64');
            if (firmaBase64Input) {
                firmaBase64Input.value = firmaBase64Value;
            }
            console.log('✅ Firma capturada');
        }

        // Si hay errores de validación, PREVENIR el envío
        if (errores.length > 0) {
            console.error('❌ ERRORES DE VALIDACIÓN:', errores);
            e.preventDefault();
            if (!errores.includes('Video obligatorio de 30 segundos')) {
                mostrarAlerta('Por favor, completa todos los campos requeridos correctamente.', 'error');
            }
            return false;
        }

        // ✅ Sin errores - permitir que el formulario se envíe
        // El controlador manejará todo lo demás (validación de negocio, redirecciones, etc)
        console.log('=== VALIDACIÓN EXITOSA - PERMITIENDO ENVÍO AL CONTROLADOR ===');
        // NO hacer preventDefault - dejar que el formulario se envíe
    });

    console.log('✅ Evento submit del formulario configurado');
});

