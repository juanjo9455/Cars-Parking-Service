/**
 * Lógica de cámara para grabar video del vehículo y tomar fotos de objetos de valor
 */
document.addEventListener('DOMContentLoaded', () => {

    // =============== Vehiculo Camara =============== //

    const grabarVideoBtn = document.getElementById('grabarVideoBtn');
    const videoPreviewContainer = document.getElementById('videoPreviewContainer');
    const photoCounter = document.getElementById('photoCounter');
    const videoBase64Input = document.getElementById('videoBase64Input');
    const errorMedia = document.getElementById('errorMedia');
    const recordTimer = document.getElementById('recordTimer');

    // =============== Objetos de valor Camara =============== //

    const tomarFotoObjetosBtn =
        document.getElementById('tomarFotoObjetosBtn');

    const cameraInputObjetos =
        document.getElementById('cameraInputObjetos');

    const photosPreviewObjetos =
        document.getElementById('photosPreviewObjetos');

    const fotosObjetosBase64Container =
        document.getElementById('fotosObjetosBase64Container');

    const photoCounterObjetos =
        document.getElementById('photoCounterObjetos');

    if (!photoCounter || !grabarVideoBtn || !videoPreviewContainer || !videoBase64Input || !errorMedia || !recordTimer) {
        return;
    }

    let videoBlob = null;
    let videoGrabado = false;

    let archivosObjetosCapturados = [];
    let cameraInputObjetosClicking = false; // Previene doble click
    const MAX_OBJETOS = 5; // Máximo de imágenes para objetos de valor

    function actualizarContador() {
        const cantidad = videoGrabado ? 1 : 0;
        photoCounter.textContent = `${cantidad} video${cantidad === 1 ? '' : 's'} seleccionado${cantidad === 1 ? '' : 's'} (max. 1)`;

        if (videoGrabado) {
            grabarVideoBtn.classList.add('disabled-photo-btn');
            grabarVideoBtn.disabled = true;
        } else {
            grabarVideoBtn.classList.remove('disabled-photo-btn');
            grabarVideoBtn.disabled = false;
        }
    }

    function actualizarContadorObjetos() {
        const cantidad = archivosObjetosCapturados.length;
        if (photoCounterObjetos) {
            photoCounterObjetos.textContent = `${cantidad} imagen${cantidad === 1 ? '' : 'es'} seleccionada${cantidad === 1 ? '' : 's'} (max. ${MAX_OBJETOS})`;
        }
    }

    function sincronizarInputsObjetosOcultos() {

        // Limpiamos input
        fotosObjetosBase64Container.innerHTML = '';

        archivosObjetosCapturados.forEach((archivo, index) => {

            const input = document.createElement('input');

            input.type = 'hidden';
            input.name = `fotosObjetos[${index}]`;

            input.value = archivo.base64;

            fotosObjetosBase64Container.appendChild(input);

        });

    }

    function renderPreviewObjetos() {

        // Limpiamos input
        photosPreviewObjetos.innerHTML = '';

        archivosObjetosCapturados.forEach((archivo, index) => {

            const previewDiv = document.createElement('div');

            previewDiv.className = 'photo-item';

            const img = document.createElement('img');

            img.src = archivo.base64;
            img.alt = `Objeto ${index + 1}`;

            previewDiv.appendChild(img);

            const removeBtn = document.createElement('button');

            removeBtn.type = 'button';
            removeBtn.className = 'delete-photo';
            removeBtn.textContent = 'X';

            removeBtn.addEventListener('click', () => {

                archivosObjetosCapturados.splice(index, 1);

                renderPreviewObjetos();

                sincronizarInputsObjetosOcultos();

                actualizarContadorObjetos();

            });

            previewDiv.appendChild(removeBtn);

            photosPreviewObjetos.appendChild(previewDiv)

        });

        actualizarContadorObjetos();
    }

    if (tomarFotoObjetosBtn && cameraInputObjetos && photosPreviewObjetos && fotosObjetosBase64Container) {
        cameraInputObjetos.addEventListener('change', async (e) => {

            cameraInputObjetosClicking = false;

            const files = Array.from(e.target.files);

            if (!files.length) return;

            // Validar que no se exceda el máximo de imágenes
            if (archivosObjetosCapturados.length + files.length > MAX_OBJETOS) {
                alert(`Solo puedes subir hasta ${MAX_OBJETOS} imágenes para objetos de valor.`);
                cameraInputObjetos.value = '';
                return;
            }

            for (const file of files) {

                if (!file.type.startsWith('image/')) continue;

                const compressedBase64 = await compressImageToBase64(file);

                archivosObjetosCapturados.push({
                    base64: compressedBase64,
                    type: 'image/jpeg'
                });
            }

            renderPreviewObjetos();
            sincronizarInputsObjetosOcultos();
            actualizarContadorObjetos();

        });

        tomarFotoObjetosBtn.addEventListener('click', function (e) {

            if (cameraInputObjetosClicking) {

                e.preventDefault();
                return;

            }

            // Validar que no se haya alcanzado el máximo antes de abrir la cámara
            if (archivosObjetosCapturados.length >= MAX_OBJETOS) {
                alert(`Ya has alcanzado el máximo de ${MAX_OBJETOS} imágenes para objetos de valor.`);
                return;
            }

            cameraInputObjetosClicking = true;

            cameraInputObjetos.removeAttribute('multiple');
            cameraInputObjetos.accept = 'image/*';
            cameraInputObjetos.capture = 'enviroment';
            cameraInputObjetos.value = '';

            cameraInputObjetos.click();

        });
    }

    // ================= VIDEO NATIVO =================
    function resetVideoPreview() {
        videoPreviewContainer.innerHTML = '';
        videoBase64Input.value = '';
        videoBlob = null;
        videoGrabado = false;
        actualizarContador();
    }

    function getPreviewWrapperWidth() {
        return window.matchMedia('(max-width: 768px)').matches ? '100%' : '98%';
    }

    function showVideoPreview(blob) {
        videoPreviewContainer.innerHTML = '';
        const video = document.createElement('video');
        video.controls = true;
        video.style.width = '100%';
        video.style.maxWidth = '100%';
        video.style.maxHeight = '220px';
        video.style.borderRadius = '10px';
        video.style.display = 'block';
        video.style.margin = '0 auto';

        video.src = URL.createObjectURL(blob);

        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'flex';
        wrapper.style.justifyContent = 'center';
        wrapper.style.alignItems = 'center';
        wrapper.style.width = getPreviewWrapperWidth();
        wrapper.appendChild(video);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'delete-photo';
        removeBtn.textContent = '✕';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '8px';
        removeBtn.style.right = '8px';
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
            preview.style.width = '100%';
            preview.style.maxWidth = '100%';
            preview.style.maxHeight = '220px';
            preview.style.borderRadius = '10px';
            preview.style.display = 'block';
            preview.style.margin = '0 auto';
            preview.src = url;

            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.display = 'flex';
            wrapper.style.justifyContent = 'center';
            wrapper.style.alignItems = 'center';
            wrapper.style.width = getPreviewWrapperWidth();
            wrapper.appendChild(preview);

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'delete-photo';
            removeBtn.textContent = '✕';
            removeBtn.style.position = 'absolute';
            removeBtn.style.top = '8px';
            removeBtn.style.right = '8px';
            removeBtn.style.zIndex = '2';
            removeBtn.onclick = function() {
                videoPreviewContainer.innerHTML = '';
                videoBase64Input.value = '';
                grabarVideoBtn.classList.remove('disabled-photo-btn');
                grabarVideoBtn.disabled = false;
                videoGrabado = false;
            };

            wrapper.appendChild(removeBtn);
            videoPreviewContainer.appendChild(wrapper);

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


function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function compressImageToBase64(file) {
    const originalBase64 = await fileToDataUrl(file);

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const maxDimension = 1600;
            let { width, height } = img;

            if (width > height && width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            } else if (height >= width && height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(originalBase64);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.75);
            resolve(compressed || originalBase64);
        };

        img.onerror = () => resolve(originalBase64);
        img.src = originalBase64;
    });
}


// evento global para la foto de la transferencia

window.inicializarCamaraTransferencia = function () {

    const tomarFotoTransferenciaBtn =
        document.getElementById('tomarFotoTransferenciaBtn');

    const cameraInputTransferencia =
        document.getElementById('cameraInputTransferencia');

    const photosPreviewTransferencia =
        document.getElementById('photosPreviewTransferencia');

    const fotosTransferenciaBase64Container =
        document.getElementById('fotosTransferenciaBase64Container');

    const photoCounterTransferencia =
        document.getElementById('photoCounterTransferencia');

    if (!tomarFotoTransferenciaBtn ||
        !cameraInputTransferencia ||
        !photosPreviewTransferencia) return;

    let archivosTransferenciaCapturados = [];
    let cameraInputTransferenciaClicking = false;

    function sincronizarInputsTransferenciaOcultos() {

        fotosTransferenciaBase64Container.innerHTML = '';

        archivosTransferenciaCapturados.forEach((archivo, index) => {

            const input = document.createElement('input');

            input.type = 'hidden';
            input.name = `fotoTransferencia[${index}]`;
            input.value = archivo.base64;

            fotosTransferenciaBase64Container.appendChild(input);

        });
    }

    function renderPreviewTransferencia() {

        photosPreviewTransferencia.innerHTML = '';

        archivosTransferenciaCapturados.forEach((archivo, index) => {

            const previewDiv = document.createElement('div');
            previewDiv.className = 'photo-item';

            const img = document.createElement('img');
            img.src = archivo.base64;

            previewDiv.appendChild(img);

            const removeBtn = document.createElement('button');

            removeBtn.type = 'button';
            removeBtn.className = 'delete-photo';
            removeBtn.textContent = '✕';

            tomarFotoTransferenciaBtn.disabled = false;
            tomarFotoTransferenciaBtn.style.backgroundColor = '';
            tomarFotoTransferenciaBtn.style.cursor = '';
            tomarFotoTransferenciaBtn.style.opacity = '';
            cameraInputTransferenciaClicking = false;

            removeBtn.onclick = () => {

                archivosTransferenciaCapturados.splice(index, 1);

                renderPreviewTransferencia();
                sincronizarInputsTransferenciaOcultos();

                photoCounterTransferencia.textContent =
                    '0 fotos seleccionadas (max. 1)';
            };

            previewDiv.appendChild(removeBtn);
            photosPreviewTransferencia.appendChild(previewDiv);
        });
    }

    cameraInputTransferencia.addEventListener('change', async (e) => {

        cameraInputTransferenciaClicking = false;

        const files = Array.from(e.target.files);

        if (!files.length) return;

        archivosTransferenciaCapturados = [];

        for (const file of files) {

            if (!file.type.startsWith('image/')) continue;

            const compressedBase64 =
                await compressImageToBase64(file);

            archivosTransferenciaCapturados.push({
                base64: compressedBase64,
                type: 'image/jpeg'
            });
        }

        renderPreviewTransferencia();
        sincronizarInputsTransferenciaOcultos();

        photoCounterTransferencia.textContent =
            '1 foto seleccionada (max. 1)';
    });

    tomarFotoTransferenciaBtn.addEventListener('click', function (e) {

        if (cameraInputTransferenciaClicking) {

            e.preventDefault();
            return;
        }

        // Deshabilitar el botón y ponerlo gris
        tomarFotoTransferenciaBtn.disabled = true;
        tomarFotoTransferenciaBtn.style.backgroundColor = '#9e9e9e';
        tomarFotoTransferenciaBtn.style.cursor = 'not-allowed';
        tomarFotoTransferenciaBtn.style.opacity = '0.7';

        cameraInputTransferenciaClicking = true;

        cameraInputTransferencia.removeAttribute('multiple');
        cameraInputTransferencia.accept = 'image/*';
        cameraInputTransferencia.capture = 'environment';
        cameraInputTransferencia.value = '';

        cameraInputTransferencia.click();
    });

};