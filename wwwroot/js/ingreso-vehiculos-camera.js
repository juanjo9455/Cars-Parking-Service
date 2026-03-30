/**
 * Lógica de cámara específica para Ingreso de Vehículos
 * Captura múltiples fotos y las guarda como base64
 */
document.addEventListener('DOMContentLoaded', () => {
    const tomarFotoBtn = document.getElementById('tomarFotoBtn');
    const capturePhotoBtn = document.getElementById('capturePhotoBtn');
    const stopCameraBtn = document.getElementById('stopCameraBtn');
    const cameraVideo = document.getElementById('cameraVideo');
    const errorMessageCamera = document.getElementById('error-message-camera');
    const photosPreview = document.getElementById('photosPreview');
    const photoCounter = document.getElementById('photoCounter');
    const fotosBase64Container = document.getElementById('fotosBase64Container');
    
    // Verificar que los elementos existan
    if (!tomarFotoBtn || !capturePhotoBtn || !stopCameraBtn) {
        console.error('❌ No se encontraron los elementos de cámara en el DOM');
        return;
    }

    let cameraActive = false;
    let fotosCapturadas = [];

    const showError = (message) => {
        if (errorMessageCamera) {
            errorMessageCamera.textContent = message;
            errorMessageCamera.style.display = 'block';
            setTimeout(() => {
                errorMessageCamera.style.display = 'none';
            }, 5000);
        }
    };

    const updatePhotoCounter = () => {
        if (photoCounter) {
            photoCounter.textContent = `${fotosCapturadas.length} fotos tomadas`;
        }
    };

    const addPhotoToPreview = (base64Image) => {
        const photoDiv = document.createElement('div');
        photoDiv.style.cssText = 'position: relative; display: inline-block; margin: 10px; border: 2px solid #ddd; border-radius: 8px; overflow: hidden;';
        
        const img = document.createElement('img');
        img.src = base64Image;
        img.style.cssText = 'width: 150px; height: 150px; object-fit: cover; display: block;';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.style.cssText = 'position: absolute; top: 5px; right: 5px; background: #d32f2f; color: white; border: none; border-radius: 50%; width: 30px; height: 30px; cursor: pointer; font-size: 16px;';
        
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const index = fotosCapturadas.indexOf(base64Image);
            if (index > -1) {
                fotosCapturadas.splice(index, 1);
                photoDiv.remove();
                updatePhotoCounter();
                actualizarInputsOcultos();
            }
        });
        
        photoDiv.appendChild(img);
        photoDiv.appendChild(deleteBtn);
        if (photosPreview) {
            photosPreview.appendChild(photoDiv);
        }
    };

    const actualizarInputsOcultos = () => {
        if (!fotosBase64Container) return;
        
        fotosBase64Container.innerHTML = '';
        fotosCapturadas.forEach((foto, index) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `foto_${index}`;
            input.value = foto;
            fotosBase64Container.appendChild(input);
        });
    };

    // Abrir cámara
    tomarFotoBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Verificar que CameraCapture esté disponible
        if (typeof CameraCapture === 'undefined') {
            showError('❌ El módulo de cámara no está cargado. Recarga la página.');
            console.error('CameraCapture no disponible');
            return;
        }

        try {
            if (!cameraActive) {
                await CameraCapture.initialize('cameraVideo', { facingMode: 'environment' });
                cameraActive = true;
                cameraVideo.style.display = 'block';
                tomarFotoBtn.style.display = 'none';
                capturePhotoBtn.style.display = 'inline-block';
                stopCameraBtn.style.display = 'inline-block';
                if (errorMessageCamera) {
                    errorMessageCamera.style.display = 'none';
                }
            }
        } catch (error) {
            showError(error.message);
            console.error('Error al abrir cámara:', error);
        }
    });

    // Capturar foto
    capturePhotoBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        
        if (typeof CameraCapture === 'undefined') {
            showError('❌ El módulo de cámara no está cargado.');
            return;
        }

        try {
            const fotoBase64 = await CameraCapture.capturePhoto({
                format: 'base64',
                quality: 0.95
            });

            fotosCapturadas.push(fotoBase64);
            addPhotoToPreview(fotoBase64);
            updatePhotoCounter();
            actualizarInputsOcultos();

            console.log(`✅ Foto capturada (${fotosCapturadas.length})`);
        } catch (error) {
            showError(`Error al capturar: ${error.message}`);
            console.error('Error en captura:', error);
        }
    });

    // Cerrar cámara
    stopCameraBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (typeof CameraCapture !== 'undefined') {
            CameraCapture.stop();
        }
        
        cameraActive = false;
        cameraVideo.style.display = 'none';
        tomarFotoBtn.style.display = 'inline-block';
        capturePhotoBtn.style.display = 'none';
        stopCameraBtn.style.display = 'none';
    });

    console.log('✅ Script de cámara cargado correctamente');
});