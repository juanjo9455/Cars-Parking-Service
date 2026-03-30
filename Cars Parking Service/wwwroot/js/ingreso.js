document.addEventListener("DOMContentLoaded", function () {
    const tomarFotoBtn = document.getElementById('tomarFotoBtn');
    const cameraInput = document.getElementById('cameraInput');
    const photosPreview = document.getElementById('photosPreview');
    const photoCounter = document.querySelector('.photo-counter');
    const ingresoForm = document.getElementById('ingresoForm');
    const fotosContainer = document.getElementById('fotosBase64Container');
    
    let fotosCapturadas = [];
    const MAX_FOTOS = 10;

    // ===== Utilidades de validación =====
    function showError(input, errorEl) {
        input.classList.add('input-error');
        input.classList.remove('input-success');
        errorEl.classList.add('visible');
    }

    function showSuccess(input, errorEl) {
        input.classList.remove('input-error');
        input.classList.add('input-success');
        errorEl.classList.remove('visible');
    }

    function resetField(input, errorEl) {
        input.classList.remove('input-error', 'input-success');
        errorEl.classList.remove('visible');
    }

    function isValidDNI(value) {
        return /^[0-9]{6,12}$/.test(value.trim());
    }

    function isValidPhone(value) {
        return /^[0-9]{7,15}$/.test(value.replace(/[\s\-()]/g, ''));
    }

    function isValidPlaca(value) {
        return /^[A-Z]{3}[0-9]{3}$/.test(value.trim());
    }

    // ===== Validaciones en tiempo real =====
    function addValidation(inputId, errorId, validateFn) {
        var input = document.getElementById(inputId);
        var errorEl = document.getElementById(errorId);
        if (!input || !errorEl) return null;

        function validate() {
            var value = input.value.trim();
            if (!validateFn(value)) {
                showError(input, errorEl);
                return false;
            }
            showSuccess(input, errorEl);
            return true;
        }

        input.addEventListener('input', function () {
            if (input.value.trim() === '') {
                resetField(input, errorEl);
            } else {
                validate();
            }
        });

        input.addEventListener('blur', function () {
            if (input.value.trim() !== '') {
                validate();
            }
        });

        return validate;
    }

    // Aplicar validaciones
    const validators = [
        addValidation('placa', 'errorPlaca', isValidPlaca),
        addValidation('dni', 'errorDNI', isValidDNI),
        addValidation('telefono', 'errorTelefono', isValidPhone)
    ];

    // ===== Manejo del checkbox de valuables =====
    const noValuablesCheckbox = document.getElementById('no-valuables');
    const notasInput = document.getElementById('notas');

    if (noValuablesCheckbox && notasInput) {
        noValuablesCheckbox.addEventListener('change', function() {
            if (this.checked) {
                notasInput.value = 'Sin objetos de valor';
                notasInput.disabled = true;
            } else {
                notasInput.value = '';
                notasInput.disabled = false;
            }
        });
    }

    // ===== Manejo de la cámara =====
    tomarFotoBtn.addEventListener('click', function() {
        if (fotosCapturadas.length >= MAX_FOTOS) {
            alert(`Solo se permiten maximo ${MAX_FOTOS} fotos`);
            return;
        }
        cameraInput.click();
    });

    cameraInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        
        files.forEach(file => {
            if (fotosCapturadas.length >= MAX_FOTOS) {
                alert(`Solo se permiten maximo ${MAX_FOTOS} fotos`);
                return;
            }

            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                
                reader.onload = function(event) {
                    const fotoData = {
                        src: event.target.result,
                        file: file,
                        id: Date.now() + Math.random()
                    };
                    
                    fotosCapturadas.push(fotoData);
                    mostrarFoto(fotoData);
                    actualizarContador();
                    actualizarInputsOcultos();
                    actualizarEstadoBoton();
                };
                
                reader.readAsDataURL(file);
            }
        });
        
        cameraInput.value = '';
    });

    function mostrarFoto(fotoData) {
        const fotoDiv = document.createElement('div');
        fotoDiv.className = 'photo-item';
        fotoDiv.dataset.id = fotoData.id;
        
        fotoDiv.innerHTML = `
            <img src="${fotoData.src}" alt="Foto del vehículo">
            <button type="button" class="delete-photo" data-id="${fotoData.id}">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        `;
        
        photosPreview.appendChild(fotoDiv);
        
        const deleteBtn = fotoDiv.querySelector('.delete-photo');
        deleteBtn.addEventListener('click', function() {
            eliminarFoto(fotoData.id);
        });
    }

    function eliminarFoto(id) {
        fotosCapturadas = fotosCapturadas.filter(foto => foto.id !== id);
        
        const fotoElement = photosPreview.querySelector(`[data-id="${id}"]`);
        if (fotoElement) {
            fotoElement.remove();
        }
        
        actualizarContador();
        actualizarInputsOcultos();
        actualizarEstadoBoton();
    }

    function actualizarContador() {
        const cantidad = fotosCapturadas.length;
        photoCounter.textContent = `${cantidad} foto${cantidad !== 1 ? 's' : ''} tomada${cantidad !== 1 ? 's' : ''} (max. ${MAX_FOTOS})`;
    }

    function actualizarInputsOcultos() {
        fotosContainer.innerHTML = '';
        fotosCapturadas.forEach((foto, index) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `fotos[${index}]`;
            input.value = foto.src;
            fotosContainer.appendChild(input);
        });
    }

    function actualizarEstadoBoton() {
        if (fotosCapturadas.length >= MAX_FOTOS) {
            tomarFotoBtn.disabled = true;
            tomarFotoBtn.style.opacity = '0.5';
            tomarFotoBtn.style.cursor = 'not-allowed';
        } else {
            tomarFotoBtn.disabled = false;
            tomarFotoBtn.style.opacity = '1';
            tomarFotoBtn.style.cursor = 'pointer';
        }
    }

    // ===== Validación del formulario =====
    ingresoForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validar todos los campos
        let isValid = true;
        validators.forEach(function (validate) {
            if (validate && !validate()) isValid = false;
        });

        // Validar selects
        const selects = ['id_valet', 'id_banco', 'id_parqueadero', 'id_ubicacion'];
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            const errorEl = document.getElementById('error' + selectId.split('_')[1].charAt(0).toUpperCase() + selectId.split('_')[1].slice(1));
            if (select && select.value === '') {
                showError(select, errorEl);
                isValid = false;
            }
        });

        if (!isValid) {
            alert('Por favor, completa todos los campos requeridos correctamente');
            return;
        }
        
        // Enviar el formulario
        this.submit();
    });
});