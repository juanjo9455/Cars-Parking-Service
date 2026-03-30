/**
 * Lógica de cámara para tomar fotos y grabar video (usando cámara nativa del dispositivo)
 */
document.addEventListener('DOMContentLoaded', () => {
    const tomarFotoBtn = document.getElementById('tomarFotoBtn');
    const grabarVideoBtn = document.getElementById('grabarVideoBtn');
    const cameraInput = document.getElementById('cameraInput');
    const videoInput = document.getElementById('videoInput');
    const photosPreview = document.getElementById('photosPreview');
    const videoPreviewContainer = document.getElementById('videoPreviewContainer');
    const photoCounter = document.getElementById('photoCounter');
    const fotosBase64Container = document.getElementById('fotosBase64Container');
    const videoBase64Input = document.getElementById('videoBase64Input');
    const errorMedia = document.getElementById('errorMedia');

    if (!tomarFotoBtn || !cameraInput || !photosPreview || !photoCounter || !fotosBase64Container || !grabarVideoBtn || !videoPreviewContainer || !videoBase64Input || !videoInput) {
        return;
    }

    let archivosCapturados = [];
    const MAX_TOTAL = 10;
    let cameraInputClicking = false; // Previene doble click
    let videoBlob = null;
    let videoGrabado = false;

    function actualizarContador() {
        const cantidad = archivosCapturados.length + (videoGrabado ? 1 : 0);
        photoCounter.textContent = `${cantidad} elemento${cantidad === 1 ? '' : 's'} (fotos y/o video) seleccionad${cantidad === 1 ? 'o' : 'os'} (max. ${MAX_TOTAL})`;
        if (cantidad >= MAX_TOTAL) {
            tomarFotoBtn.classList.add('disabled-photo-btn');
            tomarFotoBtn.disabled = true;
            grabarVideoBtn.classList.add('disabled-photo-btn');
            grabarVideoBtn.disabled = true;
        } else {
            tomarFotoBtn.classList.remove('disabled-photo-btn');
            tomarFotoBtn.disabled = false;
            if (!videoGrabado) {
                grabarVideoBtn.classList.remove('disabled-photo-btn');
                grabarVideoBtn.disabled = false;
            }
        }
    }

    function sincronizarInputsOcultos() {
        fotosBase64Container.innerHTML = '';
        archivosCapturados.forEach((archivo, index) => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = `fotos[${index}]`;
            input.value = archivo.base64;
            fotosBase64Container.appendChild(input);
        });
    }

    function renderPreview() {
        photosPreview.innerHTML = '';
        archivosCapturados.forEach((archivo, index) => {
            const previewDiv = document.createElement('div');
            previewDiv.className = 'photo-item';
            const img = document.createElement('img');
            img.src = archivo.base64;
            img.alt = `Foto ${index + 1}`;
            previewDiv.appendChild(img);
            // Botón para eliminar foto
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'delete-photo';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
                archivosCapturados.splice(index, 1);
                renderPreview();
                actualizarContador();
                sincronizarInputsOcultos();
                errorMedia.style.display = 'none';
            });
            previewDiv.appendChild(removeBtn);
            photosPreview.appendChild(previewDiv);
        });
    }

    cameraInput.addEventListener('change', (e) => {
        cameraInputClicking = false;
        const files = Array.from(e.target.files);
        const total = archivosCapturados.length + (videoGrabado ? 1 : 0);
        if (!files.length) return;
        if (total + files.length > MAX_TOTAL) {
            errorMedia.textContent = `Solo puedes subir hasta ${MAX_TOTAL} elementos (fotos y/o video).`;
            errorMedia.style.display = 'block';
            return;
        } else {
            errorMedia.style.display = 'none';
        }
        files.slice(0, MAX_TOTAL - total).forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                archivosCapturados.push({
                    base64: ev.target.result,
                    type: file.type
                });
                renderPreview();
                actualizarContador();
                sincronizarInputsOcultos();
            };
            reader.readAsDataURL(file);
        });
    });

    tomarFotoBtn.addEventListener('click', function(e) {
        if (cameraInputClicking) {
            e.preventDefault();
            return;
        }
        const total = archivosCapturados.length + (videoGrabado ? 1 : 0);
        if (total >= MAX_TOTAL) {
            errorMedia.textContent = `Solo puedes subir hasta ${MAX_TOTAL} elementos (fotos y/o video).`;
            errorMedia.style.display = 'block';
            return;
        } else {
            errorMedia.style.display = 'none';
        }
        cameraInputClicking = true;
        cameraInput.removeAttribute('multiple');
        cameraInput.accept = 'image/*';
        cameraInput.capture = 'environment';
        cameraInput.value = '';
        cameraInput.click();
    });

    // ================= VIDEO NATIVO =================
    function resetVideoPreview() {
        videoPreviewContainer.innerHTML = '';
        videoBase64Input.value = '';
        videoBlob = null;
        videoGrabado = false;
        actualizarContador();
    }

    function showVideoPreview(blob) {
        videoPreviewContainer.innerHTML = '';
        const video = document.createElement('video');
        video.controls = true;
        video.style.width = '80%';
        video.style.maxWidth = '100%';
        video.style.maxHeight = '220px';
        video.style.borderRadius = '10px';
        video.style.display = 'block';
        video.style.margin = '0 auto';
        video.src = URL.createObjectURL(blob);
        // Contenedor para centrar y posicionar el botón
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'center';
        wrapper.style.width = '100%';
        wrapper.appendChild(video);
        // Botón para eliminar video
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'delete-photo';
        removeBtn.textContent = '✕';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '12px';
        removeBtn.style.right = '12px';
        removeBtn.style.zIndex = '2';
        removeBtn.addEventListener('click', () => {
            resetVideoPreview();
        });
        wrapper.appendChild(removeBtn);
        videoPreviewContainer.appendChild(wrapper);
        videoGrabado = true;
        actualizarContador();
        grabarVideoBtn.classList.add('disabled-photo-btn');
        grabarVideoBtn.disabled = true;
    }

    grabarVideoBtn.addEventListener('click', function() {
        if (videoGrabado) return;
        const total = archivosCapturados.length + (videoGrabado ? 1 : 0);
        if (total >= MAX_TOTAL) {
            errorMedia.textContent = `Solo puedes subir hasta ${MAX_TOTAL} elementos (fotos y/o video).`;
            errorMedia.style.display = 'block';
            return;
        }
        errorMedia.style.display = 'none';
        videoInput.value = '';
        videoInput.click();
    });

    videoInput.addEventListener('change', function(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const file = files[0];
        if (!file.type.startsWith('video/')) return;
        // Mostrar preview inmediatamente
        videoPreviewContainer.innerHTML = '';
        const video = document.createElement('video');
        video.controls = true;
        video.style.width = '80%';
        video.style.maxWidth = '100%';
        video.style.maxHeight = '220px';
        video.style.borderRadius = '10px';
        video.style.display = 'block';
        video.style.margin = '0 auto';
        const url = URL.createObjectURL(file);
        video.src = url;
        // Contenedor para centrar y posicionar el botón
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'center';
        wrapper.style.width = '100%';
        wrapper.appendChild(video);
        // Botón para eliminar video
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'delete-photo';
        removeBtn.textContent = '✕';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '12px';
        removeBtn.style.right = '12px';
        removeBtn.style.zIndex = '2';
        removeBtn.addEventListener('click', () => {
            resetVideoPreview();
            URL.revokeObjectURL(url);
        });
        wrapper.appendChild(removeBtn);
        videoPreviewContainer.appendChild(wrapper);
        // Leer base64 para enviar al backend
        const reader = new FileReader();
        reader.onload = function(ev) {
            videoBase64Input.value = ev.target.result;
        };
        reader.readAsDataURL(file);
        // Validar duración cuando se cargan los metadatos
        video.onloadedmetadata = function() {
            const duration = video.duration;
            if (duration > 30.5) {
                errorMedia.textContent = 'El video debe durar máximo 30 segundos. Por favor, graba uno más corto.';
                errorMedia.style.display = 'block';
                videoInput.value = '';
                videoPreviewContainer.innerHTML = '';
                videoBase64Input.value = '';
                videoGrabado = false;
                actualizarContador();
                URL.revokeObjectURL(url);
                return;
            }
            errorMedia.style.display = 'none';
            // Temporizador visual
            const timer = document.createElement('div');
            timer.textContent = `Duración: ${duration.toFixed(1)}s`;
            timer.style.position = 'absolute';
            timer.style.bottom = '12px';
            timer.style.right = '18px';
            timer.style.background = 'rgba(0,0,0,0.7)';
            timer.style.color = '#fff';
            timer.style.padding = '2px 10px';
            timer.style.borderRadius = '8px';
            timer.style.fontSize = '13px';
            timer.style.fontWeight = 'bold';
            timer.style.zIndex = '2';
            wrapper.appendChild(timer);
            videoGrabado = true;
            actualizarContador();
            grabarVideoBtn.classList.add('disabled-photo-btn');
            grabarVideoBtn.disabled = true;
        };
    });

    actualizarContador();
});