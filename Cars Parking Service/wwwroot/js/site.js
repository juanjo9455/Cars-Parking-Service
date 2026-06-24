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

            // SOLO cancelar si hay errores
            if (!isValid) {
                e.preventDefault();
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
    const volverMenuGeneral = document.getElementById("volverMenuGeneral");
    let estadoUsuarios = "principal";
    let estadoUbicaciones = "principal";
    let estadoParqueaderos = "principal";

    // =========================== Usuario =========================== \\

    //const CardU1 = document.getElementById("CardU1");
    //const CardU2 = document.getElementById("CardU2");
    const CardsU = document.getElementById("SubCardsUsuarios");
    const CardU1 = document.getElementById("CardU1");
    const CardU2 = document.getElementById("CardU2");
    const tblUsuarios = document.getElementById("TablaUsuariosContainer");
    const ContainerRegistroUsuarios = document.getElementById("ContainerRegistroUsuarios");


    // Eventos para la card principal

    if (usuariosCard) {
        usuariosCard.addEventListener("click", function () {

            // Cambiamos estado checkPoint
            estadoUsuarios = "subCardsU";

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
            if (volverMenuGeneral) volverMenuGeneral.style.display = "flex";

        });
    }

    // Eventos para la sub card 1

    if (CardU1) {


        CardU1.addEventListener("click", function () {

            estadoUsuarios = "registroU";

            if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";

            CardsU.style.display = "none";

            if (ContainerRegistroUsuarios) {
                ContainerRegistroUsuarios.style.display = "block";
            }

        });

    }

    // Eventos para la sub card 2

    if (CardU2) {

        CardU2.addEventListener("click", function () {

            estadoUsuarios = "tablaU";

            if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";

            CardsU.style.display = "none";

            // Mostrar filtros específicos para usuarios
            window.mostrarFiltrosAdmin('usuarios');

            if (tblUsuarios) {
                tblUsuarios.style.display = "block";
            }
        });

    }

    // Eventos para el boton volver

    if (volverMenuGeneral) {

        volverMenuGeneral.addEventListener("click", function () {

            if (estadoUsuarios == "subCardsU") {

                // Ocultamos las sub card de usuarios
                CardsU.style.display = "none";

                // Mostramos las card principales
                usuariosCard.style.display = "block";
                if (ubicacionesCard) ubicacionesCard.style.display = "block";
                if (parqueaderosCard) parqueaderosCard.style.display = "block";

                // Cambiamos el titulo
                document.getElementById("titulo-principal").style.display = "block";
                document.getElementById("titulo-usuarios").style.display = "none";
                document.getElementById("titulo-ubicaciones").style.display = "none";
                document.getElementById("titulo-parqueaderos").style.display = "none";

                estadoUsuarios = "principal";

                volverMenuGeneral.style.display = "none";

            }

            if (estadoUsuarios == "registroU" || estadoUsuarios == "tablaU") {

                // Ocultamos el formulario ingreso usuarios
                if (ContainerRegistroUsuarios) {
                    ContainerRegistroUsuarios.style.display = "none";
                }

                // Ocultamos filtros admin
                const filtroAdminUsuarios = document.getElementById('filtroAdmin');

                if (filtroAdminUsuarios) {
                    filtroAdminUsuarios.style.display = 'none';
                }

                // Ocultamos la tabla de usuarios
                if (tblUsuarios) {
                    tblUsuarios.style.display = "none";
                }

                // Mostramos las sub card de usuarios
                CardsU.style.display = "flex";

                // Mostramos las card principales
                usuariosCard.style.display = "none";
                if (ubicacionesCard) ubicacionesCard.style.display = "none";
                if (parqueaderosCard) parqueaderosCard.style.display = "none";

                // Cambiamos el titulo
                document.getElementById("titulo-principal").style.display = "none";
                document.getElementById("titulo-usuarios").style.display = "block";
                document.getElementById("titulo-ubicaciones").style.display = "none";
                document.getElementById("titulo-parqueaderos").style.display = "none";

                estadoUsuarios = "subCardsU";

            }

        });

    }



    // =========================== Ubicacion =========================== \\

    // Cards secundarias de acciones de ubicaciones
    const CardUb1 = document.getElementById("CardUb1");
    const CardUb2 = document.getElementById("CardUb2");
    const CardsUb = document.getElementById("SubCardsUbicaciones");
    const tblUbicaciones = document.getElementById("TablaUbicacionesContainer");
    const containerNuevaUbicacion = document.getElementById("ContainerRegistroUbicacion");
    const inputValorServicio = document.getElementById("valor_servicio");
    const btnFreeServicio = document.getElementById("btnFreeServicio");

    let servicioGratis = false;

    if (ubicacionesCard) {
        ubicacionesCard.addEventListener("click", function () {

            // Cambiamos estado checkPoint
            estadoUbicaciones = "subCards";

            ubicacionesCard.style.display = "none";
            if (usuariosCard) usuariosCard.style.display = "none";
            if (parqueaderosCard) parqueaderosCard.style.display = "none";

            // Cambiamos el titulo
            document.getElementById("titulo-principal").style.display = "none";
            document.getElementById("titulo-usuarios").style.display = "none";
            document.getElementById("titulo-ubicaciones").style.display = "block";
            document.getElementById("titulo-parqueaderos").style.display = "none";

            // Mostramos las card secundarias
            if (CardsUb) CardsUb.style.display = "flex";
            if (volverMenuGeneral) volverMenuGeneral.style.display = "flex";

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

    // Eventos para la sub card 1

    if (CardUb1) {

        if (CardUb1) {
            CardUb1.addEventListener("click", function () {

                // Cambiamos estado checkPoint
                estadoUbicaciones = "registro";

                if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";

                CardsUb.style.display = "none";

                // Mostrar el container de registro
                if (containerNuevaUbicacion) containerNuevaUbicacion.style.display = "block";
            });
        }

    }

    // Eventos para la sub card 2

    if (CardUb2) {

        CardUb2.addEventListener("click", function () {

            // Cambiamos estado checkPoint
            estadoUbicaciones = "tabla";

            if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";

            CardsUb.style.display = "none";

            // Mostrar filtros específicos para ubicaciones
            window.mostrarFiltrosAdmin('ubicaciones');

            if (tblUbicaciones) {
                tblUbicaciones.style.display = "block";
            }
        })

    }

    // Eventos para el boton volver

    if (volverMenuGeneral) {

        volverMenuGeneral.addEventListener("click", function () {

            if (estadoUbicaciones == "subCards") {

                // Ocultamos las sub card de usuarios
                CardsUb.style.display = "none";

                // Mostramos las card principales
                ubicacionesCard.style.display = "block";
                if (usuariosCard) usuariosCard.style.display = "block";
                if (parqueaderosCard) parqueaderosCard.style.display = "block";

                // Cambiamos el titulo
                document.getElementById("titulo-principal").style.display = "block";
                document.getElementById("titulo-usuarios").style.display = "none";
                document.getElementById("titulo-ubicaciones").style.display = "none";
                document.getElementById("titulo-parqueaderos").style.display = "none";

                estadoUbicaciones = "principal";

                volverMenuGeneral.style.display = "none";

            }

            if (estadoUbicaciones == "registro" || estadoUbicaciones == "tabla") {

                // Ocultamos el formulario ingreso usuarios
                if (ContainerRegistroUbicacion) {
                    ContainerRegistroUbicacion.style.display = "none";
                }

                // Ocultamos filtros admin
                const filtroAdminUbicaciones = document.getElementById('filtroAdmin');

                if (filtroAdminUbicaciones) {
                    filtroAdminUbicaciones.style.display = 'none';
                }

                // Ocultamos la tabla de usuarios
                if (tblUbicaciones) {
                    tblUbicaciones.style.display = "none";
                }

                // Mostramos las sub card de usuarios
                CardsUb.style.display = "flex";

                // Ocultamos las card principales
                usuariosCard.style.display = "none";
                if (ubicacionesCard) ubicacionesCard.style.display = "none";
                if (parqueaderosCard) parqueaderosCard.style.display = "none";

                // Cambiamos el titulo
                document.getElementById("titulo-principal").style.display = "none";
                document.getElementById("titulo-usuarios").style.display = "none";
                document.getElementById("titulo-ubicaciones").style.display = "block";
                document.getElementById("titulo-parqueaderos").style.display = "none";

                estadoUbicaciones = "subCards";

            }

        });

    }

    // Evento para el input valor_servicio

    if (btnFreeServicio && inputValorServicio) {

        let servicioGratis = false;

        btnFreeServicio.addEventListener("click", function () {

            servicioGratis = !servicioGratis;

            if (servicioGratis) {

                inputValorServicio.value = "";
                inputValorServicio.disabled = true;
                inputValorServicio.required = false;

                inputValorServicio.classList.add("input-disabled");

                btnFreeServicio.textContent = "FREE ✓";

            } else {

                inputValorServicio.disabled = false;
                inputValorServicio.required = true;

                inputValorServicio.classList.remove("input-disabled");

                btnFreeServicio.textContent = "FREE";
            }

        });

    }

    // =========================== Parqueadero =========================== \\

    const CardP1 = document.getElementById("CardP1");
    const CardP2 = document.getElementById("CardP2");
    const CardsP = document.getElementById("SubCardsParqueaderos");
    const tblParqueaderos = document.getElementById("TablaParqueaderosContainer");
    const containerNuevoParqueadero = document.getElementById("ContainerRegistroParqueadero");

    if (parqueaderosCard) {
        parqueaderosCard.addEventListener("click", function () {

            // Cambiamos estado checkPoint
            estadoParqueaderos = "subCards"

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
            if (volverMenuGeneral) volverMenuGeneral.style.display = "flex";

        });
    }

    // Eventos para la sub card 1

    if (CardP1) {

        if (CardP1) {

            CardP1.addEventListener("click", function () {

                // Cambiamos estado checkPoint
                estadoParqueaderos = "registro";

                if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";

                CardsP.style.display = "none";

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

    }

    // Eventos para la sub card 2

    if (CardP2) {

        CardP2.addEventListener("click", function () {

            estadoParqueaderos = "tabla";

            if (tituloAccionesPrincipales) tituloAccionesPrincipales.style.display = "none";

            CardsP.style.display = "none";

            // Mostrar filtros específicos para parqueaderos
            window.mostrarFiltrosAdmin('parqueaderos');

            if (tblParqueaderos) {
                tblParqueaderos.style.display = "block";
            }
        })

    }

    // Eventos para el boton volver

    if (volverMenuGeneral) {

        volverMenuGeneral.addEventListener("click", function () {

            if (estadoParqueaderos == "subCards") {

                // Ocultamos las sub card de usuarios
                CardsP.style.display = "none";

                // Mostramos las card principales
                parqueaderosCard.style.display = "block";
                if (usuariosCard) usuariosCard.style.display = "block";
                if (ubicacionesCard) ubicacionesCard.style.display = "block";

                // Cambiamos el titulo
                document.getElementById("titulo-principal").style.display = "block";
                document.getElementById("titulo-usuarios").style.display = "none";
                document.getElementById("titulo-ubicaciones").style.display = "none";
                document.getElementById("titulo-parqueaderos").style.display = "none";

                estadoParqueaderos = "principal";

                volverMenuGeneral.style.display = "none";

            }

            if (estadoParqueaderos == "registro" || estadoParqueaderos == "tabla") {

                // Ocultamos el formulario ingreso usuarios
                if (ContainerRegistroParqueadero) {
                    ContainerRegistroParqueadero.style.display = "none";
                }

                // Ocultamos filtros admin
                const filtroAdminParqueaderos = document.getElementById('filtroAdmin');

                if (filtroAdminParqueaderos) {
                    filtroAdminParqueaderos.style.display = 'none';
                }

                // Ocultamos la tabla de usuarios
                if (tblParqueaderos) {
                    tblParqueaderos.style.display = "none";
                }

                // Mostramos las sub card de usuarios
                CardsP.style.display = "flex";

                // Ocultamos las card principales
                parqueaderosCard.style.display = "none";
                if (ubicacionesCard) ubicacionesCard.style.display = "none";
                if (usuariosCard) usuariosCard.style.display = "none";

                // Cambiamos el titulo
                document.getElementById("titulo-principal").style.display = "none";
                document.getElementById("titulo-usuarios").style.display = "none";
                document.getElementById("titulo-ubicaciones").style.display = "none";
                document.getElementById("titulo-parqueaderos").style.display = "block";

                estadoParqueaderos = "subCards";

            }

        });

    }


    // =========================== Modales Genéricos =========================== \\
    
    // Función genérica para abrir modal
    function abrirModal(modalId) {
        const modal = document.getElementById(modalId);

        if (modal) {
            modal.style.display = 'flex';
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
        }
    }

    // Exponer globalmente
    window.abrirModal = abrirModal;
    window.cerrarModal = cerrarModal;

    // Función para regresar al menú principal del admin
    window.regresarAlMenuAdmin = function() {
        // Mostrar cards principales
        const adminCardsContainer = document.querySelector('.admin-cards-container');
        if (adminCardsContainer) {
            adminCardsContainer.style.display = 'grid';
        }

        // Ocultar todas las subtarjetas y tablas
        const SubCardsUsuarios = document.getElementById('SubCardsUsuarios');
        const TablaUsuariosContainer = document.getElementById('TablaUsuariosContainer');
        const ContainerRegistroUsuarios = document.getElementById('ContainerRegistroUsuarios');
        const SubCardsUbicaciones = document.getElementById('SubCardsUbicaciones');
        const TablaUbicacionesContainer = document.getElementById('TablaUbicacionesContainer');
        const ContainerRegistroUbicacion = document.getElementById('ContainerRegistroUbicacion');
        const SubCardsParqueaderos = document.getElementById('SubCardsParqueaderos');
        const TablaParqueaderosContainer = document.getElementById('TablaParqueaderosContainer');
        const ContainerRegistroParqueadero = document.getElementById('ContainerRegistroParqueadero');

        if (SubCardsUsuarios) SubCardsUsuarios.style.display = 'none';
        if (TablaUsuariosContainer) TablaUsuariosContainer.style.display = 'none';
        if (ContainerRegistroUsuarios) ContainerRegistroUsuarios.style.display = 'none';
        if (SubCardsUbicaciones) SubCardsUbicaciones.style.display = 'none';
        if (TablaUbicacionesContainer) TablaUbicacionesContainer.style.display = 'none';
        if (ContainerRegistroUbicacion) ContainerRegistroUbicacion.style.display = 'none';
        if (SubCardsParqueaderos) SubCardsParqueaderos.style.display = 'none';
        if (TablaParqueaderosContainer) TablaParqueaderosContainer.style.display = 'none';
        if (ContainerRegistroParqueadero) ContainerRegistroParqueadero.style.display = 'none';

        // Restaurar títulos
        if (usuariosCard) usuariosCard.style.display = 'flex';
        if (ubicacionesCard) ubicacionesCard.style.display = 'flex';
        if (parqueaderosCard) parqueaderosCard.style.display = 'flex';

        document.getElementById("titulo-principal").style.display = "block";
        document.getElementById("titulo-usuarios").style.display = "none";
        document.getElementById("titulo-ubicaciones").style.display = "none";
        document.getElementById("titulo-parqueaderos").style.display = "none";

        // Ocultar filtros
        const filtroAdmin = document.getElementById('filtroAdmin');
        if (filtroAdmin) filtroAdmin.style.display = 'none';

        // Ocultar botón de regreso
        if (volverMenuGeneral) volverMenuGeneral.style.display = 'none';
    };

    // =========================== Filtros Admin (Dinámicos) =========================== \\

    // Mostrar filtros específicos según el tipo de entidad
    window.mostrarFiltrosAdmin = function(tipoFiltro) {
        const filtroAdmin = document.getElementById('filtroAdmin');
        const formUsuarios = document.getElementById('formFiltrosUsuarios');
        const formUbicaciones = document.getElementById('formFiltrosUbicaciones');
        const formParqueaderos = document.getElementById('formFiltrosParqueaderos');

        // Ocultar todos los formularios
        if (formUsuarios) formUsuarios.style.display = 'none';
        if (formUbicaciones) formUbicaciones.style.display = 'none';
        if (formParqueaderos) formParqueaderos.style.display = 'none';

        // Mostrar contenedor de filtros
        if (filtroAdmin) filtroAdmin.style.display = 'block';

        // Mostrar el formulario correspondiente
        switch(tipoFiltro) {
            case 'usuarios':
                if (formUsuarios) formUsuarios.style.display = 'flex';
                break;
            case 'ubicaciones':
                if (formUbicaciones) formUbicaciones.style.display = 'flex';
                break;
            case 'parqueaderos':
                if (formParqueaderos) formParqueaderos.style.display = 'flex';
                break;
        }

        // Resetear toggle a estado cerrado
        const filtersAdminWrapper = document.getElementById('filtersAdminWrapper');
        if (filtersAdminWrapper) {
            filtersAdminWrapper.classList.remove('open');
            const filtersAdminToggle = document.getElementById('filtersAdminToggle');
            if (filtersAdminToggle) {
                filtersAdminToggle.setAttribute('aria-expanded', 'false');
            }
        }
    };

    // Ocultar filtros cuando se muestra la tabla
    window.ocultarFiltrosAdmin = function() {
        const filtroAdmin = document.getElementById('filtroAdmin');
        if (filtroAdmin) filtroAdmin.style.display = 'none';
    };

    // Event listener para toggle de filtros (mobile/desktop)
    const filtersAdminToggle = document.getElementById('filtersAdminToggle');
    if (filtersAdminToggle) {
        filtersAdminToggle.addEventListener('click', function() {
            const filtersAdminWrapper = document.getElementById('filtersAdminWrapper');
            if (filtersAdminWrapper) {
                filtersAdminWrapper.classList.toggle('open');
                const isOpen = filtersAdminWrapper.classList.contains('open');
                this.setAttribute('aria-expanded', isOpen);
            }
        });
    }

    // =========================== Spinner Loading para Botones de Filtros =========================== \\

    // Spinner para botón Buscar
    const btnBuscar = document.getElementById('btnBuscar');
    const formularioFiltros = document.querySelector('form[asp-action="Tabla_Vehiculos"]');

    if (btnBuscar && formularioFiltros) {
        formularioFiltros.addEventListener('submit', function(e) {
            if (!btnBuscar.classList.contains('loading')) {
                e.preventDefault();
                btnBuscar.classList.add('loading');
                btnBuscar.innerHTML = `
                    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span class="btn-text">Buscando...</span>
                `;
                btnBuscar.disabled = true;

                setTimeout(() => {
                    formularioFiltros.submit();
                }, 100);
            }
        });
    }

    // Spinner para botón Limpiar
    const btnLimpiar = document.getElementById('btnLimpiar');

    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', function(e) {
            if (!btnLimpiar.classList.contains('loading')) {
                btnLimpiar.classList.add('loading');
                btnLimpiar.innerHTML = `
                    <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span class="btn-text">Limpiando...</span>
                `;
                btnLimpiar.style.pointerEvents = 'none';

                setTimeout(() => {
                    window.location.href = btnLimpiar.getAttribute('href') || '/Home/Tabla_Vehiculos';
                }, 100);

                e.preventDefault();
            }
        });
    }

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


// =========================== Eventos para asignar valet al servicio sin valet ============================ \\
function abrirModalValet() {

    const modalValet = document.getElementById('modal-valet');

    if (modalValet) {

        modalValet.style.display = "block";

    }

}

function cerrarModalValet() {

    const modalValet = document.getElementById('modal-valet');

    if (modalValet) {

        modalValet.style.display = "none";

    }

}

// abrir modal para tomar foto del vehiculo
function abrirModalFoto(btnOrId) {

    const modalAcciones = document.getElementById('modal-acciones');
    const btn = btnOrId;

    document.getElementById("contenido-modal-acciones").innerHTML = `

        <form method="post" action="/Home/fotoParqueo" id="formFotoParqueo">
            <input type="hidden" name="id_ingreso" id="fotoIdIngreso" />
            <input type="hidden" name="fotoBase64" id="fotoBase64" />

            <span class="close-btn" onclick="cerrarModalFoto()">&times;</span>

            <h3>Evidencia del parqueo</h3>

            <div class="info-auto" style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px;">
                <p><strong>Placa:</strong> <span id="fotoPlaca"></span></p>
                <p><strong>Cliente:</strong> <span id="fotoCliente"></span></p>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:15px;">
                <button type="button" class="photo-btn-2" id="tomarFotoParqueoBtn">
                    <svg class="camera-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    Tomar foto
                </button>
            </div>

            <div class="Media-Preview">
                <div class="photos-preview" id="fotoPreviewParqueo"></div>
            </div>

            <input type="file" id="cameraInputParqueo" accept="image/*" capture="environment" style="display:none;">
            <div class="error-message" id="errorFotoParqueo" style="display:none;"></div>
        </form>

    
    `;
    const btnTomarFoto = document.getElementById("tomarFotoParqueoBtn");
    const cameraInput = document.getElementById("cameraInputParqueo");
    const form = document.getElementById("formFotoParqueo");
    const fotoBase64 = document.getElementById("fotoBase64");
    const fotoPreview = document.getElementById("fotoPreviewParqueo");
    const fotoIdIngreso = document.getElementById("fotoIdIngreso");
    const fotoPlaca = document.getElementById("fotoPlaca");
    const fotoCliente = document.getElementById("fotoCliente");

    btnTomarFoto.addEventListener("click", () => {
        cameraInput.click();
    });

    cameraInput.addEventListener("change", async function (e) {

        const file = e.target.files?.[0];

        if (!file || !file.type.startsWith('image/')) return;

        const base64 = await fileToDataUrl(file);

        fotoBase64.value = base64;

        btnTomarFoto.disabled = true;
        btnTomarFoto.style.backgroundColor = "#b0b0b0";
        btnTomarFoto.style.color = "#666";
        btnTomarFoto.style.cursor = "not-allowed";
        btnTomarFoto.style.opacity = "0.7";
        btnTomarFoto.style.pointerEvents = "none";
        btnTomarFoto.innerHTML = "Procesando...";

        fotoPreview.innerHTML = `
        <div class="photo-item">
            <img src="${base64}"
                 alt="Previsualización"
                 style="max-width:100%; border-radius:10px;">
        </div>
    `;

        setTimeout(() => form.submit(), 150);
    });

    fotoIdIngreso.value = btn.dataset.idIngreso;
    fotoPlaca.textContent = btn.dataset.placa;
    fotoCliente.textContent = btn.dataset.cliente;

    if (modalAcciones) { modalAcciones.style.display = "flex"; }
}

// cerrar modal para tomar foto del vehiculo
function cerrarModalFoto() {
    const modalAcciones = document.getElementById('modal-acciones');
    const fotoBase64 = document.getElementById("fotoBase64");
    const fotoPreview = document.getElementById("fotoPreviewParqueo");
    const errorFoto = document.getElementById("errorFotoParqueo");
    const cameraInput = document.getElementById("cameraInputParqueo");

    if (modalAcciones) modalAcciones.style.display = "none";
    if (fotoBase64) fotoBase64.value = '';
    if (fotoPreview) fotoPreview.innerHTML = '';
    if (errorFoto) errorFoto.style.display = 'none';
    if (cameraInput) cameraInput.value = '';
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// =========================== Eventos para pagar el servicio ============================ \\

// =========================== Flujo Pago y Finalización =========================== \\

// Abrir modal de pago
function abrirModalPago(btn) {
    const modalAcciones = document.getElementById('modal-acciones');
    const id = btn.getAttribute('data-id');
    const placa = btn.getAttribute('data-placa');
    const nombre_cliente = btn.getAttribute('data-cliente');
    const metodo_pago = btn.getAttribute('data-metodo-pago');
    const estado_servicio = btn.getAttribute('data-estado-servicio');

    document.getElementById("contenido-modal-acciones").innerHTML = `
    
        <span class="close-btn" onclick="cerrarModalPago('${id}')">&times;</span>
        <h3>Pago para Vehículo</h3>

        <!-- Información del vehículo -->
        <div class="info-auto" style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <p><strong>Placa:</strong> ${placa}</p>
            <p><strong>Cliente:</strong> ${nombre_cliente}</p>
            <p style="margin-bottom: 0;">
                <strong>Método de Pago Actual:</strong>
                <span id="metodo-pago-actual-${id}">
                    ${metodo_pago || "No especificado"}
                </span>
            </p>
        </div>
        <br />
        <p> Editar Metodo De Pago </p>
        <select id="metodo-pago-${id}" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 20px;">
            <option value="QR" ${metodo_pago === "QR" ? "selected" : ""}>
                QR
            </option>

            <option value="Transferencia" ${metodo_pago === "Transferencia" ? "selected" : ""}>
                Transferencia
            </option>

            <option value="Efectivo" ${metodo_pago === "Efectivo" ? "selected" : ""}>
                Efectivo
            </option>

        </select>
        <br />
        <!-- Generar código de seguridad -->
        <div id="btn-generar-contenedor-${id}" style="margin-bottom: 20px;">
            <button type="button" class="btn btn-primary" onclick="generarCodigoSeguridad('${id}')" style="width: 100%; padding: 10px;">
                <i class="fa-solid fa-key"></i> Generar Código de Seguridad
            </button>
        </div>

        <p id="contador-codigo-${id}"
                style="margin-top:10px; color:red; font-weight:bold;">
        </p>

        <!-- Ingresar código de validación (OCULTO INICIALMENTE) -->
        <div id="validacion-contenedor-${id}" style="display:none; margin-bottom: 20px;">
            <div class="form-group-modal" style="margin-bottom: 20px;">
                <label>Ingresa el código que el cliente confirmó:</label>
                <input type="text" id="codigo-validacion-${id}" placeholder="Ej: 123456" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-size: 16px; letter-spacing: 5px;" maxlength="6">
                <button type="button" id="OtroCodigo" class="btn btn-link" onclick="generarCodigoSeguridad('${id}')" style="margin-top: 10px; color: #2e7d32; text-decoration: underline;">
                    Generar otro código
                </button>
            </div>

            <!-- Botones de validación -->
            <div class="modal-actions" style="display: flex; gap: 10px;">
                <button type="button" class="btn btn-secondary" onclick="cerrarModalPago('${id}')" style="flex: 1;">
                    Cancelar
                </button>
                <button type="button" class="btn btn-primary" onclick="validarCodigoYAbrir('${id}', '${placa}', '${nombre_cliente}', '${metodo_pago}','modal-acciones', '${estado_servicio}')" style="flex: 1;">
                    <i class="fa-solid fa-check"></i> Validar y Continuar
                </button>
            </div>
        </div>
    
    `

    if (modalAcciones) { modalAcciones.style.display = 'flex'; }
}

// Cerrar modal de pago
function cerrarModalPago(idIngreso) {
    const modalAcciones = document.getElementById('modal-acciones');
    
    if (modalAcciones) {
        modalAcciones.style.display = 'none';
        limpiarModalPago(idIngreso);
    }
}

// Cerrar modal de finalización
function cerrarModalFinalizacion(idIngreso) {
    const modalAcciones = document.getElementById('modal-acciones');

    if (modalAcciones) {
        modalAcciones.style.display = 'none';
    }
}

// Limpiar modal de pago
function limpiarModalPago(idIngreso) {

    const codigoValidacion = document.getElementById(`codigo-validacion-${idIngreso}`);

    if (codigoValidacion) {
        codigoValidacion.value = '';
    }

    const codigoGenerado = document.getElementById(`codigo-generado-${idIngreso}`);

    if (codigoGenerado) {
        codigoGenerado.style.display = 'none';
    }

    const validacionContenedor = document.getElementById(`validacion-contenedor-${idIngreso}`);

    if (validacionContenedor) {
        validacionContenedor.style.display = 'none';
    }

    const btnContenedor = document.getElementById(`btn-generar-contenedor-${idIngreso}`);

    if (btnContenedor) {

        btnContenedor.style.display = 'block';

        const btnGenerar = btnContenedor.querySelector('button');

        if (btnGenerar) {
            btnGenerar.disabled = false;
            btnGenerar.innerHTML = '<i class="fa-solid fa-key"></i> Generar Código de Seguridad';
        }
    }

    const metodoSelect = document.getElementById(`metodo-pago-${idIngreso}`);

    if (metodoSelect) {
        metodoSelect.disabled = false;
    }
}

// Generar código de seguridad
function generarCodigoSeguridad(idIngreso) {

    const metodoSelect = document.getElementById(`metodo-pago-${idIngreso}`);

    if (!metodoSelect) return;

    const metodoPago = metodoSelect.value;

    if (!metodoPago) {
        alert('Selecciona un método de pago');
        return;
    }

    const btnContenedor = document.getElementById(`btn-generar-contenedor-${idIngreso}`);
    const btnGenerar = btnContenedor?.querySelector('button');
    const otroCodigo = document.getElementById("OtroCodigo");

    if (otroCodigo) {

        otroCodigo.style

    }

    if (btnGenerar) {
        btnGenerar.disabled = true;
    }

    fetch(`/Home/GenerarCodigoSeguridad?id=${idIngreso}&metodoPago=${metodoPago}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {

        if (data.success) {

            const codigoValor = document.getElementById(`codigo-valor-${idIngreso}`);
            const codigoGenerado = document.getElementById(`codigo-generado-${idIngreso}`);
            const validacionContenedor = document.getElementById(`validacion-contenedor-${idIngreso}`);
            const metodoPagoActual = document.getElementById(`metodo-pago-actual-${idIngreso}`);

            if (codigoValor) {
                codigoValor.textContent = data.codigo;
            }

            if (codigoGenerado) {
                codigoGenerado.style.display = 'none';
            }

            if (validacionContenedor) {
                validacionContenedor.style.display = 'block';
            }

            if (btnContenedor) {
                btnContenedor.style.display = 'none';
            }

            if (metodoPagoActual) {
                metodoPagoActual.textContent = metodoPago;
            }

            metodoSelect.disabled = true;

            const contadorElemento =
                document.getElementById(`contador-codigo-${idIngreso}`);

            let tiempoRestante = 60;

            const intervalo = setInterval(() => {

                contadorElemento.textContent =
                    `El código expira en ${tiempoRestante}s`;

                tiempoRestante--;

                if (tiempoRestante < 0) {

                    clearInterval(intervalo);

                   eliminarCodigoSeguridad(idIngreso);

                }
            }, 1000);

        } else {

            alert('Error: ' + (data.message || 'No se pudo generar el código'));

            if (btnGenerar) {
                btnGenerar.disabled = false;
            }
        }

    })
    .catch(error => {

        console.error('Error:', error);

        alert('Error al generar el código de seguridad');

        if (btnGenerar) {
            btnGenerar.disabled = false;
        }
    });
}

function eliminarCodigoSeguridad(idIngreso) {

    fetch(`/Home/EliminarCodigoSeguridad?id=${idIngreso}`, {
        method: 'POST'
    })
        .then(response => response.json())
        .then(data => {

            if (data.success) {

                const codigoValor =
                    document.getElementById(`codigo-valor-${idIngreso}`);

                const codigoGenerado =
                    document.getElementById(`codigo-generado-${idIngreso}`);

                const contadorElemento =
                    document.getElementById(`contador-codigo-${idIngreso}`);

                if (codigoValor) {
                    codigoValor.textContent = '------';
                }

                if (contadorElemento) {
                    contadorElemento.textContent = 'Código expirado';
                }

                if (codigoGenerado) {

                    setTimeout(() => {

                        codigoGenerado.style.display = 'none';

                    }, 1500);

                }

            } else {

                console.error('No se pudo eliminar el código');

            }

        })
        .catch(error => {

            console.error('Error eliminando código:', error);

        });
}

// Validar código y abrir modal final

function validarCodigoYAbrir(idIngreso, placa, nombre_cliente, metodo_pago, modalId, estado_servicio) {

    const MODO_DEBUG = true; // 👈 activa/desactiva pruebas

    if (MODO_DEBUG) {
        cerrarModalPago(idIngreso);

        const modalAcciones = document.getElementById(modalId);

        document.getElementById("contenido-modal-acciones").innerHTML = `
            <span class="close-btn" onclick="cerrarModalFinalizacion('${idIngreso}')">&times;</span>
            <h3>Finalizar Servicio de Vehículo</h3>

            <div class="info-auto" style="background:#f9f9f9; padding:15px; border-radius:8px; margin-bottom:20px;">
                <p><strong>Placa:</strong> ${placa}</p>
                <p><strong>Cliente:</strong> ${nombre_cliente}</p>
                <p><strong>Método de Pago:</strong> ${metodo_pago ?? "No especificado"}</p>
                <p><strong>Estado Actual:</strong> ${estado_servicio}</p>
            </div>


            ${metodo_pago == "Transferencia" ? `
            

                <!-- ========== FOTO DE LA TRANSACCION ========== -->
                <div class="photo-section">
                    <h4 class="photo-title">Foto De La Tranferencia</h4>

                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button type="button" class="photo-btn" id="tomarFotoTransferenciaBtn">
                            <svg class="camera-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                                <circle cx="12" cy="13" r="4"></circle>
                            </svg>
                            Tomar Foto
                        </button>
                    </div>

                    <p class="photo-counter" id="photoCounterTransferencia">0 fotos seleccionadas (max. 1)</p>
                    
                    <!-- Contenedor padre para fotos y el video -->
                    <div class="Media-Preview">
                        <!-- Contenedor para preview de fotos -->
                        <div class="photos-preview" id="photosPreviewTransferencia"></div>
                    </div>

                    <!-- Input oculto para invocar la cámara nativa del dispositivo SOLO para fotos -->
                    <input type="file" id="cameraInputTransferencia" accept="image/*" capture style="display:none;">

                    <!-- Inputs ocultos para enviar los archivos como base64 -->
                    <div id="fotosTransferenciaBase64Container"></div>
                    <input type="hidden" name="videoBase64" id="videoBase64Input" />
                    <div class="error-message" id="errorMediaTrnasferencia" style="display:none;"></div>
                </div>
            
            
            `: ''}


            <div class="form-group-modal" style="margin-bottom:20px;">
                <label>Estado del Servicio:</label>
                <select id="estado-servicio-${idIngreso}" style="width:100%; padding:8px;">
                    <option value="finalizado">Finalizado</option>
                </select>
            </div>

            <div class="modal-actions" style="display:flex; gap:10px;">
                <button type="button" class="btn btn-secondary" onclick="cerrarModalFinalizacion('${idIngreso}')">
                    Cancelar
                </button>
                <button type="button" class="btn btn-success" onclick="finalizarServicio('${idIngreso}')">
                    Confirmar
                </button>
            </div>
        `;

        modalAcciones.style.display = 'flex';

        if (metodo_pago == "Transferencia") {

            inicializarCamaraTransferencia();

        }


        return;
    }

    // 🔽 flujo normal (con código)
    const codigoInput = document.getElementById(`codigo-validacion-${idIngreso}`);
    if (!codigoInput) return;

    const codigoIngresado = codigoInput.value;

    if (!codigoIngresado || codigoIngresado.length !== 6) {
        alert('Ingresa un código válido de 6 dígitos');
        return;
    }

    fetch(`/Home/ValidarCodigoSeguridad?id=${idIngreso}&codigo=${codigoIngresado}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(r => r.json())
        .then(data => {

            if (!data.success) {
                alert(data.message || 'Código inválido');
                return;
            }

            cerrarModalPago(idIngreso);

            const modalAcciones = document.getElementById(modalId);

            document.getElementById("contenido-modal-acciones").innerHTML = `...`;

            modalAcciones.style.display = 'flex';
        });
}


/*function validarCodigoYAbrir(idIngreso, placa, nombre_cliente, metodo_pago, modalId, estado_servicio) {

    const codigoInput = document.getElementById(`codigo-validacion-${idIngreso}`);

    if (!codigoInput) return;

    const codigoIngresado = codigoInput.value;

    if (!codigoIngresado || codigoIngresado.length !== 6) {
        alert('Ingresa un código válido de 6 dígitos');
        return;
    }

    const btnValidar = document.querySelector(
        `#modal-pago-${idIngreso} button[onclick*="validarCodigoYAbrir"]`
    );

    if (btnValidar) {
        btnValidar.disabled = true;
        btnValidar.innerHTML = 'Validando...';
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

                const modalAcciones = document.getElementById(modalId);

                document.getElementById("contenido-modal-acciones").innerHTML = `

                    <span class="close-btn" onclick="cerrarModalFinalizacion('${idIngreso}')">&times;</span>
                    <h3>Finalizar Servicio de Vehículo</h3>

                    <!-- Información del vehículo -->
                    <div class="info-auto" style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p><strong>Placa:</strong> ${placa}</p>
                        <p><strong>Cliente:</strong> ${nombre_cliente}</p>
                        <p><strong>Método de Pago:</strong> <span id="metodo-pago-final-${idIngreso}">${metodo_pago ?? "No especificado"}</span></p>
                        <p style="margin-bottom: 0;"><strong>Estado Actual:</strong> ${estado_servicio}</p>
                    </div>

                    <!-- Seleccionar estado final -->
                    <div class="form-group-modal" style="margin-bottom: 20px;">
                        <label>Estado del Servicio:</label>
                        <select id="estado-servicio-${idIngreso}" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                            <option value="finalizado">Finalizado</option>
                        </select>
                    </div>

                    <!-- Mostrar estado de pago -->
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #1976d2;"><strong>Estado de Pago: PAGADO ✓</strong></p>
                    </div>

                    <!-- Botones de acción -->
                    <div class="modal-actions" style="display: flex; gap: 10px;">
                        <button type="button" class="btn btn-secondary" onclick="cerrarModalFinalizacion('${idIngreso}')" style="flex: 1;">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-success" onclick="finalizarServicio('${idIngreso}')" style="flex: 1;">
                            <i class="fa-solid fa-check-circle"></i> Confirmar
                        </button>
                    </div>
                
                `;

                if (modalAcciones) { modalAcciones.style.display = 'flex'; }

            } else {

                alert('Error: ' + (data.message || 'Código inválido o expirado'));

                if (btnValidar) {
                    btnValidar.disabled = false;
                    btnValidar.innerHTML = '✓ Validar y Continuar';
                }
            }

        })
        .catch(error => {

            console.error('Error:', error);

            alert('Error al validar el código');

            if (btnValidar) {
                btnValidar.disabled = false;
                btnValidar.innerHTML = '✓ Validar y Continuar';
            }
        });
}
*/
// Finalizar servicio
function finalizarServicio(idIngreso) {

    const estadoServicioSelect = document.getElementById(`estado-servicio-${idIngreso}`);

    if (!estadoServicioSelect) return;

    const estadoServicio = estadoServicioSelect.value;

    if (!estadoServicio) {
        alert('Selecciona un estado para el servicio');
        return;
    }

    const btnConfirmar = document.querySelector(
        `#modal-${idIngreso} button[onclick*="finalizarServicio"]`
    );

    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = 'Procesando...';
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
                    btnConfirmar.innerHTML = '✓ Confirmar';
                }
            }

        })
        .catch(error => {

            console.error('Error:', error);

            alert('Error al finalizar el servicio');

            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = '✓ Confirmar';
            }
        });
}

// Validamos la liquidacion

function abrirModalAlerta() {

    const mostrar = sessionStorage.getItem('mostrarAlertaLiquidacion');

    const alerta = document.getElementById('liquidacionAlert');

    if (alerta) {

        alerta.innerHTML = `
            <div class="liquidacion-alert-card">

                <div class="alert-icon" style="background:#FFF3CD; color:#FF9800;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>

                <h2>Liquidación pendiente</h2>

                <p>
                    Aún no has realizado la liquidación de tu turno.
                    Debes completar la liquidación antes de cerrar sesión.
                </p>

                <button class="alert-btn" onclick="cerrarAlertaLiquidacion()">
                    Entendido
                </button>

            </div>
        `;

        alerta.classList.add('show');
    }

}

function cerrarModalNoLiquidado() {
    document
        .getElementById('modalNoLiquidado')
        .classList.remove('show');
}