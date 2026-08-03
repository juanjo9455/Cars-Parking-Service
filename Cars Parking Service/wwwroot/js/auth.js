document.addEventListener("DOMContentLoaded", function () {

    // Metodo para validar roles con parqueaderos y ubicaciones
    mostrarCamposRol();

    // Guardar ubicacion en sesion
    window.guardarUbicacionSesion = function (valorUbicacion) {
        console.log("[guardarUbicacionSesion] Cambio detectado en la ubicación:", valorUbicacion);

        fetch('/Home/GuardarUbicacionSesion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'Accept': 'application/json'
            },
            body: `id_ubicacion=${encodeURIComponent(valorUbicacion || '')}`
        })
            .then(response => {
                console.log("[guardarUbicacionSesion] Respuesta HTTP:", response.status, response.statusText);
                return response.json();
            })
            .then(data => {
                console.log("[guardarUbicacionSesion] Respuesta JSON:", data);
            })
            .catch(error => {
                console.error("[guardarUbicacionSesion] Error guardando la ubicación en sesión:", error);
            });
    };

    // Utilidades de validacion
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

    function isValidEmail(value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function isValidPhone(value) {
        return /^[0-9]{7,15}$/.test(value.replace(/[\s\-()]/g, ''));
    }

    function isValidDNI(value) {
        return /^[0-9]{6,12}$/.test(value.trim());
    }

    // Agrega validacion en tiempo real a un campo
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
            if (input.value.trim() === '') {
                showError(input, errorEl);
            }
        });

        return validate;
    }

    // ===== Formulario de Login =====
    const btnLogin = document.getElementById("acceder");
    var loginForm = document.getElementById('loginForm');
    if (loginForm) {
        var validators = [
            addValidation('dniLogin', 'errorDNI', function (v) { return v !== '' && isValidDNI(v); }),
            addValidation('passwordLogin', 'errorPassword', function (v) { return v !== ''; })
        ];

        loginForm.addEventListener('submit', function (e) {
            var isValid = true;
            validators.forEach(function (validate) {
                if (validate && !validate()) isValid = false;
            });
            if (!isValid) {
                e.preventDefault();
            }
        });
    }

    // ===== Validación para formulario de cambio de rol (CambiarRol) =====
    // Busca el select de roles y su formulario (si existe)
    const selectRolGlobal = document.getElementById('selectRol');
    if (selectRolGlobal) {
        const formCambiarRol = selectRolGlobal.closest('form');

        // Función util para mostrar mensaje de error debajo del contenedor
        function showSelectError(container, message) {
            if (!container) return;
            let existing = container.querySelector('.error-roles');
            if (!existing) {
                existing = document.createElement('div');
                existing.className = 'error-roles';
                existing.style.color = '#d32f2f';
                existing.style.marginTop = '8px';
                existing.style.fontSize = '0.95rem';
                container.appendChild(existing);
            }
            existing.textContent = message;
            existing.classList.add('visible');
        }

        function clearSelectError(container) {
            if (!container) return;
            const existing = container.querySelector('.error-roles');
            if (existing) {
                existing.textContent = '';
                existing.classList.remove('visible');
            }
        }

        if (formCambiarRol) {
            formCambiarRol.addEventListener('submit', function (e) {
                const contenedorParqueadero = document.getElementById('contenedorParqueadero');
                const contenedorUbicacion = document.getElementById('contenedorUbicacion');
                const selectParqueadero = contenedorParqueadero ? contenedorParqueadero.querySelector('select[name="id_parqueadero"]') : null;
                const selectUbicacion = contenedorUbicacion ? contenedorUbicacion.querySelector('select[name="id_ubicacion"]') : null;

                const rolSeleccionado = selectRolGlobal.value;

                // Limpiar errores previos
                clearSelectError(contenedorParqueadero);
                clearSelectError(contenedorUbicacion);

                // Si se muestra contenedorParqueadero y no se seleccionó un parqueadero => impedir envío
                if (contenedorParqueadero && contenedorParqueadero.style.display !== 'none' && selectParqueadero) {
                    if (!selectParqueadero.value || selectParqueadero.value.trim() === '') {
                        e.preventDefault();
                        showSelectError(contenedorParqueadero, '⚠️ Debes seleccionar un parqueadero válido antes de continuar.');
                        selectParqueadero.focus();
                        return;
                    }
                }

                // Si se muestra contenedorUbicacion y no se seleccionó una ubicación => impedir envío
                if (contenedorUbicacion && contenedorUbicacion.style.display !== 'none' && selectUbicacion) {
                    if (!selectUbicacion.value || selectUbicacion.value.trim() === '') {
                        e.preventDefault();
                        showSelectError(contenedorUbicacion, '⚠️ Debes seleccionar una ubicación válida antes de continuar.');
                        selectUbicacion.focus();
                        return;
                    }
                }

                // Adicional: si el rol requiere ambas (banco y parqueadero) se puede validar aquí.
                // Por petición actual: validar que se introduzca banco y parqueadero cuando corresponda.
                // (Si el select de id_parqueadero/ubicacion no está presente o no visible, no se fuerza.)
            });

            // limpiar errores al cambiar selección
            formCambiarRol.addEventListener('change', function (ev) {
                const target = ev.target;
                if (!target) return;
                const contParq = document.getElementById('contenedorParqueadero');
                const contUb = document.getElementById('contenedorUbicacion');

                if (target.name === 'id_parqueadero' && contParq) {
                    clearSelectError(contParq);
                }
                if (target.name === 'id_ubicacion' && contUb) {
                    clearSelectError(contUb);
                }

                // Si cambian rol, actualizar visibilidad y limpiar errores
                if (target.id === 'selectRol') {
                    if (contParq) clearSelectError(contParq);
                    if (contUb) clearSelectError(contUb);
                }
            });
        }
    }

    /*if (btnLogin) {

        btnLogin.addEventListener("click", function () {

            if (input1) { input1.style.display = "none"; }
            if (input2) { input2.style.display = "none"; }
            if (input3) { input3.style.display = "block"; }
            if (btnLogin) { btnLogin.style.display = "none"; }
            if (btnLogin2) { btnLogin2.style.display = "block"; }

        });

    }*/


    // ===== Formulario de Registro =====
    var signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        var validators = [
            addValidation('nombre', 'errorNombre', function (v) { return v !== ''; }),
            addValidation('apellido', 'errorApellido', function (v) { return v !== ''; }),
            addValidation('edad', 'errorEdad', function (v) { var edad = parseInt(v); return v !== '' && edad >= 16 && edad <= 100; }),
            addValidation('telefono', 'errorTelefono', function (v) { return v !== '' && isValidPhone(v); }),
            addValidation('correoSignUp', 'errorCorreo', function (v) { return v !== '' && isValidEmail(v); }),
            addValidation('passwordSignUp', 'errorPassword', function (v) { return v.length >= 6; }),
            
            // NUEVAS VALIDACIONES AGREGADAS AQUÍ
            addValidation('dniSignUp', 'errorDNISignUp', function (v) { return v !== '' && isValidDNI(v); }),
            addValidation('rolSignUp', 'errorRolSignUp', function (v) { return v !== ''; })
        ];

        signUpForm.addEventListener('submit', function (e) {
            var isValid = true;
            validators.forEach(function (validate) {
                if (validate && !validate()) isValid = false;
            });
            if (!isValid) {
                e.preventDefault();
            }
            // Dejar que el formulario se envíe normalmente al servidor
        });
    }

    // =========== Olvide Mi contraseña =========== //
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        const emailInput = document.getElementById('email');
        const errorEmail = document.getElementById('errorEmail');

        forgotPasswordForm.addEventListener('submit', function (e) {
            const email = emailInput.value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            let isValid = true;

            if (!email) {
                emailInput.classList.add('input-error');
                errorEmail.textContent = '⚠️ El correo es obligatorio';
                errorEmail.classList.add('visible');
                isValid = false;
            } else if (!emailRegex.test(email)) {
                emailInput.classList.add('input-error');
                errorEmail.textContent = '⚠️ Ingresa un correo válido';
                errorEmail.classList.add('visible');
                isValid = false;
            } else {
                emailInput.classList.remove('input-error');
                errorEmail.classList.remove('visible');
            }

            if (!isValid) {
                e.preventDefault();
            }
        });

        emailInput.addEventListener('input', function () {
            this.classList.remove('input-error');
            errorEmail.classList.remove('visible');
        });
    }

    // =========== Codigo de Recuperacion =========== //
    const recoveryCodeForm = document.getElementById('recoveryCodeForm');
    if (recoveryCodeForm) {
        const codeInputs = document.querySelectorAll('.code-input');
        const errorCode = document.getElementById('errorCode');
        const resendBtn = document.getElementById('resendBtn');
        const timerDisplay = document.getElementById('timerDisplay');
        const fullCodeInput = document.getElementById('fullCode');
        const antiForgeryInput = recoveryCodeForm.querySelector('input[name="__RequestVerificationToken"]');

        let timeLeft = 300;
        let timerInterval;

        if (codeInputs.length > 0) {
            codeInputs[0].focus();
        }

        codeInputs.forEach((input, index) => {
            input.addEventListener('input', function (e) {
                const value = e.target.value;

                if (!/^\d*$/.test(value)) {
                    e.target.value = '';
                    return;
                }

                if (value) {
                    this.classList.add('filled');
                    this.classList.remove('error');
                    if (index < codeInputs.length - 1) {
                        codeInputs[index + 1].focus();
                    }
                } else {
                    this.classList.remove('filled');
                }

                if (errorCode) {
                    errorCode.classList.remove('visible');
                }
            });

            input.addEventListener('keydown', function (e) {
                if (e.key === 'Backspace' && !this.value && index > 0) {
                    codeInputs[index - 1].focus();
                    codeInputs[index - 1].value = '';
                    codeInputs[index - 1].classList.remove('filled');
                }

                if (e.key === 'ArrowLeft' && index > 0) {
                    codeInputs[index - 1].focus();
                }

                if (e.key === 'ArrowRight' && index < codeInputs.length - 1) {
                    codeInputs[index + 1].focus();
                }
            });

            input.addEventListener('focus', function () {
                this.select();
            });

            input.addEventListener('paste', function (e) {
                e.preventDefault();
                const pastedData = e.clipboardData.getData('text').trim();

                if (/^\d{6}$/.test(pastedData)) {
                    pastedData.split('').forEach((char, i) => {
                        if (codeInputs[i]) {
                            codeInputs[i].value = char;
                            codeInputs[i].classList.add('filled');
                        }
                    });
                    codeInputs[5].focus();
                }
            });
        });

        function startTimer() {
            timerInterval = setInterval(() => {
                timeLeft--;

                const minutes = Math.floor(timeLeft / 60);
                const seconds = timeLeft % 60;
                const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                if (timerDisplay) {
                    timerDisplay.innerHTML = `El código expira en <strong>${formattedTime}</strong>`;
                }

                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    if (timerDisplay) {
                        timerDisplay.innerHTML = '<strong style="color: #d32f2f;">El código ha expirado</strong>';
                    }   
                    if (resendBtn) {
                        resendBtn.disabled = false;
                    }

                    codeInputs.forEach(input => {
                        input.disabled = true;
                        input.classList.add('error');
                    });
                }
            }, 1000);
        }

        if (timerDisplay) {
            startTimer();
        }

        if (resendBtn) {
            resendBtn.addEventListener('click', async function () {
                const resendUrl = this.dataset.url;
                const antiForgeryToken = antiForgeryInput ? antiForgeryInput.value : '';

                try {
                    const response = await fetch(resendUrl, {
                        method: 'POST',
                        headers: {
                            'RequestVerificationToken': antiForgeryToken
                        }
                    });

                    if (!response.ok) {
                        throw new Error('No fue posible reenviar el código.');
                    }

                    timeLeft = 300;
                    clearInterval(timerInterval);
                    startTimer();

                    codeInputs.forEach(input => {
                        input.value = '';
                        input.disabled = false;
                        input.classList.remove('filled', 'error');
                    });

                    if (codeInputs.length > 0) {
                        codeInputs[0].focus();
                    }

                    this.disabled = true;

                    const originalText = this.innerHTML;
                    this.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Código enviado';

                    setTimeout(() => {
                        this.innerHTML = originalText;
                    }, 2000);
                } catch (error) {
                    if (errorCode) {
                        errorCode.textContent = '⚠️ No fue posible reenviar el código';
                        errorCode.classList.add('visible');
                    }
                }
            });
        }

        recoveryCodeForm.addEventListener('submit', function (e) {
            e.preventDefault();

            const code = Array.from(codeInputs).map(input => input.value).join('');

            if (code.length !== 6) {
                if (errorCode) {
                    errorCode.textContent = '⚠️ Por favor ingresa el código completo';
                    errorCode.classList.add('visible');
                }

                codeInputs.forEach(input => {
                    if (!input.value) {
                        input.classList.add('error');
                    }
                });

                return;
            }

            if (!/^\d{6}$/.test(code)) {
                if (errorCode) {
                    errorCode.textContent = '⚠️ El código solo debe contener números';
                    errorCode.classList.add('visible');
                }

                codeInputs.forEach(input => {
                    input.classList.add('error');
                });

                return;
            }

            if (errorCode) {
                errorCode.classList.remove('visible');
            }
            codeInputs.forEach(input => {
                input.classList.remove('error');
            });

            if (fullCodeInput) {
                fullCodeInput.value = code;
            }

            recoveryCodeForm.submit();
        });
    }

    // =========== Reset Password =========== //
    const resetPasswordForm = document.getElementById('resetPasswordForm');
    if (resetPasswordForm) {
        const newPasswordInput = document.getElementById('newPassword');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const errorNewPassword = document.getElementById('errorNewPassword');
        const errorConfirmPassword = document.getElementById('errorConfirmPassword');

        resetPasswordForm.addEventListener('submit', function (e) {
            let isValid = true;

            const newPassword = newPasswordInput.value.trim();
            const confirmPassword = confirmPasswordInput.value.trim();

            if (newPassword.length < 6) {
                newPasswordInput.classList.add('input-error');
                if (errorNewPassword) errorNewPassword.classList.add('visible');
                isValid = false;
            } else {
                newPasswordInput.classList.remove('input-error');
                newPasswordInput.classList.add('input-success');
                if (errorNewPassword) errorNewPassword.classList.remove('visible');
            }

            if (confirmPassword === '' || confirmPassword !== newPassword) {
                confirmPasswordInput.classList.add('input-error');
                if (errorConfirmPassword) errorConfirmPassword.classList.add('visible');
                isValid = false;
            } else {
                confirmPasswordInput.classList.remove('input-error');
                confirmPasswordInput.classList.add('input-success');
                if (errorConfirmPassword) errorConfirmPassword.classList.remove('visible');
            }

            if (!isValid) {
                e.preventDefault();
            }
        });

        if (newPasswordInput) {
            newPasswordInput.addEventListener('input', function () {
                this.classList.remove('input-error');
                if (errorNewPassword) errorNewPassword.classList.remove('visible');
            });
        }

        if (confirmPasswordInput) {
            confirmPasswordInput.addEventListener('input', function () {
                this.classList.remove('input-error');
                if (errorConfirmPassword) errorConfirmPassword.classList.remove('visible');
            });
        }
    }
});

// Validacion de roles con parqueaderos y ubicaciones
function mostrarCamposRol() {

    // Obtenemos el select de roles
    const selectRol = document.getElementById('selectRol');

    // Contenedores
    const contenedorParqueadero = document.getElementById('contenedorParqueadero');
    const contenedorUbicacion = document.getElementById('contenedorUbicacion');

    // Si no existe el bloque en esta vista, no hacemos nada
    if (!selectRol || !contenedorParqueadero || !contenedorUbicacion) {
        return;
    }

    // Valor seleccionado
    const rolSeleccionado = selectRol.value;

    // Ocultamos todo primero
    contenedorParqueadero.style.display = 'none';
    contenedorUbicacion.style.display = 'none';

    // 1 = valet
    // 2 = banco
    // 4 = key
    if (rolSeleccionado == 2) {
        contenedorUbicacion.style.display = 'block';
    }
    else if (rolSeleccionado == 4) {
        contenedorParqueadero.style.display = 'block';
    }
}

// Exponerla globalmente para usarla desde onchange en Razor
window.mostrarCamposRol = mostrarCamposRol;