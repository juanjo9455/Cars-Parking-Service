/**
 * Módulo de captura de cámara para PWA
 * Proporciona funciones reutilizables para acceder a la cámara del dispositivo
 * y capturar fotos en formato base64 o blob
 */

const CameraCapture = (() => {
    let stream = null;
    let videoElement = null;

    const initialize = async (videoSelector, options = {}) => {
        const { facingMode = 'user' } = options;

        try {
            if (typeof videoSelector === 'string') {
                videoElement = document.getElementById(videoSelector);
            } else {
                videoElement = videoSelector;
            }

            if (!videoElement) {
                throw new Error('Elemento video no encontrado');
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Tu navegador no soporta acceso a la cámara');
            }

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            videoElement.srcObject = stream;

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

    const getAvailableCameras = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.filter(device => device.kind === 'videoinput');
        } catch (error) {
            handleError(error);
            return [];
        }
    };

    const switchCamera = async (facingMode = 'environment') => {
        try {
            stop();
            await initialize(videoElement, { facingMode });
        } catch (error) {
            handleError(error);
            throw error;
        }
    };

    const stop = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }

        if (videoElement) {
            videoElement.srcObject = null;
        }
    };

    const isActive = () => {
        return stream !== null && stream.active;
    };

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

    return {
        initialize,
        capturePhoto,
        stop,
        isActive,
        getAvailableCameras,
        switchCamera
    };
})();

console.log('✅ CameraCapture módulo cargado');