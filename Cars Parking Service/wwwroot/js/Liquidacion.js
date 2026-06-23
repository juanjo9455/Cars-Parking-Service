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
            modalWrap.classList.add('active');
        });
    }

    // Cerrar modal
    const closeModal = document.getElementById('closeModal');

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modalWrap.classList.remove('active');
        });
    }

    // Confirmación visual
    const doConfirm = document.getElementById('doConfirm');
    const successBanner = document.getElementById('successBanner');

    if (doConfirm) {
        const idUsuario = doConfirm.dataset.idUsuario;
        const totalVehiculos = doConfirm.dataset.totalVehiculos;
        const totalEfectivo = doConfirm.dataset.totalEfectivo;
        const totalTransferencia = doConfirm.dataset.totalTransferencia;
        const totalDinero = doConfirm.dataset.totalDinero;

        doConfirm.addEventListener('click', async () => {

            modalWrap.style.display = 'none';

            if (successBanner) {
                successBanner.classList.add('visible');
            }

            try {

                const response = await fetch('/Liquidacion/GuardarLiquidacion', {
                    method : 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        idUsuario: parseInt(idUsuario),
                        totalVehiculos: parseInt(totalVehiculos),
                        totalEfectivo: parseFloat(totalEfectivo),
                        totalTransferencia: parseFloat(totalTransferencia),
                        totalDinero: parseFloat(totalDinero)
                    })
                });

                if (!response.ok) {
                    throw new Error('Error al registrar la liquidación');
                }

                const resultado = await response.json();

                if (resultado.success) {

                    modalWrap.classList.remove('active');

                    if (successBanner) {
                        successBanner.classList.add('visible');
                    }

                    sessionStorage.setItem('mostrarAlertaLiquidacion', 'true');

                    window.location.href = '/Home/Index';
                }

            } catch (error) {
                console.error(error);
            }
        });
    }

});