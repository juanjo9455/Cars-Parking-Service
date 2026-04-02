document.addEventListener("DOMContentLoaded", function () {
    const menu_lateral = document.getElementById("menu-lateral");
    const cerrar_menu_lateral = document.getElementById("cerrar-menu-lateral");
    const abrir_menu_lateral = document.getElementById("abrir-menu-lateral");
    const div_abrir_menu = document.getElementById("div-abrir-menu");
    const notas = document.getElementById("notas"); // ✅ CAMBIO: "valuables" → "notas"

    // removemos clase que usamos mas adelante //
    if (notas) notas.classList.remove("inactivo"); // ✅ CAMBIO

    //Abrir Menu Lateral
    if (abrir_menu_lateral && menu_lateral && div_abrir_menu) {
        abrir_menu_lateral.addEventListener("click", function () {
            menu_lateral.classList.add("mostrar");
            div_abrir_menu.classList.add("oculto");
        });
    }

    //Cerrar Menu Lateral
    if (cerrar_menu_lateral && menu_lateral && div_abrir_menu) {
        cerrar_menu_lateral.addEventListener("click", function () {
            menu_lateral.classList.remove("mostrar");
            div_abrir_menu.classList.remove("oculto");
        });
    }

    // ============================ validacion campos registrar vehiculo ============================ //

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

    function isValidPlaca(value) {
        return /^[A-Z]{3}-?[0-9]{3}$/.test(value);
    }

    function isValidPhone(value) {
        return /^[0-9]{7,15}$/.test(value.replace(/[\s\-()]/g, ''));
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

    // ===== Formulario de Ingreso ===== //
    var ingresoForm = document.getElementById('ingresoForm');
    if (ingresoForm) {
        var validators = [
            addValidation('Placa', 'errorPlaca', function (v) { return v !== '' && isValidPlaca(v.toUpperCase()); }),
            addValidation('nombre', 'errorNombre', function (v) { return v !== ''; }),
            addValidation('telefono', 'errorTelefono', function (v) { return v !== '' && isValidPhone(v); }),
            addValidation('notas', 'errorNotas', function (v) { // ✅ CAMBIO: "valuables" → "notas"
                var noVal = document.getElementById('no-valuables');
                if (noVal && noVal.checked) return true;
                return v !== '';
            }),
        ];

        ingresoForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var isValid = true;
            validators.forEach(function (validate) {
                if (validate && !validate()) isValid = false;
            });

            // Validar firma
            var errorFirma = document.getElementById("errorFirma");
            if (window.firmaValida && !window.firmaValida()) {
                if (errorFirma) errorFirma.classList.add("visible");
                isValid = false;
            } else {
                if (errorFirma) errorFirma.classList.remove("visible");
            }

            if (isValid) {
                window.location.href = "/Home/Tabla_Vehiculos";
            }
        });
    }

    // =============== no valuables =============== //
    const check_valuables = document.getElementById("no-valuables");

    if (check_valuables && notas) { // ✅ CAMBIO: "valuables" → "notas"
        check_valuables.addEventListener("change", function () {
            var errorNotas = document.getElementById('errorNotas'); // ✅ CAMBIO
            if (this.checked) {
                notas.classList.add("inactivo");
                notas.disabled = true;
                notas.value = '';
                if (errorNotas) errorNotas.classList.remove('visible');
                notas.classList.remove('input-error', 'input-success');
            } else {
                notas.classList.remove("inactivo");
                notas.disabled = false;
            }
        });
    }

    // =============== Firma del cliente (Canvas robusto y retina) =============== //
    var firmaCanvas = document.getElementById("firmaCanvas");
    if (firmaCanvas) {
        // Ajuste para pantallas retina
        function resizeCanvas() {
            const ratio = window.devicePixelRatio || 1;
            firmaCanvas.width = firmaCanvas.offsetWidth * ratio;
            firmaCanvas.height = firmaCanvas.offsetHeight * ratio;
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            ctx.scale(ratio, ratio);
        }

        var ctx = firmaCanvas.getContext("2d");
        var firmando = false;
        var haFirmado = false;
        var lastPos = null;

        ctx.strokeStyle = "#333";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        function getPos(e) {
            var rect = firmaCanvas.getBoundingClientRect();
            if (e.touches && e.touches.length > 0) {
                return {
                    x: e.touches[0].clientX - rect.left,
                    y: e.touches[0].clientY - rect.top
                };
            } else if (e.changedTouches && e.changedTouches.length > 0) {
                return {
                    x: e.changedTouches[0].clientX - rect.left,
                    y: e.changedTouches[0].clientY - rect.top
                };
            } else {
                return {
                    x: e.clientX - rect.left,
                    y: e.clientY - rect.top
                };
            }
        }

        function startDraw(e) {
            e.preventDefault();
            firmando = true;
            haFirmado = true;
            lastPos = getPos(e);
        }

        function draw(e) {
            if (!firmando) return;
            e.preventDefault();
            var pos = getPos(e);
            if (lastPos) {
                ctx.beginPath();
                ctx.moveTo(lastPos.x, lastPos.y);
                ctx.lineTo(pos.x, pos.y);
                ctx.stroke();
            }
            lastPos = pos;
        }

        function endDraw(e) {
            if (firmando) {
                e.preventDefault();
                firmando = false;
                lastPos = null;
                var errorFirma = document.getElementById("errorFirma");
                if (errorFirma) errorFirma.classList.remove("visible");
            }
        }

        // Mouse events
        firmaCanvas.addEventListener("mousedown", startDraw);
        firmaCanvas.addEventListener("mousemove", draw);
        window.addEventListener("mouseup", endDraw);

        // Touch events
        firmaCanvas.addEventListener("touchstart", startDraw, {passive: false});
        firmaCanvas.addEventListener("touchmove", draw, {passive: false});
        window.addEventListener("touchend", endDraw, {passive: false});

        // Limpiar firma
        var limpiarBtn = document.getElementById("limpiarFirma");
        if (limpiarBtn) {
            limpiarBtn.addEventListener("click", function () {
                ctx.clearRect(0, 0, firmaCanvas.width, firmaCanvas.height);
                haFirmado = false;
            });
        }

        window.firmaValida = function () { return haFirmado; };
    }

    // ============================  Funciones para las acciones del admin ============================ //

    // Cards Principales para activar las funciones del admin
    const usuariosCard = document.getElementById("CardUsuarios");
    const ubicacionesCard = document.getElementById("CardUbicaciones");
    const parqueaderosCard = document.getElementById("CardParqueaderos");
    const tituloAccionesPrincipales = document.getElementById("acciones-principales-titulo");

    // =========================== Ubicacion =========================== \\

    // Cards secundarias de acciones de ubicaciones
    //const CardUb1 = document.getElementById("CardUb1");
    //const CardUb2 = document.getElementById("CardUb2");
    const CardsUb = document.getElementById("SubCardsUbicaciones");
    const btnRegresarSubUbicaciones = document.getElementById("btnRegresarSubUbicaciones"); // BOTON NUEVO
    const tblUbicaciones = document.getElementById("TablaUbicacionesContainer");
    const containerNuevaUbicacion = document.getElementById("ContainerRegistroUbicacion");

    if (ubicacionesCard) {
        ubicacionesCard.addEventListener("click", function (){
            ubicacionesCard.style.display = "none";
            if (usuariosCard) usuariosCard.style.display = "none";
            if (parqueaderosCard) parqueaderosCard.style.display = "none";

            // Cambiamos el titulo
            document.getElementById("titulo-principal").style.display = "none";
            document.getElementById("titulo-usuarios").style.display = "none";
            document.getElementById("titulo-ubicaciones").style.display = "block";
            document.getElementById("titulo-parqueaderos").style.display = "none";

            // Mostramos las card secundarias y el boton
            if (CardsUb) CardsUb.style.display = "flex";
            //if (CardUb1) CardUb1.style.display = "block";
            //if (CardUb2) CardUb2.style.display = "block";
            if (btnRegresarSubUbicaciones) btnRegresarSubUbicaciones.style.display = "block";

            CardUb2.addEventListener("click", function () {
                if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";
                //CardUb1.style.display = "none";
                //CardUb2.style.display = "none";
                CardsUb.style.display = "none";
                if (btnRegresarSubUbicaciones) btnRegresarSubUbicaciones.style.display = "none"; // Ocultar el boton

                if (tblUbicaciones) {
                    tblUbicaciones.style.display = "block";
                }
            })

            // (Ubicado donde manejas los clicks de las cards de Ubicación)
            if (CardUb1) {
                CardUb1.addEventListener("click", function () {
                    if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";
                    //CardUb1.style.display = "none";
                    //CardUb2.style.display = "none";
                    CardsUb.style.display = "none";
                    if (btnRegresarSubUbicaciones) btnRegresarSubUbicaciones.style.display = "none";

                    // Mostrar el container de registro
                    if (containerNuevaUbicacion) containerNuevaUbicacion.style.display = "block";
                });
            }

            // Validaciones para formulario nueva ubicación
            var formNuevaUbicacion = document.getElementById('formNuevaUbicacion');
            if (formNuevaUbicacion) {
                var valUbicacion = [
                    addValidation('nueva_nombre_ubicacion', 'errorNuevaUbicacionNombre', function (v) { return v !== ''; }),
                    addValidation('nueva_direccion', 'errorNuevaDireccion', function (v) { return v !== ''; }),
                    addValidation('nueva_ciudad', 'errorNuevaCiudad', function (v) { return v !== ''; }),
                    addValidation('nuevo_valor_servicio', 'errorNuevoValor', function (v) { return v !== '' && parseFloat(v) >= 0; })
                ];

                formNuevaUbicacion.addEventListener('submit', function (e) {
                    var isValid = true;
                    valUbicacion.forEach(function (validate) {
                        if (validate && !validate()) isValid = false;
                    });
                    if (!isValid) e.preventDefault();
                });
            }
        });
    }

    // =========================== Usuario =========================== \\

    //const CardU1 = document.getElementById("CardU1");
    //const CardU2 = document.getElementById("CardU2");
    const CardsU = document.getElementById("SubCardsUsuarios");
    const btnRegresarSubUsuarios = document.getElementById("btnRegresarSubUsuarios"); // BOTON NUEVO
    const tblUsuarios = document.getElementById("TablaUsuariosContainer");

    if (usuariosCard) {
        usuariosCard.addEventListener("click", function () {
            usuariosCard.style.display = "none";
            if (ubicacionesCard) ubicacionesCard.style.display = "none";
            if (parqueaderosCard) parqueaderosCard.style.display = "none";

            // Cambiamos el titulo
            document.getElementById("titulo-principal").style.display = "none";
            document.getElementById("titulo-usuarios").style.display = "block";
            document.getElementById("titulo-ubicaciones").style.display = "none";
            document.getElementById("titulo-parqueaderos").style.display = "none";

            // Mostramos las card secundarias y el boton
            if (CardsU) CardsU.style.display = "flex";
            //if (CardU1) CardU1.style.display = "block";
            //if (CardU2) CardU2.style.display = "block";
            if (btnRegresarSubUsuarios) btnRegresarSubUsuarios.style.display = "block";

            CardU2.addEventListener("click", function () {
                if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";
                //CardU1.style.display = "none";
                //CardU2.style.display = "none";
                CardsU.style.display = "none";
                if (btnRegresarSubUsuarios) btnRegresarSubUsuarios.style.display = "none"; // Ocultar el boton

                if (tblUsuarios) {
                    tblUsuarios.style.display = "block";
                }
            })
        });
    }

    // =========================== Parqueadero =========================== \\

    //const CardP1 = document.getElementById("CardP1");
    //const CardP2 = document.getElementById("CardP2");
    const CardsP = document.getElementById("SubCardsParqueaderos");
    const btnRegresarSubParqueaderos = document.getElementById("btnRegresarSubParqueaderos"); // BOTON NUEVO
    const tblParqueaderos = document.getElementById("TablaParqueaderosContainer");
    const containerNuevoParqueadero = document.getElementById("ContainerRegistroParqueadero");

    if (parqueaderosCard) {
        parqueaderosCard.addEventListener("click", function (){
            parqueaderosCard.style.display = "none";
            if (usuariosCard) usuariosCard.style.display = "none";
            if (ubicacionesCard) ubicacionesCard.style.display = "none";

            // Cambiamos el titulo
            document.getElementById("titulo-principal").style.display = "none";
            document.getElementById("titulo-usuarios").style.display = "none";
            document.getElementById("titulo-ubicaciones").style.display = "none";
            document.getElementById("titulo-parqueaderos").style.display = "block";

            // Mostramos las card secundarias y el boton
            if (CardsP) CardsP.style.display = "flex";
            //if (CardP1) CardP1.style.display = "block";
            //if (CardP2) CardP2.style.display = "block";
            if (btnRegresarSubParqueaderos) btnRegresarSubParqueaderos.style.display = "block";

            CardP2.addEventListener("click", function () {
                if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";
                //CardP1.style.display = "none";
                //CardP2.style.display = "none";
                CardsP.style.display = "none";
                if (btnRegresarSubParqueaderos) btnRegresarSubParqueaderos.style.display = "none"; // Ocultar el boton

                if (tblParqueaderos) {
                    tblParqueaderos.style.display = "block";
                }
            })

            // (Ubicado donde manejas los clicks de las cards de Parqueadero)
            if (CardP1) {
                CardP1.addEventListener("click", function () {
                    if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";
                    //CardP1.style.display = "none";
                    //CardP2.style.display = "none";
                    CardsP.style.display = "none";
                    if (btnRegresarSubParqueaderos) btnRegresarSubParqueaderos.style.display = "none";

                    // Mostrar el container de registro
                    if (containerNuevoParqueadero) containerNuevoParqueadero.style.display = "block";
                });
            }

            // Validaciones para formulario nuevo parqueadero
            var formNuevoParqueadero = document.getElementById('formNuevoParqueadero');
            if (formNuevoParqueadero) {
                var valParqueadero = [
                    addValidation('nuevo_nombre_parqueadero', 'errorNuevoParqueaderoNombre', function (v) { return v !== ''; }),
                    addValidation('nueva_direccion_parqueadero', 'errorNuevaDireccionParqueadero', function (v) { return v !== ''; }),
                    addValidation('nueva_ciudad_parqueadero', 'errorNuevaCiudadParqueadero', function (v) { return v !== ''; }),
                    addValidation('nueva_tarifa_parqueadero', 'errorNuevaTarifaParqueadero', function (v) { return v !== '' && parseFloat(v) >= 0; })
                ];

                formNuevoParqueadero.addEventListener('submit', function (e) {
                    var isValid = true;
                    valParqueadero.forEach(function (validate) {
                        if (validate && !validate()) isValid = false;
                    });
                    if (!isValid) e.preventDefault();
                });
            }
        });
    }

    // =========================== Modales Genéricos =========================== \\
    
    // Función genérica para abrir modal
    function abrirModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            // Ejecutar validación en tiempo real al abrir el modal
            if (modal.classList.contains('Editar-Ingreso')) {
                setupEstadosIngresoValidation();
            }
            console.log(`✅ Modal abierto: ${modalId}`);
        } else {
            console.error(`❌ Modal no encontrado: ${modalId}`);
        }
    }

    // Función genérica para cerrar modal
    function cerrarModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            console.log(`✅ Modal cerrado: ${modalId}`);
        } else {
            console.error(`❌ Modal no encontrado: ${modalId}`);
        }
    }

    // Exponer funciones globalmente para usarlas desde HTML onclick
    window.abrirModal = abrirModal;
    window.cerrarModal = cerrarModal;

});  // ← Cierre del DOMContentLoaded

// =========================== Usuario =========================== \\

// Modal para editar en tabla usuarios
// Abrir modal y cargar datos del usuario en los inputs
function abrirModalEditarUsuario(id, dni, nombre, apellido, telefono, edad, rol, correo, estadoOrImagenUrl, imagenUrlMaybe) {
    document.getElementById('edit_id_usuario').value = id;
    document.getElementById('edit_dni').value = dni;
    document.getElementById('edit_nombre').value = nombre;
    document.getElementById('edit_apellido').value = apellido;
    document.getElementById('edit_telefono').value = telefono;
    document.getElementById('edit_edad').value = edad;
    document.getElementById('edit_correo').value = correo;

    const selectRol = document.getElementById('edit_rol');
    if (selectRol) {
        selectRol.value = rol.toString();
    }

    const estadoRaw = estadoOrImagenUrl?.toString().toLowerCase();
    const hasEstadoParam = estadoRaw === 'true' || estadoRaw === 'false';
    const estadoValue = hasEstadoParam ? estadoRaw : 'true';
    const imagenUrl = hasEstadoParam ? imagenUrlMaybe : estadoOrImagenUrl;

    const estadoInput = document.getElementById('edit_estado');
    const estadoSelect = document.getElementById('edit_estado_select');
    if (estadoInput) {
        estadoInput.value = estadoValue;
    }
    if (estadoSelect) {
        estadoSelect.value = estadoValue;
    }

    const avatarPreview = document.getElementById('editAvatarPreview');
    const avatarIcon = document.getElementById('editAvatarIcon');
    const avatarBase64Input = document.getElementById('edit_avatar_base64');
    if (avatarPreview && avatarIcon && avatarBase64Input) {
        if (imagenUrl) {
            avatarPreview.src = imagenUrl;
            avatarPreview.style.display = 'block';
            avatarPreview.style.transform = 'scaleX(-1)'; // Aplicar flip para evitar espejo
            avatarIcon.style.display = 'none';
            avatarBase64Input.value = '';
        } else {
            avatarPreview.style.display = 'none';
            avatarPreview.src = ''; 
            avatarIcon.style.display = 'block';
            avatarBase64Input.value = '';
        }
    }

    document.getElementById('ModalEditarUsuario').style.display = 'flex';
}

function cerrarModalEditarUsuario() {
    document.getElementById('ModalEditarUsuario').style.display = 'none';
}

// Alerta de confirmacion para guardar cambios
function confirmarGuardarUsuario() {
    const confirmacion = confirm("¿Estás seguro de que deseas guardar los cambios realizados en este usuario?");
    if (confirmacion) {
        // Obtener el botón y mostrar spinner
        const btnGuardar = event.target;
        const originalHTML = btnGuardar.innerHTML;
        
        // Mostrar spinner
        btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Guardando...';
        btnGuardar.disabled = true;
        
        // Enviar al formulario si el administrador acepta
        document.getElementById("formEditarUsuario").submit();
    }
}

// =========================== Ubicacion =========================== \\

// Modal para editar en tabla usbicaciones
// Abrir modal y cargar datos del usuario en los inputs
function abrirModalEditarUbicacion(id, nombre_ubicacion, direccion, ciudad, valor_servicio) {
    document.getElementById('edit_id_ubicacion').value = id;
    document.getElementById('edit_nombre_ubicacion').value = nombre_ubicacion;
    document.getElementById('edit_direccion').value = direccion;
    document.getElementById('edit_ciudad').value = ciudad;
    document.getElementById('edit_valor_servicio').value = valor_servicio;

    document.getElementById('ModalEditarUbicacion').style.display = 'flex';
}

function cerrarModalEditarUbicacion() {
    document.getElementById('ModalEditarUbicacion').style.display = 'none';
}

// Alerta de confirmacion para guardar cambios
function confirmarGuardarUbicacion() {
    const confirmacion = confirm("¿Estás seguro de que deseas guardar los cambios realizados en esta ubicacion?");
    if (confirmacion) {
        // Enviar al formulario si el admnistrador acepta
        document.getElementById("formEditarUbicacion").submit();
    }
}

// Alerta de confirmacion para eliminar usuario
function confirmarEliminarUbicacion(id) {
    const confirmacion = confirm("⚠️ ADVERTENCIA: ¿Estás seguro de que deseas eliminar permanentemente a esta ubicacion del sistema? Esta acción no se puede deshacer.");
    if (confirmacion) {
        // Pasar el Id al form oculto enviar 
        document.getElementById('delete_id_ubicacion').value = id;
        document.getElementById('formEliminarUbicacion').submit();
    }
}

// =========================== Script para tomar foto de avatar =========================== \\

document.addEventListener('DOMContentLoaded', function () {
    const avatarInput = document.getElementById('editAvatarInput');
    const avatarBtn = document.getElementById('btnTomarFotoAvatar');
    const avatarPreview = document.getElementById('editAvatarPreview');
    const avatarIcon = document.getElementById('editAvatarIcon');
    const avatarBase64 = document.getElementById('edit_avatar_base64');

    if (!avatarInput || !avatarBtn || !avatarPreview || !avatarIcon || !avatarBase64) return;

    avatarBtn.addEventListener('click', function () {
        avatarInput.value = '';
        avatarInput.click();
    });

    avatarInput.addEventListener('change', function (e) {
        const file = e.target.files && e.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = function (ev) {
            const base64 = ev.target.result;
            avatarPreview.src = base64;
            avatarPreview.style.display = 'block';
            avatarPreview.style.transform = 'scaleX(-1)'; // Aplicar flip para evitar espejo
            avatarIcon.style.display = 'none';
            avatarBase64.value = base64;
        };
        reader.readAsDataURL(file);
    });
});
