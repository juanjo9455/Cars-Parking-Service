document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('ingresoForm');
    const placaInput = document.getElementById('placa');
    const noValuablesBtn = document.getElementById('noValuablesBtn');
    const notasInput = document.getElementById('notas');
    const btnObjetosImagenes = document.getElementById("tomarFotoObjetosBtn");
    const sinObjetosHidden = document.getElementById('sin_objetos_valor_hidden');

    const mostrarAlerta = (mensaje, tipo = 'error') => {
        if (typeof window.mostrarAlertaServidor === 'function') {
            window.mostrarAlertaServidor(mensaje, tipo);
            return;
        }

        window.reproducirSonido?.(tipo === 'success' ? 'confirmacion' : 'error');

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

    // La firma se toma en firma-cliente.js y queda guardada como imagen en #firmaBase64

    // ========== VALIDACIÓN ANTES DE ENVÍO ==========
    // El formulario tiene novalidate: en vez de la burbuja del navegador, cada campo que falta se marca
    // en rojo con su aviso debajo, la alerta dice qué falta y la pantalla baja hasta el primero.
    // Solo se cancela el envío si falta algo; el controlador maneja todo lo demás

    // Marca o limpia un campo (el borde rojo solo en campos, no en los botones de video y firma).
    // El aviso se muestra con la clase .visible (se quita el display en línea que dejan otros scripts,
    // por ejemplo firma-cliente.js al aceptar la firma)
    const marcarCampo = (campo, idError, hayError) => {
        if (campo && campo.tagName !== 'BUTTON') campo.classList.toggle('input-error', hayError);

        const aviso = document.getElementById(idError);
        if (!aviso) return;

        aviso.style.display = '';
        aviso.classList.toggle('visible', hayError);
    };

    const placaValida = valor => /^[A-Z]{3}[0-9]{3}$/.test(valor.toUpperCase());
    const telefonoValido = valor => /^[0-9]{7,15}$/.test(valor.replace(/[\s\-()]/g, ''));

    // Al corregir un campo se le quita el aviso, sin esperar al siguiente intento
    [
        ['placa', 'errorPlaca', placaValida],
        ['nombre_cliente', 'errorNombre', valor => valor !== ''],
        ['telefono', 'errorTelefono', telefonoValido],
        ['id_parqueadero', 'errorParqueadero', valor => valor !== ''],
        ['id_ubicacion', 'errorUbicacion', valor => valor !== '']
    ].forEach(([id, idError, esValido]) => {
        const campo = document.getElementById(id);

        campo?.addEventListener(campo.tagName === 'SELECT' ? 'change' : 'input', () => {
            if (esValido(campo.value.trim())) marcarCampo(campo, idError, false);
        });
    });

    form.addEventListener('submit', function (e) {
        const valor = id => document.getElementById(id)?.value.trim() || '';

        // Lo que falta, en el orden del formulario: nombre para la lista y mensaje si es lo único
        const faltantes = [];

        const revisar = (id, idError, hayError, nombre, mensaje) => {
            const campo = document.getElementById(id);
            marcarCampo(campo, idError, hayError);
            if (hayError) faltantes.push({ campo, nombre, mensaje });
        };

        const videoEsValido = typeof window.videoVehiculoEsValido === 'function'
            ? window.videoVehiculoEsValido()
            : !!valor('videoBase64Input');

        revisar('placa', 'errorPlaca', !placaValida(valor('placa')),
            'la placa', 'Escribe la placa del vehículo (formato ABC123).');
        revisar('nombre_cliente', 'errorNombre', !valor('nombre_cliente'),
            'el nombre del cliente', 'Escribe el nombre del cliente.');
        revisar('telefono', 'errorTelefono', !telefonoValido(valor('telefono')),
            'el WhatsApp', 'Escribe el WhatsApp del cliente (solo números).');
        revisar('id_parqueadero', 'errorParqueadero', !valor('id_parqueadero'),
            'el parqueadero', 'Selecciona el parqueadero donde quedará el vehículo.');
        revisar('id_ubicacion', 'errorUbicacion', !valor('id_ubicacion'),
            'la ubicación', 'Selecciona la ubicación.');
        revisar('grabarVideoBtn', 'errorMedia', !videoEsValido,
            'el video', 'Graba un video del vehículo de mínimo 10 segundos.');
        revisar('btnAbrirFirma', 'errorFirma', !valor('firmaBase64'),
            'la firma del cliente', 'Falta la firma del cliente.');

        // Sin banco en la sesión no hay campo que corregir: hay que volver a entrar
        if (!document.querySelector('input[name="id_banco"]')?.value) {
            faltantes.push({ campo: null, nombre: 'el banco de la sesión', mensaje: 'No se encontró tu sesión. Vuelve a iniciar sesión.' });
        }

        if (faltantes.length === 0) return;   // todo bien: el formulario se envía

        e.preventDefault();

        const nombres = faltantes.map(f => f.nombre);
        const lista = nombres.length > 1
            ? nombres.slice(0, -1).join(', ') + ' y ' + nombres[nombres.length - 1]
            : '';

        mostrarAlerta(faltantes.length === 1 ? faltantes[0].mensaje : `Falta ${lista}.`, 'error');

        faltantes[0].campo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
});

