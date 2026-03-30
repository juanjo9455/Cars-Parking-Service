/**
 * Módulo de captura de cámara para PWA
 * Proporciona funciones reutilizables para acceder a la cámara del dispositivo
 * y capturar fotos en formato base64 o blob
 */

const CameraCapture = (() => {
    let stream = null;
    let videoElement = null;

    /**
     * Inicializa la cámara y muestra el stream en un elemento video
     * @param {string|HTMLVideoElement} videoSelector - ID del elemento o elemento video
     * @param {Object} options - Opciones de configuración
     * @param {string} options.facingMode - 'user' o 'environment' (frontal o trasera)
     * @returns {Promise<void>}
     */
    const initialize = async (videoSelector, options = {}) => {
        const { facingMode = 'user' } = options;

        try {
            // Obtener referencia al elemento video
            if (typeof videoSelector === 'string') {
                videoElement = document.getElementById(videoSelector);
            } else {
                videoElement = videoSelector;
            }

            if (!videoElement) {
                throw new Error('Elemento video no encontrado');
            }

            // Verificar soporte de getUserMedia
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Tu navegador no soporta acceso a la cámara');
            }

            // Solicitar acceso a la cámara
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            // Asignar stream al elemento video
            videoElement.srcObject = stream;

            // Esperar a que el video esté listo
            return new Promise((resolve, reject) => {
                videoElement.onloadedmetadata = () => {
                    videoElement.play()
                        .then(() => resolve())
                        .catch(reject);
                };
                videoElement.onerror = reject;
            });

        } catch (error) {
            handleError(error);
            throw error;
        }
    };

    /**
     * Captura una foto del stream actual
     * @param {Object} options - Opciones de captura
     * @param {string} options.format - 'base64' o 'blob' (por defecto 'base64')
     * @param {number} options.quality - Calidad de la imagen (0-1, por defecto 0.9)
     * @returns {Promise<string|Blob>} - Base64 o Blob según formato especificado
     */
    const capturePhoto = async (options = {}) => {
        const { format = 'base64', quality = 0.9 } = options;

        if (!videoElement || !stream) {
            throw new Error('La cámara no está inicializada. Llama a initialize() primero');
        }

        try {
            const canvas = document.createElement('canvas');
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;

            if (canvas.width === 0 || canvas.height === 0) {
                throw new Error('El video aún no está listo. Intenta nuevamente en unos segundos');
            }

            const context = canvas.getContext('2d');
            context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            return new Promise((resolve, reject) => {
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Error al capturar la imagen'));
                            return;
                        }

                        if (format === 'blob') {
                            resolve(blob);
                        } else if (format === 'base64') {
                            const reader = new FileReader();
                            reader.onload = () => {
                                resolve(reader.result);
                            };
                            reader.onerror = () => {
                                reject(new Error('Error al convertir a base64'));
                            };
                            reader.readAsDataURL(blob);
                        } else {
                            reject(new Error(`Formato no soportado: ${format}`));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            });

        } catch (error) {
            handleError(error);
            throw error;
        }
    };

    /**
     * Obtiene la lista de cámaras disponibles
     * @returns {Promise<Array>} - Lista de dispositivos de vídeo
     */
    const getAvailableCameras = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            handleError(error);
            return [];
        }
    };

    /**
     * Cambia entre cámara frontal y trasera
     * @param {string} facingMode - 'user' o 'environment'
     * @returns {Promise<void>}
     */
    const switchCamera = async (facingMode = 'environment') => {
        try {
            stop();
            await initialize(videoElement, { facingMode });
        } catch (error) {
            handleError(error);
            throw error;
        }
    };

    /**
     * Detiene la cámara y libera los recursos
     */
    const stop = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        if (videoElement) {
            videoElement.srcObject = null;
        }
    };

    /**
     * Verifica si la cámara está activa
     * @returns {boolean}
     */
    const isActive = () => {
        return stream !== null && stream.active;
    };

    /**
     * Maneja errores de la cámara
     * @private
     */
    const handleError = (error) => {
        let message = 'Error desconocido';

        if (error.name === 'NotAllowedError') {
            message = 'Permiso denegado. Verifica los permisos de la cámara en tu dispositivo';
        } else if (error.name === 'NotFoundError') {
            message = 'No se encontró cámara en el dispositivo';
        } else if (error.name === 'NotReadableError') {
            message = 'La cámara está siendo usada por otra aplicación';
        } else if (error.message) {
            message = error.message;
        }

        console.error(`[CameraCapture Error]: ${message}`, error);
    };

    // API pública
    return {
        initialize,
        capturePhoto,
        stop,
        isActive,
        getAvailableCameras,
        switchCamera
    };
})();