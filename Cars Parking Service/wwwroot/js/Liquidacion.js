document.addEventListener('DOMContentLoaded', () => {

    const extraRows = document.getElementById('rows-extra');
    const toggleBtn = document.getElementById('toggleBtn');
    const toggleIcon = document.getElementById('toggleIcon');
    const toggleLabel = document.getElementById('toggleLabel');
    const tableCount = document.getElementById('table-count');

    let expanded = false;

    // Ocultar registros adicionales inicialmente
    if (extraRows) {
        extraRows.style.display = 'none';
    }

    // Mostrar / ocultar registros
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {

            expanded = !expanded;

            if (extraRows) {
                extraRows.style.display = expanded ? '' : 'none';
            }

            if (toggleIcon) {
                toggleIcon.style.transform = expanded
                    ? 'rotate(180deg)'
                    : 'rotate(0deg)';
            }

            if (toggleLabel) {
                toggleLabel.textContent = expanded
                    ? 'Ocultar registros'
                    : 'Mostrar todos los registros';
            }

            if (tableCount) {
                tableCount.textContent = expanded
                    ? 'Mostrando todos los registros'
                    : 'Mostrando registros principales';
            }
        });
    }

    // Abrir modal de confirmación
    const openModal = document.getElementById('openModal');
    const modalWrap = document.getElementById('modalWrap');

    if (openModal) {
        openModal.addEventListener('click', () => {
            modalWrap.style.display = 'flex';
        });
    }

    // Cerrar modal
    const closeModal = document.getElementById('closeModal');

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modalWrap.style.display = 'none';
        });
    }

    // Confirmación visual
    const doConfirm = document.getElementById('doConfirm');
    const successBanner = document.getElementById('successBanner');

    if (doConfirm) {
        doConfirm.addEventListener('click', () => {

            modalWrap.style.display = 'none';

            if (successBanner) {
                successBanner.classList.add('visible');
            }

            // Aquí irá posteriormente la llamada AJAX o fetch
            // para registrar la liquidación en el backend.
        });
    }

});