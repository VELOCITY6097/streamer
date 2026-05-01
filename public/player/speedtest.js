// public/player/speedtest.js

async function calculateOptimalResolution() {
    console.log("Detecting internet speed...");
    
    const startTime = new Date().getTime();
    
    try {
        // We fetch a highly optimized, un-cached dummy payload to test speed
        // (Using a random cache-busting string so the browser actually downloads it)
        const response = await fetch(`https://cdn.tailwindcss.com/?cachebust=${Math.random()}`);
        const blob = await response.blob();
        
        const endTime = new Date().getTime();
        const durationInSeconds = (endTime - startTime) / 1000;
        
        // Calculate Megabits per second (Mbps)
        const bitsLoaded = blob.size * 8;
        const speedBps = bitsLoaded / durationInSeconds;
        const speedMbps = speedBps / (1024 * 1024);
        
        console.log(`User network speed: ${speedMbps.toFixed(2)} Mbps`);

        // --- THE ABR LOGIC ---
        // You can tweak these thresholds based on your server's upload speed
        if (speedMbps >= 10) {
            console.log("Auto-Selecting: 1080p (Source)");
            return 1080;
        } else if (speedMbps >= 4) {
            console.log("Auto-Selecting: 720p");
            return 720;
        } else {
            console.log("Auto-Selecting: 480p");
            return 480;
        }
    } catch (err) {
        console.warn("Speed test failed. Defaulting to 480p to be safe.");
        return 480; // If they have no internet or aggressive adblock, default to lowest.
    }
}