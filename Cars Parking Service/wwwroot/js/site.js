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

    // Las cards de páginas aparte (WhatsApp, Despachos y cobros) se muestran/ocultan igual que la de
    // Usuarios (menú principal)
    const cardsPaginasAparte = document.querySelectorAll("#CardWhatsApp, #CardDespachosCobros");
    if (cardsPaginasAparte.length && usuariosCard) {
        new MutationObserver(() => {
            cardsPaginasAparte.forEach(card => card.style.display = usuariosCard.style.display === "none" ? "none" : "");
        }).observe(usuariosCard, { attributes: true, attributeFilter: ["style"] });
    }

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

    // Event listener para toggle de filtros en Tabla_Vehiculos (mobile/desktop)
    const filtersToggle = document.getElementById('filtersToggle');
    if (filtersToggle) {
        filtersToggle.addEventListener('click', function() {
            const filtersWrapper = document.getElementById('filtersWrapper');
            if (filtersWrapper) {
                filtersWrapper.classList.toggle('open');
                const isOpen = filtersWrapper.classList.contains('open');
                this.setAttribute('aria-expanded', isOpen);
            }
        });
    }

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

// Modal para editar en tabla ubicaciones
// Abrir modal y cargar datos de la ubicacion en los inputs
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

// Alerta de confirmacion para deshabilitar ubicacion
function confirmarDeshabilitarUbicacion(id) {
    const confirmacion = confirm("⚠️ ADVERTENCIA: ¿Estás seguro de que deseas deshabilitar permanentemente a esta ubicacion del sistema? Esta acción no se puede deshacer.");
    if (confirmacion) {
        // Pasar el Id al form oculto enviar
        document.getElementById('deshabilitar_id_ubicacion').value = id;
        document.getElementById('formDeshabilitarUbicacion').submit();
    }
}

// =========================== Parqueadero =========================== \\

// Modal para editar en tabla parqueaderos
// Abrir modal y cargar datos del parqueadero en los inputs
function abrirModalEditarParqueadero(id, nombre_parqueadero, direccion, ciudad, tarifa) {
    document.getElementById('edit_id_parqueadero').value = id;
    document.getElementById('edit_nombre_parqueadero').value = nombre_parqueadero;
    document.getElementById('edit_direccion_parqueadero').value = direccion;
    document.getElementById('edit_ciudad_parqueadero').value = ciudad;
    document.getElementById('edit_tarifa_parqueadero').value = tarifa;

    document.getElementById('ModalEditarParqueadero').style.display = 'flex';
}

function cerrarModalEditarParqueadero() {
    document.getElementById('ModalEditarParqueadero').style.display = 'none';
}

// Alerta de confirmacion para guardar cambios
function confirmarGuardarParqueadero() {
    const confirmacion = confirm("¿Estás seguro de que deseas guardar los cambios realizados en este parqueadero?");
    if (confirmacion) {
        // Enviar al formulario si el admnistrador acepta
        document.getElementById("formEditarParqueadero").submit();
    }
}

// Alerta de confirmacion para deshabilitar parqueadero
function confirmarDeshabilitarParqueadero(id) {
    const confirmacion = confirm("⚠️ ADVERTENCIA: ¿Estás seguro de que deseas deshabilitar permanentemente a este parqueadero del sistema? Esta acción no se puede deshacer.");
    if (confirmacion) {
        // Pasar el Id al form oculto enviar
        document.getElementById('delete_id_parqueadero').value = id;
        document.getElementById('formDeshabilitarParqueadero').submit();
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

        // Se reduce como las demás fotos (máx. 1600 px, JPEG): la original de un celular puede pasar los
        // 4 MB por campo que acepta el servidor; entonces no se guardaba y el valet veía un 404.
        // compressImageToBase64 viene de ingreso-vehiculos-camera.js (cargado en la tabla de ingresos)
        const base64 = typeof compressImageToBase64 === 'function'
            ? await compressImageToBase64(file)
            : await fileToDataUrl(file);

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
        <select id="metodo-pago-${id}" onchange="mostrarDatosPago('${id}')" style="width:100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 20px;">
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

        <!-- QR o número de cuenta según el método elegido (en efectivo queda vacío) -->
        <div id="datos-pago-${id}" style="text-align: center; margin-bottom: 20px;"></div>

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

        <!-- Código para comparar con el cliente (OCULTO INICIALMENTE) -->
        <div id="validacion-contenedor-${id}" style="display:none; margin-bottom: 20px;">
            <div class="codigo-operador">
                <span class="codigo-operador-label">Código de seguridad</span>
                <span class="codigo-operador-valor" id="codigo-valor-${id}">------</span>
                <p class="codigo-operador-ayuda">Pídale al cliente que le muestre este mismo código en su celular.</p>
                <button type="button" class="btn btn-link" onclick="generarCodigoSeguridad('${id}')" style="color: #2e7d32; text-decoration: underline;">
                    Generar otro código
                </button>
            </div>

            <!-- Confirmar con el cliente o continuar sin él (sin celular / no solicitó) -->
            <button type="button" class="btn btn-primary" onclick="validarCodigoYAbrir('${id}', '${placa}', '${nombre_cliente}', '${metodo_pago}','modal-acciones', '${estado_servicio}')" style="width: 100%; margin-bottom: 10px;">
                <i class="fa-solid fa-check"></i> Continuar
            </button>

            <div class="modal-actions" style="display: flex; gap: 10px;">
                <button type="button" class="btn btn-secondary" onclick="cerrarModalPago('${id}')" style="flex: 1;">
                    Cancelar
                </button>
            </div>
        </div>
    
    `

    mostrarDatosPago(id);

    if (modalAcciones) { modalAcciones.style.display = 'flex'; }
}

// Muestra el QR (QR) o la cuenta de ahorros (Transferencia); en efectivo no muestra nada
function mostrarDatosPago(id) {
    const metodo = document.getElementById(`metodo-pago-${id}`)?.value;
    const contenedor = document.getElementById(`datos-pago-${id}`);

    if (!contenedor) return;

    if (metodo === 'QR') {
        contenedor.innerHTML = `
            <img src="/img/qr-pago.png" alt="QR para pagar" class="imagen-galeria"
                 style="width: 100%; max-width: 240px; border-radius: 8px; cursor: pointer;" />`;
    } else if (metodo === 'Transferencia') {
        contenedor.innerHTML = `
            <p style="margin: 0;">Cuenta de ahorros Bancolombia</p>
            <p style="margin: 0; font-size: 1.4rem; font-weight: bold;">23681691537</p>`;
    } else {
        contenedor.innerHTML = '';
    }
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

// Contador de expiración activo por ingreso
const intervalosCodigo = {};

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

            window.reproducirSonido?.('codigo');

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

            // Si se generó otro código, el contador anterior no debe borrar el nuevo
            clearInterval(intervalosCodigo[idIngreso]);

            intervalosCodigo[idIngreso] = setInterval(() => {

                contadorElemento.textContent =
                    `El código expira en ${tiempoRestante}s`;

                tiempoRestante--;

                if (tiempoRestante < 0) {

                    clearInterval(intervalosCodigo[idIngreso]);

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

// Validar código (el que el operador ve y comparó con el cliente) y abrir modal final

function validarCodigoYAbrir(idIngreso,placa,nombre_cliente,metodo_pago,modalId,estado_servicio) {

    const codigoValor =
        document.getElementById(`codigo-valor-${idIngreso}`);

    const codigo = codigoValor?.textContent.trim();

    if (!codigo || codigo.length !== 6) {
        mostrarAlertaWhatsApp('El código expiró. Genera otro código.', 'error', 'advertencia');
        return;
    }

    fetch(`/Home/ValidarCodigoSeguridad?id=${idIngreso}&codigo=${codigo}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {

        if (!data.success) {
            mostrarAlertaWhatsApp(data.message || 'Código inválido', 'error');
            return;
        }

        window.reproducirSonido?.('confirmacion');
        abrirModalFinalizacion(idIngreso, placa, nombre_cliente, metodo_pago, modalId, estado_servicio);

    })
    .catch(error => {

        console.error(error);
        mostrarAlertaWhatsApp('Error al validar el código', 'error');

    });
}

// Modal final del cobro (con código confirmado o sin el cliente)
function abrirModalFinalizacion(idIngreso, placa, nombre_cliente, metodo_pago, modalId, estado_servicio) {

        // Se usa el método elegido en el modal (pudo cambiar al generar el código)
        metodo_pago = document.getElementById(`metodo-pago-${idIngreso}`)?.value || metodo_pago;

        cerrarModalPago(idIngreso);

        const modalAcciones =
            document.getElementById(modalId);

        document.getElementById(
            "contenido-modal-acciones"
        ).innerHTML = `

        <span class="close-btn"
                onclick="cerrarModalFinalizacion('${idIngreso}')">
                &times;
        </span>

        <h3>Finalizar Servicio de Vehículo</h3>

        <div class="info-auto"
                style="background:#f9f9f9;
                    padding:15px;
                    border-radius:8px;
                    margin-bottom:20px;">

            <p><strong>Placa:</strong> ${placa}</p>
            <p><strong>Cliente:</strong> ${nombre_cliente}</p>
            <p><strong>Método de Pago:</strong>
                ${metodo_pago ?? "No especificado"}
            </p>
            <p><strong>Estado Actual:</strong>
                ${estado_servicio}
            </p>

        </div>

        ${(metodo_pago === "Transferencia" || metodo_pago == "QR") ? `

            <div class="photo-section">

                <h4 class="photo-title">
                    Foto de la Transferencia
                </h4>

                <button type="button"
                        class="photo-btn"
                        id="tomarFotoTransferenciaBtn">

                    <svg class="camera-icon"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2">

                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>

                        <circle cx="12" cy="13" r="4"></circle>

                    </svg>

                    Tomar Foto

                </button>

                <p class="photo-counter"
                    id="photoCounterTransferencia">

                    0 fotos seleccionadas (max. 1)

                </p>

                <div class="Media-Preview">

                    <div class="photos-preview"
                            id="photosPreviewTransferencia">
                    </div>

                </div>

                <input type="file"
                        id="cameraInputTransferencia"
                        accept="image/*"
                        capture
                        style="display:none;">

                <div id="fotosTransferenciaBase64Container"></div>

            </div>

        ` : ''}

        <div class="modal-actions"
                style="display:flex; gap:10px;">

            <button type="button"
                    class="btn btn-secondary"
                    onclick="cerrarModalFinalizacion('${idIngreso}')">

                Cancelar

            </button>

            <button type="button"
                    class="btn btn-success"
                    onclick="finalizarServicio('${idIngreso}','${metodo_pago}')">

                Finalizar Servicio

            </button>

        </div>
    `;

        modalAcciones.style.display = 'flex';

        if (metodo_pago === "Transferencia" || metodo_pago == "QR" || metodo_pago == "Nequi") {
            inicializarCamaraTransferencia();
        }
}

// Finalizar servicio
function finalizarServicio(idIngreso, metodoPago) {

    const estadoServicio = 'finalizado';

    // Obtener foto si el método es transferencia o QR
    let fotoBase64 = '';

    if (metodoPago === 'Transferencia' || metodoPago === 'QR') {

        const inputFoto = document.querySelector(
            '#fotosTransferenciaBase64Container input[name^="fotoTransferencia"]'
        );

        if (!inputFoto || !inputFoto.value) {
            mostrarAlertaWhatsApp('Debes capturar la foto de la transferencia', 'error');
            return;
        }

        fotoBase64 = inputFoto.value;
    }

    const btnConfirmar = document.querySelector(
        '#modal-acciones .btn-success'
    );

    if (btnConfirmar) {
        btnConfirmar.disabled = true;
        btnConfirmar.innerHTML = 'Procesando...';
    }

    fetch('/Home/FinalizarServicio', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            id: idIngreso,
            estadoServicio: estadoServicio,
            fotoBase64: fotoBase64
        })
    })
    .then(response => response.json())
    .then(data => {

        if (data.success) {

            location.reload();

        } else {

            mostrarAlertaWhatsApp(data.message ||
                'No se pudo finalizar el servicio', 'error');

            if (btnConfirmar) {
                btnConfirmar.disabled = false;
                btnConfirmar.innerHTML = 'Confirmar';
            }
        }

    })
    .catch(error => {

        console.error(error);

        mostrarAlertaWhatsApp('Error al finalizar el servicio', 'error');

        if (btnConfirmar) {
            btnConfirmar.disabled = false;
            btnConfirmar.innerHTML = 'Confirmar';
        }

    });
}

// Validamos la liquidacion

function abrirModalAlerta() {
    const alerta = document.getElementById('alertaPendiente');

    if (alerta) {
        alerta.classList.add('show');
    }
}


function cerrarModalNoLiquidado() {
    document
        .getElementById('modalNoLiquidado')
        .classList.remove('show');
}

// =========================== Eventos para ver informacion del ingreso ============================ \\

// Escapa el texto escrito a mano (nombres, teléfonos, lugares, notas) antes de ponerlo dentro de HTML,
// para que no se interprete como código
function escaparHtml(texto) {
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

async function abrirModalInformacion(btn) {

    console.log("========================================");
    console.log("[INFO] abrirModalInformacion() INICIADA");
    console.log("========================================");

    console.log("[INFO] Botón recibido:", btn);

    const modalAcciones = document.getElementById('modal-acciones');
    const contenido = document.getElementById('contenido-modal-acciones');

    console.log("[INFO] modal-acciones encontrado:", modalAcciones);
    console.log("[INFO] contenido-modal-acciones encontrado:", contenido);

    console.log("[abrirModalInformacion] Se abrirá el modal para mostrar todas las imágenes registradas.");

    if (!modalAcciones || !contenido) {
        console.error("[abrirModalInformacion] No se encontró el modal o el contenedor de contenido.");
        return;
    }


    const idIngreso = btn.dataset.idIngreso;

    console.log("[INFO] ID del ingreso:", idIngreso);

    // Siempre abre en la vista de información, no en la de solicitud
    contenido.classList.remove("modo-solicitud");

    // Marcador visual: estado inicial de carga
    console.log("[abrirModalInformacion] Consultando todas las imágenes en el controlador...");
    contenido.innerHTML = "<p class='texto-cargando'>Cargando informacion...</p>";
    console.log("[INFO] Mostrando modal-acciones...");

    modalAcciones.style.display = 'flex';

    console.log(
        "[INFO] display actual de modal-acciones:",
        modalAcciones.style.display
    );

    try {

        // Hacemos las consultas de las imagenes y videos

        console.log("========================================");
        console.log("[FETCH] Iniciando consultas...");
        console.log("========================================");

        const [respuestaInfo, respuestaImagenes, respuestaVideos] = await Promise.all([
            fetch(`/Home/ObtenerInfoIngreso?idIngreso=${idIngreso}`, { cache: 'no-store' }),
            fetch(`/Home/ObtenerImagenesIngreso?idIngreso=${idIngreso}`),
            fetch(`/Home/ObtenerVideosIngreso?idIngreso=${idIngreso}`)
        ]);

        if (!respuestaInfo.ok)
            throw new Error("No fue posible obtener la información del vehículo.");


        if (!respuestaImagenes.ok)
            throw new Error("No fue posible obtener las imagenes.");

        if (!respuestaVideos.ok)
            throw new Error("No fue posible obtener los videos.");

        const dataImagenes = await respuestaImagenes.json();
        const dataVideos = await respuestaVideos.json();

        contenido.innerHTML = "";

        //========================
        // INFORMACIÓN
        //========================

        const info = await respuestaInfo.json();

        // Muestra el dato (escapado), o un texto gris cuando no existe
        const valor = (texto, vacio) => texto
            ? `<span class="info-valor">${escaparHtml(texto)}</span>`
            : `<span class="info-valor info-vacio">${vacio}</span>`;

        const sinValet = "El valet no ha sido asignado al vehículo";
        const cambioLugar = info.lugarEntrega && info.lugarIngreso && info.lugarEntrega !== info.lugarIngreso;

        // Celular: con un toque se llama desde el celular
        const celular = info.telefono
            ? `<a class="info-valor info-tel" href="tel:${escaparHtml(info.telefono)}"><i class="fa-solid fa-phone"></i> ${escaparHtml(info.telefono)}</a>`
            : valor(null, "Sin número registrado");

        const firma = info.firma
            ? `<div class="info-firma"><img src="${info.firma}" alt="Firma del cliente" /></div>`
            : valor(null, "El cliente no firmó");

        // Solicitud por el operador cuando el cliente llama (el servidor decide si se puede).
        // En VistaKey no se ofrece: los botones de allá traen data-sin-solicitar.
        const puedeSolicitar = info.puedeSolicitar && btn.dataset.sinSolicitar !== 'true';

        const botonSolicitar = puedeSolicitar
            ? `<button type="button" class="info-btn-solicitar" onclick="mostrarSolicitudOperador()">
                   <i class="fa-solid fa-bell-concierge"></i> Solicitar vehículo por el cliente
               </button>`
            : "";

        // Banco y admin asignan valet a un vehículo que no tiene (punto 4). Solo donde está la lista
        // de valets (tabla de ingresos), por eso se revisa que exista la plantilla
        const botonAsignarValet = info.puedeAsignarValet && document.getElementById('plantilla-valets')
            ? `<button type="button" class="info-btn-solicitar" onclick="abrirModalAsignarValet(this)"
                       data-id="${escaparHtml(idIngreso)}"
                       data-placa="${escaparHtml(info.placa ?? "")}"
                       data-cliente="${escaparHtml(info.nombreCliente ?? "")}">
                   <i class="fa-solid fa-user-plus"></i> Asignar valet
               </button>`
            : "";

        // Parquear desde Información (puntos 13 y 18): valet, banco y admin no tienen que ir a VistaKey.
        // El servidor decide con la misma regla del botón del Key; en VistaKey no se muestra (data-sin-solicitar)
        const botonParquear = info.puedeParquear && btn.dataset.sinSolicitar !== 'true'
            ? `<form method="post" action="/Home/ActualizarEstadoKey"
                     onsubmit="this.querySelector('button').disabled = true">
                   <input type="hidden" name="id_ingreso" value="${escaparHtml(idIngreso)}" />
                   <input type="hidden" name="nuevo_estado" value="parqueado" />
                   <input type="hidden" name="volver" value="tabla" />
                   <button type="submit" class="info-btn-solicitar">
                       <i class="fa-solid fa-square-parking"></i> Marcar como parqueado
                   </button>
               </form>`
            : "";

        // Reversar una solicitud hecha por error (punto 21): valet, banco y admin, mientras siga solicitado.
        // En VistaKey no se muestra (data-sin-solicitar)
        const botonReversar = info.puedeReversar && btn.dataset.sinSolicitar !== 'true'
            ? `<button type="button" class="info-btn-solicitar" onclick="reversarSolicitud(${Number(idIngreso)}, this)">
                   <i class="fa-solid fa-rotate-left"></i> Reversar solicitud
               </button>`
            : "";

        const panelSolicitud = puedeSolicitar
            ? `<form class="solicitud-panel" method="post" action="/Home/SolicitarVehiculoOperador"
                     onsubmit="return enviarSolicitudOperador(this)">
                   <h3>Solicitar vehículo</h3>

                   <div class="solicitud-datos">
                       <p><strong>Placa:</strong> ${escaparHtml(info.placa ?? "—")}</p>
                       <p><strong>Cliente:</strong> ${escaparHtml(info.nombreCliente ?? "Sin nombre registrado")}</p>
                   </div>

                   <p class="solicitud-nota">
                       <i class="fa-solid fa-phone"></i> El cliente llamó y no lo solicitó desde su enlace.
                   </p>

                   <input type="hidden" name="id_ingreso" value="${idIngreso}" />

                   <label for="solicitud-lugar">Lugar de entrega</label>
                   <select id="solicitud-lugar" name="lugar_entrega" required
                           data-preseleccion="${escaparHtml(info.lugarIngreso ?? "")}"
                           onchange="cambiarLugarSolicitud(this)">
                       <option value="">Cargando ubicaciones...</option>
                   </select>

                   <input type="text" id="solicitud-lugar-otra" name="lugar_entrega" maxlength="50"
                          placeholder="Escribe el lugar de entrega" hidden disabled />

                   <div class="solicitud-acciones">
                       <button type="button" class="btn btn-secondary" onclick="cancelarSolicitudOperador()">
                           Cancelar
                       </button>
                       <button type="submit" class="btn btn-primary">
                           <i class="fa-solid fa-bell-concierge"></i> Solicitar vehículo
                       </button>
                   </div>
               </form>`
            : "";

        contenido.innerHTML += `
            ${panelSolicitud}

            <div class="info-panel">

                <div class="info-header">
                    <span class="info-placa">${escaparHtml(info.placa ?? "—")}</span>
                </div>

                ${botonSolicitar}
                ${botonAsignarValet}
                ${botonParquear}
                ${botonReversar}

                <h3 class="info-seccion"><i class="fa-solid fa-user"></i> Cliente</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Nombre</span>
                        ${valor(info.nombreCliente, "Sin nombre registrado")}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Celular</span>
                        ${celular}
                    </div>
                </div>

                <h3 class="info-seccion"><i class="fa-regular fa-clock"></i> Tiempos</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Ingreso</span>
                        ${valor(info.fechaIngreso, "—")}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Salida</span>
                        ${valor(info.fechaSalida, "Aún no ha salido")}
                    </div>
                    <div class="info-item info-item-completo">
                        <span class="info-label">Solicitud</span>
                        ${valor(info.fechaSolicitud, "Aún no se ha solicitado")}
                    </div>
                </div>

                <h3 class="info-seccion"><i class="fa-solid fa-user-tie"></i> Operadores</h3>
                <div class="info-grid">
                    <div class="info-item info-item-completo">
                        <span class="info-label">Banco ingreso</span>
                        ${valor(info.banco, "Sin banco registrado")}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Valet parqueo</span>
                        ${valor(info.valetIngreso, sinValet)}
                    </div>
                    <div class="info-item">
                        <span class="info-label">Valet despacho</span>
                        ${valor(info.valetDespacho, sinValet)}
                    </div>
                    <div class="info-item info-item-completo">
                        <span class="info-label">Solicitó</span>
                        ${valor(info.solicitadoPor, "Aún no se ha solicitado")}
                    </div>
                </div>

                <h3 class="info-seccion"><i class="fa-solid fa-location-dot"></i> Lugares</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-label">Lugar de ingreso</span>
                        ${valor(info.lugarIngreso, "—")}
                    </div>
                    <div class="info-item ${cambioLugar ? "info-destacado" : ""}">
                        <span class="info-label">Lugar de entrega${cambioLugar ? " (cambió)" : ""}</span>
                        ${valor(info.lugarEntrega, "—")}
                    </div>
                    <div class="info-item info-item-completo">
                        <span class="info-label">Parqueadero</span>
                        ${valor(info.parqueadero, "Sin parqueadero asignado")}
                    </div>
                </div>

                <h3 class="info-seccion"><i class="fa-solid fa-signature"></i> Firma del cliente</h3>
                ${firma}

            </div>
        `;



        //========================
        // IMÁGENES
        //========================

        // Objetos de valor que se anotaron en el ingreso (texto libre, se escapa)
        const textoObjetos = (info.objetosValor ?? "").trim();
        const sinObjetos = textoObjetos.toLowerCase() === "sin objetos de valor";

        const objetosEscapados = escaparHtml(textoObjetos);

        let objetosValor;

        if (!textoObjetos) {
            objetosValor = `
                <div class="info-objetos info-objetos-vacio">
                    <i class="fa-regular fa-circle-question"></i>
                    <span>No se registraron objetos de valor</span>
                </div>`;
        } else if (sinObjetos) {
            objetosValor = `
                <div class="info-objetos info-objetos-ninguno">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>El vehículo se recibió sin objetos de valor</span>
                </div>`;
        } else {
            objetosValor = `
                <div class="info-objetos">
                    <i class="fa-solid fa-gem"></i>
                    <div>
                        <span class="info-objetos-titulo">Objetos que dejó el cliente</span>
                        <p class="info-objetos-texto">${objetosEscapados}</p>
                    </div>
                </div>`;
        }

        contenido.innerHTML += `
            <h3 class="info-seccion"><i class="fa-solid fa-images"></i> Imágenes</h3>
            <span class="info-label">Objetos de valor</span>
            ${objetosValor}
        `;

        // Comprobante de pago (transferencia / QR), del mismo tamaño que las imágenes
        if (info.fotoTransferencia) {
            contenido.innerHTML += `
                <span class="info-label">Comprobante de pago</span>
                <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(120px,1fr)); gap:10px; margin:4px 0 12px;">
                    <img src="${info.fotoTransferencia}" alt="Comprobante de pago" loading="lazy"
                         class="imagen-galeria"
                         style="width:100%; height:120px; object-fit:cover; border-radius:8px; cursor:pointer;" />
                </div>
            `;
        }

        if (dataImagenes.imagenes.length == 0) {

            contenido.innerHTML += "<p>No hay imágenes registradas.</p>";

        } else {

            const contenedorImagenes = document.createElement("div");

            contenedorImagenes.style.display = "grid";
            contenedorImagenes.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px,1fr))";
            contenedorImagenes.style.gap = "10px";

            dataImagenes.imagenes.forEach((imagen, index) => {

                console.log("[IMAGEN] Creando imagen:", index);
                console.log("[IMAGEN] SRC:", imagen.src);

                const img = document.createElement("img");

                img.src = imagen.src;
                img.style.width = "100%";
                img.style.height = "120px";
                img.style.objectFit = "cover";
                img.style.borderRadius = "8px";
                img.style.cursor = "pointer";

                // Identificamos que este elemento es una imagen de la galería
                img.classList.add("imagen-galeria");

                contenedorImagenes.appendChild(img);

            });


            contenido.appendChild(contenedorImagenes);

        }

        //========================
        // VIDEOS
        //========================

        contenido.innerHTML += `
            <hr style="margin:25px 0;">
            <h3 class="info-seccion"><i class="fa-solid fa-video"></i> Videos</h3>
        `;

        if (dataVideos.videos.length == 0) {

            contenido.innerHTML += "<p>No hay videos registrados.</p>";

        } else {

            // Miniaturas del mismo tamaño que las imágenes; el video solo se descarga al reproducirlo
            const contenedorVideos = document.createElement("div");

            contenedorVideos.style.display = "grid";
            contenedorVideos.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px,1fr))";
            contenedorVideos.style.gap = "10px";

            dataVideos.videos.forEach(video => {

                const reproductor = document.createElement("video");

                reproductor.src = video.src;
                reproductor.controls = true;
                reproductor.preload = "metadata";
                reproductor.playsInline = true;
                reproductor.style.width = "100%";
                reproductor.style.height = "120px";
                reproductor.style.objectFit = "cover";
                reproductor.style.borderRadius = "8px";
                reproductor.style.background = "#000";

                contenedorVideos.appendChild(reproductor);

            });

            contenido.appendChild(contenedorVideos);

        }

    }
    catch (error) {

        console.error(error);

        contenido.innerHTML =
            "<p>Ocurrió un error al obtener la información del vehículo.</p>";

    }
}

// ======================================================
// SOLICITUD DEL VEHÍCULO POR EL OPERADOR (cliente llamó)
// ======================================================

// Cambia el modal de información al panel de confirmación
function mostrarSolicitudOperador() {

    const contenido = document.getElementById('contenido-modal-acciones');
    const select = document.getElementById('solicitud-lugar');

    if (!contenido || !select) return;

    contenido.classList.add('modo-solicitud');

    // Las ubicaciones se cargan una sola vez
    if (select.dataset.cargado === 'true') return;

    fetch(`/Payment/ObtenerUbicaciones?_=${Date.now()}`, { cache: 'no-store' })
        .then(response => response.json())
        .then(data => {

            if (!data.success) throw new Error(data.message);

            select.innerHTML = '<option value="">Selecciona una ubicación</option>';

            // Se preselecciona el lugar donde se ingresó el vehículo
            data.data.forEach(u => {
                const option = document.createElement('option');
                option.value = u.nombre;
                option.textContent = u.nombre;
                option.selected = u.nombre === select.dataset.preseleccion;
                select.appendChild(option);
            });

            // Al final, la opción para escribir un lugar que no es una ubicación del servicio
            const otra = document.createElement('option');
            otra.value = OTRA_UBICACION;
            otra.textContent = 'Otra ubicación…';
            select.appendChild(otra);

            select.dataset.cargado = 'true';
        })
        .catch(error => {
            console.error('[SOLICITUD] Error cargando ubicaciones:', error);
            select.innerHTML = '<option value="">No se pudieron cargar las ubicaciones</option>';
        });
}

// Valor de la opción "Otra ubicación…" del lugar de entrega (no es el nombre de ninguna ubicación)
const OTRA_UBICACION = '__otra__';

// Con "Otra ubicación…" aparece un campo para escribir el lugar de entrega, que puede no ser una
// ubicación del servicio. Solo uno de los dos campos se envía como lugar_entrega.
function cambiarLugarSolicitud(select) {

    const campoOtra = document.getElementById('solicitud-lugar-otra');
    const esOtra = select.value === OTRA_UBICACION;

    select.name = esOtra ? '' : 'lugar_entrega';
    campoOtra.hidden = !esOtra;
    campoOtra.disabled = !esOtra;
    campoOtra.required = esOtra;

    if (esOtra) campoOtra.focus();
}

// Vuelve a la información sin enviar nada
function cancelarSolicitudOperador() {

    const contenido = document.getElementById('contenido-modal-acciones');

    if (contenido) contenido.classList.remove('modo-solicitud');
}

// Evita el doble envío mientras se procesa
function enviarSolicitudOperador(form) {

    const boton = form.querySelector('button[type="submit"]');

    if (boton.disabled) return false;

    boton.disabled = true;
    boton.textContent = 'Solicitando...';

    return true;
}

// Reversar una solicitud hecha por error (punto 21). Se usa desde Información y desde la burbuja.
// El primer toque pide confirmar; el segundo la reversa, sin recargar la página
async function reversarSolicitud(idIngreso, boton) {

    if (boton.dataset.confirmar !== 'true') {
        boton.dataset.confirmar = 'true';
        boton.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Toca de nuevo para reversar';
        return;
    }

    boton.disabled = true;
    boton.textContent = 'Reversando...';

    let data;

    try {
        // redirect 'manual': si la sesión venció no se sigue al login
        const respuesta = await fetch('/Home/ReversarSolicitud', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `id_ingreso=${encodeURIComponent(idIngreso)}`,
            redirect: 'manual'
        });

        data = respuesta.ok
            ? await respuesta.json()
            : { success: false, mensaje: 'No se pudo reversar. Revisa tu sesión e intenta de nuevo.' };
    } catch (error) {
        console.error('Error al reversar la solicitud:', error);
        data = { success: false, mensaje: 'No se pudo reversar. Revisa tu conexión e intenta de nuevo.' };
    }

    mostrarAlertaWhatsApp(data.mensaje, data.success ? 'success' : 'error');

    if (data.success) {
        // Se cierra Información si estaba abierta y se actualizan la tabla y la burbuja
        const modal = document.getElementById('modal-acciones');
        if (modal && modal.style.display !== 'none') cerrarModalAcciones();

        window.refrescarTablaIngresos?.();

        if (typeof cargarSolicitudes === 'function') {
            await cargarSolicitudes();
            mostrarSolicitados();
        }
    } else {
        boton.disabled = false;
        delete boton.dataset.confirmar;
        boton.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Reversar solicitud';
    }
}

function cerrarModalAcciones() {

    console.log("========================================");
    console.log("[MODAL] cerrarModalAcciones()");

    const modalAcciones = document.getElementById('modal-acciones');
    const contenido = document.getElementById('contenido-modal-acciones');

    console.log(
        "[MODAL] modal encontrado:",
        modalAcciones
    );

    console.log(
        "[MODAL] contenido encontrado:",
        contenido
    );

    if (modalAcciones) {
        modalAcciones.style.display = 'none';

        console.log(
            "[MODAL] Modal ocultado."
        );
    }

    if (contenido) {
        contenido.innerHTML = '';
        contenido.classList.remove('modo-solicitud');

        console.log(
            "[MODAL] Contenido limpiado."
        );
    }
}

// ==========================================
// ABRIR VISOR DE IMAGEN
// ==========================================

function abrirVisorImagen(src) {

    console.log("=================================");
    console.log("[VISOR] abrirVisorImagen() EJECUTADA");
    console.log("[VISOR] SRC recibido:", src);

    const visor = document.getElementById("visor-imagen");
    const imagenGrande = document.getElementById("imagen-grande");

    console.log("[VISOR] visor:", visor);
    console.log("[VISOR] imagenGrande:", imagenGrande);

    if (!visor) {
        console.error("[VISOR] ❌ NO existe #visor-imagen");
        return;
    }

    if (!imagenGrande) {
        console.error("[VISOR] ❌ NO existe #imagen-grande");
        return;
    }

    console.log("[VISOR] Asignando SRC a imagen grande...");

    imagenGrande.src = src;

    console.log("[VISOR] Mostrando visor...");

    visor.style.display = "flex";

    console.log("[VISOR] display actual:", visor.style.display);
    console.log("=================================");
}

function cerrarVisorImagen() {

    const visor = document.getElementById("visor-imagen");
    const imagenGrande = document.getElementById("imagen-grande");

    if (visor) {
        visor.style.display = "none";
    }

    if (imagenGrande) {
        imagenGrande.src = "";
    }
}

// ==========================================
// LISTENER DEL CONTENEDOR DE IMÁGENES
// ==========================================

document.addEventListener("click", function (event) {

    console.log("[CLICK GLOBAL] Se detectó un click.");

    const imagen = event.target.closest(".imagen-galeria");

    if (!imagen) {
        console.log("[CLICK GLOBAL] El elemento clickeado no es una imagen de la galería.");
        return;
    }

    console.log("[CLICK GLOBAL] ¡SE CLICKEÓ UNA IMAGEN!");
    console.log("[CLICK GLOBAL] SRC:", imagen.src);

    abrirVisorImagen(imagen.src);
});

// ============ Evento para modal de reenviar whatsApp con la burbuja ============ //

function mostrarAlertaWhatsApp(mensaje, tipo = 'error', sonido) {
    window.reproducirSonido?.(sonido || (tipo === 'success' ? 'confirmacion' : 'error'));

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
}

function validarPlacaWhatsApp(placa) {
    return /^[A-Z]{3}[0-9]{3}$/.test(placa.replace('-', ''));
}

function abrirModalWhatsApp() {

    const modalAcciones = document.getElementById('modal-acciones');
    const contenedor = document.getElementById('contenido-modal-acciones');

    if (modalAcciones) { modalAcciones.style.display = "flex"; }
    if (contenedor) {
        contenedor.innerHTML = `


            <h2>Reenviar Comprobante por WhatsApp</h2>
            <p>Ingresa la placa del vehículo para reenviar la notificación.</p>

            <form id="formReenviarWhatsapp">
                <div class="input-group">
                    <label for="placaReenvio">Placa del Vehículo:</label>
                    <input type="text" id="placaReenvio" name="placa" placeholder="ABC123" maxlength="6" style="text-transform: uppercase;" required>
                    <div class="error-message" id="errorPlacaReenvio">⚠️ La placa es obligatoria (Formato: ABC123)</div>
                </div>

                <!-- Opcional: Permitir actualizar el número si quedó mal digitado -->
                <div class="input-group">
                    <label for="telefonoNuevo">WhatsApp (opcional, si cambió o estuvo mal):</label>
                    <input type="tel" id="telefonoNuevo" name="telefonoNuevo" placeholder="Dejar en blanco para usar el registrado">
                </div>

                <button type="submit" class="btn-submit" onclick="">
                    🚀 Reenviar WhatsApp
                </button>
            </form>

        `

        // Agregar validación y manejo del formulario
        const formReenviar = document.getElementById('formReenviarWhatsapp');
        const placaInput = document.getElementById('placaReenvio');
        const errorPlacaEl = document.getElementById('errorPlacaReenvio');

        if (placaInput) {
            placaInput.addEventListener('input', function () {
                this.value = this.value.toUpperCase();
                if (this.value.trim() === '') {
                    errorPlacaEl.classList.add('visible');
                } else if (!validarPlacaWhatsApp(this.value)) {
                    errorPlacaEl.classList.add('visible');
                } else {
                    errorPlacaEl.classList.remove('visible');
                }
            });

            placaInput.addEventListener('blur', function () {
                if (this.value.trim() === '') {
                    errorPlacaEl.classList.add('visible');
                }
            });
        }

        if (formReenviar) {
            const submitBtn = formReenviar.querySelector('button[type="submit"]');
            const setButtonLoading = (button, isLoading) => {
                if (!button) return;

                if (isLoading) {
                    if (!button.querySelector('.btn-spinner')) {
                        const spinner = document.createElement('span');
                        spinner.className = 'btn-spinner';
                        spinner.setAttribute('aria-hidden', 'true');
                        spinner.innerHTML = '<svg viewBox="25 25 50 50"><circle r="20" cy="50" cx="50"></circle></svg>';
                        button.appendChild(spinner);
                    }

                    button.classList.add('btn-loading-target');
                    button.classList.add('btn-loading');
                    button.disabled = true;
                } else {
                    button.classList.remove('btn-loading');
                    button.disabled = false;
                }
            };

            formReenviar.addEventListener('submit', function (e) {
                e.preventDefault();

                const placa = placaInput.value.trim().toUpperCase();

                // Validar placa
                if (!placa) {
                    mostrarAlertaWhatsApp('❌ La placa es obligatoria', 'error');
                    errorPlacaEl.classList.add('visible');
                    return;
                }

                if (!validarPlacaWhatsApp(placa)) {
                    mostrarAlertaWhatsApp('❌ Formato de placa inválido (ABC123)', 'error');
                    errorPlacaEl.classList.add('visible');
                    return;
                }

                errorPlacaEl.classList.remove('visible');
                setButtonLoading(submitBtn, true);

                // Enviar solicitud al servidor
                const telefonoNuevo = document.getElementById('telefonoNuevo').value.trim();

                const datos = new FormData();
                datos.append('placa', placa);
                if (telefonoNuevo) {
                    datos.append('telefono', telefonoNuevo);
                }

                fetch('/Home/ReenviarWhatsApp', {
                    method: 'POST',
                    body: datos
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        mostrarAlertaWhatsApp('✅ ' + data.message, 'success', 'mensaje');
                        setTimeout(() => {
                            cerrarModalAcciones();
                        }, 2000);
                    } else {
                        mostrarAlertaWhatsApp('❌ ' + (data.message || 'Error al reenviar'), 'error');
                    }
                })
                .catch(error => {
                    console.error('Error:', error);
                    mostrarAlertaWhatsApp('❌ Error al procesar la solicitud', 'error');
                })
                .finally(() => {
                    setButtonLoading(submitBtn, false);
                });
            });
        }
    }

}

