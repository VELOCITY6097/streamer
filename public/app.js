// const magnetInput = document.getElementById('magnet-input');
// const streamBtn = document.getElementById('stream-btn');

// streamBtn.addEventListener('click', async () => {
//     const magnet = magnetInput.value.trim();
//     if (!magnet) return alert("Please enter a valid magnet link.");

//     streamBtn.innerText = "Processing...";
//     streamBtn.disabled = true;

//     try {
//         const response = await fetch('/api/add', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ magnet })
//         });
//         const data = await response.json();
//         if (!response.ok) throw new Error(data.error);

//         // SUCCESS! Redirect the browser to the smart /play endpoint, passing the infoHash
//         // Your server.js will handle detecting if they are on Mobile or PC
//         window.location.href = `/play?hash=${data.infoHash}`;

//     } catch (err) {
//         alert("Error: " + err.message);
//         streamBtn.innerText = "Start Watching";
//         streamBtn.disabled = false;
//     }
// });

const magnetInput = document.getElementById('magnet-input');
const streamBtn = document.getElementById('stream-btn');

streamBtn.addEventListener('click', async () => {
    const magnet = magnetInput.value.trim();
    if (!magnet) return alert("Please enter a valid magnet link.");

    streamBtn.innerText = "Processing...";
    streamBtn.disabled = true;

    try {
        const response = await fetch('/api/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ magnet })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);

        // SUCCESS! Redirect the browser to the new stream page inside the pages folder.
        // The stream.html page will then securely load the player iframe.
        window.location.href = `/pages/stream.html?hash=${data.infoHash}`;

    } catch (err) {
        alert("Error: " + err.message);
        streamBtn.innerText = "Start Watching";
        streamBtn.disabled = false;
    }
});