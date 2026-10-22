// Sonidos del flujo: se precargan una vez y se reproducen con reproducirSonido('tipo')
(function () {

    const archivos = {
        solicitud: '/sounds/Solicitud.wav',
        confirmacion: '/sounds/Confirmacion.wav',
        error: '/sounds/Error.wav',
        advertencia: '/sounds/Advertencia.mp3',
        codigo: '/sounds/Advertencia.mp3',
        pago: '/sounds/Pago.mp3',
        mensaje: '/sounds/Reenviado.wav'
    };

    // Cada sonido vibra con su propio patrón, para notarlo con el celular en silencio o en el bolsillo.
    // En milisegundos: vibra, pausa, vibra... (iPhone no deja vibrar desde una página web)
    const vibraciones = {
        solicitud: [400, 150, 400, 150, 400],
        confirmacion: [120],
        error: [250, 100, 250],
        advertencia: [300, 150, 300],
        codigo: [300, 150, 300],
        pago: [150, 80, 150, 80, 400],
        mensaje: [100, 80, 100]
    };

    const audios = {};

    for (const tipo in archivos) {
        audios[tipo] = new Audio(archivos[tipo]);
        audios[tipo].preload = 'auto';
    }

    // Devuelve true si sonó; sin un toque previo del usuario el navegador lo bloquea y devuelve false.
    // Vibra solo cuando suena: así no vibra de nuevo en cada reintento de sonarSiHayNuevos
    window.reproducirSonido = function (tipo) {
        const audio = audios[tipo];
        if (!audio) return Promise.resolve(false);

        audio.usado = true;
        audio.muted = false;
        audio.currentTime = 0;

        return audio.play().then(() => {
            try { navigator.vibrate?.(vibraciones[tipo]); } catch { }
            return true;
        }, () => {
            audio.usado = false;
            return false;
        });
    };

    // iPhone solo deja sonar un audio que antes se reprodujo dentro de un toque: se habilitan todos en silencio
    document.addEventListener('pointerdown', function () {
        for (const tipo in audios) {
            const audio = audios[tipo];
            if (audio.usado) continue;

            audio.muted = true;
            audio.play()
                .then(() => {
                    if (!audio.usado) {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                })
                .catch(() => { })
                .finally(() => { audio.muted = false; });
        }
    }, { once: true });

    // Suena una sola vez por cada id nuevo, aunque se recargue la página.
    // Si el navegador bloqueó el sonido, no se marca como avisado y se intenta en la siguiente consulta.
    window.sonarSiHayNuevos = function (clave, ids, tipo) {
        let avisados = [];
        try { avisados = JSON.parse(localStorage.getItem(clave)) || []; } catch { }

        const guardar = () => {
            // Solo se recuerdan los pendientes actuales
            try { localStorage.setItem(clave, JSON.stringify(ids)); } catch { }
        };

        if (!ids.some(id => !avisados.includes(id))) {
            guardar();
            return;
        }

        window.reproducirSonido(tipo).then(sono => { if (sono) guardar(); });
    };

})();
