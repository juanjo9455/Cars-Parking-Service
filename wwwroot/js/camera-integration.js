document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startCameraBtn');
    const captureBtn = document.getElementById('capturePhotoBtn');
    const stopBtn = document.getElementById('stopCameraBtn');
    const videoElement = document.getElementById('cameraVideo');
    const errorDiv = document.getElementById('error-message');
    const previewImg = document.getElementById('photoPreview');
    const previewContainer = document.getElementById('preview-container');
    const photoInfo = document.getElementById('photoInfo');

    let capturedImage = null;

    // Mostrar error
    const showError = (message) => {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    };

    // Iniciar cámara
    startBtn.addEventListener('click', async () => {
        try {
            errorDiv.style.display = 'none';
            await CameraCapture.initialize('cameraVideo', { facingMode: 'user' });
            
            videoElement.style.display = 'block';
            startBtn.style.display = 'none';
            captureBtn.style.display = 'inline-block';
            stopBtn.style.display = 'inline-block';
            previewContainer.style.display = 'none';
        } catch (error) {
            showError(error.message);
        }
    });

    // Capturar foto
    captureBtn.addEventListener('click', async () => {
        try {
            // Capturar como base64
            capturedImage = await CameraCapture.capturePhoto({ 
                format: 'base64',
                quality: 0.95 
            });

            previewImg.src = capturedImage;
            photoInfo.textContent = `Imagen capturada: ${new Date().toLocaleTimeString()}`;
            previewContainer.style.display = 'block';

            // Aquí puedes usar capturedImage en tu lógica existente
            console.log('Imagen capturada:', capturedImage.substring(0, 50) + '...');

            // Ejemplo: enviar a tu backend
            // await sendPhotoToServer(capturedImage);

        } catch (error) {
            showError(`Error al capturar: ${error.message}`);
        }
    });

    // Cerrar cámara
    stopBtn.addEventListener('click', () => {
        CameraCapture.stop();
        videoElement.style.display = 'none';
        startBtn.style.display = 'inline-block';
        captureBtn.style.display = 'none';
        stopBtn.style.display = 'none';
    });

    // Hacer capturedImage disponible globalmente si lo necesitas
    window.getCapturedImage = () => capturedImage;
    window.capturePhotoAsBlob = async () => {
        return await CameraCapture.capturePhoto({ format: 'blob' });
    };
});