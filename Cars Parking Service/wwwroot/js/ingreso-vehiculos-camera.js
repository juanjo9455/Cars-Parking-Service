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
    const recordTimer = document.getElementById('recordTimer');

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

    // ========== GRABACIÓN DE VIDEO CON API Y MODAL FULLSCREEN (MINIMALISTA, CÁMARA TRASERA, BOTÓN ELIMINAR) ==========
    const videoModal = document.getElementById('videoModal');
    const liveVideo = document.getElementById('liveVideo');
    const startRecordingBtn = document.getElementById('startRecordingBtn');
    const stopRecordingBtn = document.getElementById('stopRecordingBtn');
    const closeVideoModalBtn = document.getElementById('closeVideoModalBtn');
    const videoReviewSection = document.getElementById('videoReviewSection');
    const recordedVideo = document.getElementById('recordedVideo');
    const acceptVideoBtn = document.getElementById('acceptVideoBtn');
    const deleteVideoBtn = document.getElementById('deleteVideoBtn');
    const recordProgressBar = document.getElementById('recordProgressBar');

    let mediaStream = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let timerInterval = null;
    let secondsElapsed = 0;
    const MAX_SECONDS = 30;

    if (typeof grabarVideoBtn !== 'undefined' && grabarVideoBtn) {
        grabarVideoBtn.addEventListener('click', function() {
            if (videoGrabado) return; // Solo un video permitido
            videoModal.style.display = 'flex';
            videoReviewSection.style.display = 'none';
            startRecordingBtn.style.display = '';
            stopRecordingBtn.style.display = 'none';
            recordProgressBar.style.width = '0%';
            recordTimer.textContent = '00:00';
            liveVideo.style.display = '';
            recordedVideo.style.display = 'none';
            acceptVideoBtn.style.display = 'none';
            if(deleteVideoBtn) deleteVideoBtn.style.display = 'none';
            // Cámara trasera preferida, SIN AUDIO
            navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } }, audio: false })
                .then(stream => {
                    mediaStream = stream;
                    liveVideo.srcObject = stream;
                })
                .catch(err => {
                    // fallback a cualquier cámara si la trasera no está disponible
                    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                        .then(stream => {
                            mediaStream = stream;
                            liveVideo.srcObject = stream;
                        })
                        .catch(err2 => {
                            alert('No se pudo acceder a la cámara: ' + err2);
                            videoModal.style.display = 'none';
                        });
                });
        });
    }

    if (typeof startRecordingBtn !== 'undefined' && startRecordingBtn) {
        startRecordingBtn.addEventListener('click', function() {
            if (!mediaStream) return;
            recordedChunks = [];
            mediaRecorder = new MediaRecorder(mediaStream, { mimeType: 'video/webm;codecs=vp8,opus' });
            mediaRecorder.ondataavailable = e => {
                if (e.data.size > 0) recordedChunks.push(e.data);
            };
            mediaRecorder.onstop = handleRecordingStop;
            mediaRecorder.start();
            startRecordingBtn.style.display = 'none';
            stopRecordingBtn.style.display = '';
            recordProgressBar.style.width = '0%';
            secondsElapsed = 0;
            recordTimer.textContent = '00:00';
            timerInterval = setInterval(() => {
                secondsElapsed++;
                recordProgressBar.style.width = `${(secondsElapsed / MAX_SECONDS) * 100}%`;
                recordTimer.textContent = `00:${secondsElapsed.toString().padStart(2, '0')}`;
                if (secondsElapsed >= MAX_SECONDS) {
                    stopRecording();
                }
            }, 1000);
        });
    }

    if (typeof stopRecordingBtn !== 'undefined' && stopRecordingBtn) {
        stopRecordingBtn.addEventListener('click', stopRecording);
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        stopRecordingBtn.style.display = 'none';
        clearInterval(timerInterval);
        recordProgressBar.style.width = '100%';
    }

    if (typeof closeVideoModalBtn !== 'undefined' && closeVideoModalBtn) {
        closeVideoModalBtn.addEventListener('click', function() {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
                mediaStream = null;
            }
            videoModal.style.display = 'none';
            liveVideo.srcObject = null;
            clearInterval(timerInterval);
            recordProgressBar.style.width = '0%';
        });
    }

    if (typeof deleteVideoBtn !== 'undefined' && deleteVideoBtn) {
        deleteVideoBtn.addEventListener('click', function() {
            // Cierra el modal completamente, igual que la X principal
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
                mediaStream = null;
            }
            videoModal.style.display = 'none';
            liveVideo.srcObject = null;
            clearInterval(timerInterval);
            recordProgressBar.style.width = '0%';
            videoReviewSection.style.display = 'none';
            startRecordingBtn.style.display = '';
            stopRecordingBtn.style.display = 'none';
            recordedVideo.src = '';
            acceptVideoBtn.style.display = 'none';
            deleteVideoBtn.style.display = 'none';
            grabarVideoBtn.classList.remove('disabled-photo-btn');
            grabarVideoBtn.disabled = false;
            videoGrabado = false;
        });
    }

    function handleRecordingStop() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        liveVideo.style.display = 'none';
        videoReviewSection.style.display = 'flex';
        recordedVideo.style.display = '';
        recordedVideo.src = url;
        acceptVideoBtn.style.display = '';
        if(deleteVideoBtn) deleteVideoBtn.style.display = '';
        grabarVideoBtn.classList.add('disabled-photo-btn');
        grabarVideoBtn.disabled = true;
        videoGrabado = true;
        acceptVideoBtn.onclick = function() {
            videoPreviewContainer.innerHTML = '';
            const preview = document.createElement('video');
            preview.controls = true;
            preview.style.width = '80%';
            preview.style.maxWidth = '100%';
            preview.style.maxHeight = '220px';
            preview.style.borderRadius = '10px';
            preview.style.display = 'block';
            preview.style.margin = '0 auto';
            preview.src = url;
            // Botón eliminar video en preview principal
            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'delete-photo';
            removeBtn.textContent = '✕';
            removeBtn.onclick = function() {
                videoPreviewContainer.innerHTML = '';
                videoBase64Input.value = '';
                grabarVideoBtn.classList.remove('disabled-photo-btn');
                grabarVideoBtn.disabled = false;
                videoGrabado = false;
            };
            preview.style.position = 'relative';
            videoPreviewContainer.appendChild(preview);
            videoPreviewContainer.appendChild(removeBtn);
            const reader = new FileReader();
            reader.onload = function(ev) {
                videoBase64Input.value = ev.target.result;
            };
            reader.readAsDataURL(blob);
            videoModal.style.display = 'none';
            recordedVideo.src = '';
            liveVideo.srcObject = null;
            recordProgressBar.style.width = '0%';
        };
        // Eliminar video desde modal
        if(deleteVideoBtn) deleteVideoBtn.onclick = function() {
            videoReviewSection.style.display = 'none';
            startRecordingBtn.style.display = '';
            stopRecordingBtn.style.display = 'none';
            recordProgressBar.style.width = '0%';
            recordedVideo.src = '';
            acceptVideoBtn.style.display = 'none';
            deleteVideoBtn.style.display = 'none';
            liveVideo.style.display = '';
            if (mediaStream) {
                liveVideo.srcObject = mediaStream;
            }
            grabarVideoBtn.classList.remove('disabled-photo-btn');
            grabarVideoBtn.disabled = false;
            videoGrabado = false;
        };
    }

    actualizarContador();
});