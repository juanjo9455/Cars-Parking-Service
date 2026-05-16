document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('ingresoForm');
    const firmaCanvas = document.getElementById('firmaCanvas');
    const ctx = firmaCanvas.getContext('2d');
    const placaInput = document.getElementById('placa');
    const submitBtn = document.getElementById('acceder');
    const noValuablesBtn = document.getElementById('noValuablesBtn');
    const notasInput = document.getElementById('notas');
    const sinObjetosHidden = document.getElementById('sin_objetos_valor_hidden');
    let firmando = false;
    let firmaRealizada = false;
    let enviandoFormulario = false;

    if (noValuablesBtn && notasInput && sinObjetosHidden) {
        const aplicarEstadoNotas = (activo) => {
            if (activo) {
                notasInput.value = 'Sin objetos de valor';
                notasInput.readOnly = true;
                notasInput.classList.add('inactivo');
                noValuablesBtn.classList.add('active');
                sinObjetosHidden.value = 'true';
            } else {
                notasInput.value = '';
                notasInput.readOnly = false;
                notasInput.classList.remove('inactivo');
                noValuablesBtn.classList.remove('active');
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

    // ========== VALIDACIÓN Y ENVÍO ==========
    form.addEventListener('submit', function(e) {
        if (enviandoFormulario) {
            e.preventDefault();
            return false;
        }

        console.log('📝 Formulario enviándose...');
        
        e.preventDefault();
        
        let errores = [];

        // Validar campos básicos
        const placaNormalizada = (document.getElementById('placa')?.value.trim() || '').toUpperCase();
        if (placaInput) {
            placaInput.value = placaNormalizada;
        }

        const placa = placaNormalizada;
        const telefono = document.getElementById('telefono')?.value.trim() || '';
        const idValet = document.getElementById('id_valet')?.value || '';
        const idBanco = document.querySelector('input[name="id_banco"]')?.value || '';
        const idParqueadero = document.getElementById('id_parqueadero')?.value || '';
        const idUbicacion = document.getElementById('id_ubicacion')?.value || '';

        console.log('=== VALIDACIÓN DE CAMPOS ===');
        console.log('Placa:', placa);
        console.log('Teléfono:', telefono);
        console.log('ID Valet:', idValet);
        console.log('ID Banco:', idBanco);
        console.log('ID Parqueadero:', idParqueadero);
        console.log('ID Ubicación:', idUbicacion);

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

        if (!idValet || idValet === 'Selecciona un Valet') {
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

        if (!idUbicacion) {
            errores.push('Ubicación requerida');
            const errorUbicacion = document.getElementById('errorUbicacion');
            if (errorUbicacion) errorUbicacion.style.display = 'block';
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

        // Si hay errores, no continuar
        if (errores.length > 0) {
            console.error('❌ ERRORES DE VALIDACIÓN:', errores);
            console.error('El formulario NO se enviará');
            return false;
        }

        // ✅ Marcar estado de carga para evitar doble clic
        enviandoFormulario = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.add('is-loading');
            submitBtn.textContent = 'Ingresando...';
        }
        
        // ✅ Enviar el formulario
        console.log('=== FORMULARIO VÁLIDO - ENVIANDO ===');
        HTMLFormElement.prototype.submit.call(form);
    });

    console.log('✅ Evento submit del formulario configurado');
});