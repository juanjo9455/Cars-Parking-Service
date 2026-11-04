// Contraseñas y foto de usuario. Lo usan Mi perfil (CambiarMiContrasena) y la ventana Editar usuario del
// administrador (CambiarContrasenaUsuario, con el ojo para ver la actual). Cada bloque .bloque-contrasena
// trae en data-url a dónde se envía; el del admin, en data-id-campo, el campo con el id del usuario.
// Cambiar la contraseña pide dos toques: el primero pregunta si está seguro
(function () {
    const token = () => document.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '';

    // Mismas reglas que ErrorContrasena (HomeController)
    function errorContrasena(nueva, confirmar) {
        if (!nueva) return 'Escribe la nueva contraseña.';
        if (nueva.length < 6) return 'La contraseña debe tener al menos 6 caracteres.';
        if (nueva.length > 50) return 'La contraseña puede tener máximo 50 caracteres.';
        if (nueva !== nueva.trim()) return 'La contraseña no puede empezar ni terminar con espacios.';
        if (nueva !== confirmar) return 'La confirmación no coincide con la contraseña.';
        return null;
    }

    // Vuelve al primer toque
    function reiniciar(bloque) {
        bloque.dataset.confirmando = '';

        const aviso = bloque.querySelector('.contrasena-aviso');
        aviso.hidden = true;
        aviso.textContent = '';

        const boton = bloque.querySelector('.btn-cambiar-contrasena');
        boton.textContent = 'Cambiar contraseña';
        boton.classList.remove('confirmando');
        boton.disabled = false;
    }

    // Al abrir la ventana del admin con otro usuario: campos vacíos y la contraseña actual oculta
    window.reiniciarBloqueContrasena = function (bloque) {
        if (!bloque) return;

        // Solo los de contraseña: el bloque del admin también trae el token antiforgery, que no se borra
        bloque.querySelectorAll('.contrasena-actual-admin, .contrasena-actual-propia, .contrasena-nueva, .contrasena-confirmar')
            .forEach(campo => { campo.value = ''; });
        const actual = bloque.querySelector('.contrasena-actual-admin');
        if (actual) actual.type = 'password';
        bloque.querySelector('.btn-ver-contrasena i')?.classList.replace('fa-eye-slash', 'fa-eye');
        delete bloque.dataset.cargada;

        reiniciar(bloque);
    };

    async function cambiarContrasena(bloque) {
        const boton = bloque.querySelector('.btn-cambiar-contrasena');
        const actual = bloque.querySelector('.contrasena-actual-propia');   // solo en Mi perfil
        const nueva = bloque.querySelector('.contrasena-nueva').value;
        const confirmar = bloque.querySelector('.contrasena-confirmar').value;

        const error = (actual && !actual.value ? 'Escribe tu contraseña actual.' : null) || errorContrasena(nueva, confirmar);
        if (error) {
            mostrarAlertaWhatsApp(error, 'error');
            reiniciar(bloque);
            return;
        }

        // Primer toque: pregunta
        if (bloque.dataset.confirmando !== 'true') {
            bloque.dataset.confirmando = 'true';
            const aviso = bloque.querySelector('.contrasena-aviso');
            aviso.textContent = '¿Estás seguro de cambiar la contraseña? Toca de nuevo para confirmar.';
            aviso.hidden = false;
            boton.textContent = 'Sí, cambiar contraseña';
            boton.classList.add('confirmando');
            return;
        }

        // Segundo toque: la cambia
        boton.disabled = true;
        boton.textContent = 'Cambiando...';

        const datos = new FormData();
        datos.append('__RequestVerificationToken', token());
        datos.append('nueva', nueva);
        datos.append('confirmar', confirmar);
        if (actual) datos.append('actual', actual.value);
        if (bloque.dataset.idCampo) datos.append('id_usuario', document.getElementById(bloque.dataset.idCampo).value);

        try {
            const respuesta = await fetch(bloque.dataset.url, { method: 'POST', body: datos });
            const data = await respuesta.json();

            mostrarAlertaWhatsApp(data.mensaje, data.success ? 'success' : 'error');

            if (data.success) {
                window.reiniciarBloqueContrasena(bloque);
                return;
            }
        } catch (error) {
            console.error('Error cambiando la contraseña:', error);
            mostrarAlertaWhatsApp('No se pudo cambiar la contraseña. Recarga la página e intenta otra vez.', 'error');
        }

        reiniciar(bloque);
    }

    // Ojo del admin: la contraseña se pide al servidor solo la primera vez que se toca
    async function verContrasena(bloque, boton) {
        const campo = bloque.querySelector('.contrasena-actual-admin');
        const icono = boton.querySelector('i');

        if (campo.type === 'text') {
            campo.type = 'password';
            icono.classList.replace('fa-eye-slash', 'fa-eye');
            boton.setAttribute('aria-label', 'Ver la contraseña');
            return;
        }

        if (bloque.dataset.cargada !== 'true') {
            try {
                const id = document.getElementById(bloque.dataset.idCampo).value;
                const respuesta = await fetch(`/Home/ContrasenaUsuario?id=${encodeURIComponent(id)}`, { cache: 'no-store' });
                const data = await respuesta.json();

                if (!data.success) {
                    mostrarAlertaWhatsApp(data.mensaje, 'error');
                    return;
                }

                campo.value = data.contrasena;
                campo.placeholder = data.contrasena ? '' : 'Sin contraseña';
                bloque.dataset.cargada = 'true';
            } catch (error) {
                console.error('Error trayendo la contraseña:', error);
                mostrarAlertaWhatsApp('No se pudo traer la contraseña.', 'error');
                return;
            }
        }

        campo.type = 'text';
        icono.classList.replace('fa-eye', 'fa-eye-slash');
        boton.setAttribute('aria-label', 'Ocultar la contraseña');
    }

    document.addEventListener('click', function (e) {
        const cambiar = e.target.closest('.btn-cambiar-contrasena');
        if (cambiar) cambiarContrasena(cambiar.closest('.bloque-contrasena'));

        const ver = e.target.closest('.btn-ver-contrasena');
        if (ver) verContrasena(ver.closest('.bloque-contrasena'), ver);
    });

    // Si cambia lo escrito después del primer toque, hay que volver a confirmar
    document.addEventListener('input', function (e) {
        const bloque = e.target.closest('.bloque-contrasena');
        if (bloque && bloque.dataset.confirmando === 'true') reiniciar(bloque);
    });

    // Achica una foto en el navegador (máximo 600 px por lado, JPEG al 85 %) y devuelve su base64. Una foto de
    // cámara pesa varios MB y pasa el límite de 4 MB de los formularios; así queda en decenas de KB y sin los
    // datos ocultos de la foto (ubicación). La usan Mi perfil y la ventana Editar usuario del admin (site.js)
    window.achicarFotoUsuario = function (archivo) {
        return new Promise(function (resolve, reject) {
            const imagen = new Image();

            imagen.onload = function () {
                const escala = Math.min(1, 600 / Math.max(imagen.width, imagen.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(imagen.width * escala);
                canvas.height = Math.round(imagen.height * escala);
                canvas.getContext('2d').drawImage(imagen, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(imagen.src);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };

            imagen.onerror = function () {
                URL.revokeObjectURL(imagen.src);
                reject(new Error('No se pudo leer la imagen'));
            };

            imagen.src = URL.createObjectURL(archivo);
        });
    };

    // Foto de Mi perfil
    const inputFoto = document.getElementById('perfilFotoInput');
    if (!inputFoto) return;

    document.getElementById('btnPerfilFoto').addEventListener('click', function () {
        inputFoto.value = '';
        inputFoto.click();
    });

    inputFoto.addEventListener('change', function () {
        const archivo = inputFoto.files && inputFoto.files[0];
        if (!archivo || !archivo.type.startsWith('image/')) return;

        window.achicarFotoUsuario(archivo)
            .then(function (base64) {
                document.getElementById('perfilFotoBase64').value = base64;

                const vista = document.getElementById('perfilFotoPreview');
                vista.src = base64;
                vista.style.display = 'block';
                document.getElementById('perfilFotoIcono').style.display = 'none';
            })
            .catch(() => mostrarAlertaWhatsApp('No se pudo leer esa imagen. Elige otra.', 'error'));
    });
})();
