document.getElementById('grantBtn').addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop immediately, we just needed the permission
        stream.getTracks().forEach(track => track.stop());

        document.getElementById('successMsg').style.display = 'block';
        document.getElementById('grantBtn').style.display = 'none';

    } catch (error) {
        console.error('Error granting permission:', error);
        alert('Permission denied. Please allow microphone access in the browser settings.');
    }
});
