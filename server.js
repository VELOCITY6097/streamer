// import express from 'express';
// import WebTorrent from 'webtorrent';
// import path from 'path';
// import { fileURLToPath } from 'url';

// // --- FFMPEG IMPORTS FOR LIVE TRANSCODING ---
// import ffmpeg from 'fluent-ffmpeg';
// import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
// ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// const app = express();
// const client = new WebTorrent({ maxConns: 200, webSeeds: true });
// const PORT = process.env.PORT || 3000;

// app.listen(PORT, '0.0.0.0', () => {
//     console.log(`🚀 Engine active on port ${PORT}`);
// });
// app.use(express.static(path.join(__dirname, 'public')));
// app.use(express.json());

// let currentTorrent = null;

// const announceList = [
//     "udp://tracker.opentrackr.org:1337/announce",
//     "udp://tracker.openbittorrent.com:80/announce",
//     "wss://tracker.openwebtorrent.com"
// ];

// // --- 1. ADD MAGNET LINK ---
// app.post('/api/add', (req, res) => {
//     const { magnet } = req.body;
//     if (!magnet) return res.status(400).json({ error: 'No magnet link provided' });

//     if (currentTorrent) currentTorrent.destroy();

//     client.add(magnet, { announce: announceList }, (torrent) => {
//         currentTorrent = torrent;
//         const file = torrent.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.webm'));
//         if (!file) return res.status(400).json({ error: 'No playable video file found.' });
        
//         file.deselect();
//         res.json({ message: 'Ready to stream', infoHash: torrent.infoHash });
//     });
// });

// // --- 2. STREAMING & LIVE TRANSCODING ---
// app.get('/api/stream/:infoHash', (req, res) => {
//     if (!currentTorrent || currentTorrent.infoHash !== req.params.infoHash) {
//         return res.status(404).send('Torrent not found');
//     }

//     const file = currentTorrent.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.webm'));
//     if (!file) return res.status(404).send('File not found');

//     const targetRes = req.query.res; // Grabs '480', '720', or 'source'
//     const range = req.headers.range;

//     // -- Transcoding Logic --
//     if (targetRes && targetRes !== 'source') {
//         res.writeHead(200, { 'Content-Type': 'video/mp4' });
        
//         // Grab the raw file stream
//         const rawStream = file.createReadStream();
        
//         // Pipe it through FFmpeg live
//         const transcodeStream = ffmpeg(rawStream)
//             .videoCodec('libx264')
//             .size(`?x${targetRes}`) // Automatically scales width, sets height to target
//             .outputOptions([
//                 '-movflags isml+frag_keyframe+empty_moov+faststart', // Forces immediate streaming
//                 '-preset ultrafast', // Prevents buffering by maxing CPU speed
//                 '-crf 28' // Compresses video to save bandwidth
//             ])
//             .format('mp4')
//             .on('error', (err) => console.log('Transcode interrupted (usually due to user seeking/disconnecting)'))
//             .pipe(res, { end: true });

//         // Clean up when the user clicks away or closes the browser
//         req.on('close', () => {
//             rawStream.destroy();
//         });
//         return;
//     }

//     // -- Normal Source Streaming (No Transcoding) --
//     if (!range) {
//         res.writeHead(200, { 'Content-Length': file.length, 'Content-Type': 'video/mp4' });
//         file.createReadStream().pipe(res);
//         return;
//     }

//     const parts = range.replace(/bytes=/, "").split("-");
//     const start = parseInt(parts[0], 10);
//     const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
//     const chunksize = (end - start) + 1;

//     res.writeHead(206, {
//         'Content-Range': `bytes ${start}-${end}/${file.length}`,
//         'Accept-Ranges': 'bytes',
//         'Content-Length': chunksize,
//         'Content-Type': 'video/mp4',
//     });

//     const stream = file.createReadStream({ start, end });
//     stream.pipe(res);

//     const killStream = () => { if (!stream.destroyed) stream.destroy(); };
//     stream.on('error', killStream);
//     req.on('close', killStream);
// });

// // --- 3. TORRENT STATS ---
// app.get('/api/stats', (req, res) => {
//     if (!currentTorrent) return res.json({ status: 'idle' });
//     res.json({
//         status: 'downloading', 
//         progress: currentTorrent.progress, 
//         downloadSpeed: currentTorrent.downloadSpeed,
//         downloaded: currentTorrent.downloaded, 
//         length: currentTorrent.length, 
//         numPeers: currentTorrent.numPeers
//     });
// });

// // --- 4. DEVICE DETECTION & PLAYER ROUTING ---
// app.get('/play', (req, res) => {
//     const userAgent = req.headers['user-agent'] || '';
    
//     // Regex to detect Mobile devices
//     const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());

//     if (isMobile) {
//         res.sendFile(path.join(__dirname, 'public/player/mobileplayer.html'));
//     } else {
//         res.sendFile(path.join(__dirname, 'public/player/pcplayer.html'));
//     }
// });



import express from 'express';
import WebTorrent from 'webtorrent';
import path from 'path';
import { fileURLToPath } from 'url';

// --- FFMPEG ---
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = new WebTorrent({ maxConns: 200, webSeeds: true });

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Engine active on port ${PORT}`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- GLOBAL STATE ---
let currentTorrent = null;
let isAdding = false;

// --- TRACKERS ---
const announceList = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://tracker.openbittorrent.com:80/announce",
    "wss://tracker.openwebtorrent.com"
];

// --- ERROR HANDLING (prevents crash) ---
client.on('error', err => {
    console.log('⚠️ WebTorrent error:', err.message);
});

// --- HELPER: GET BEST VIDEO FILE ---
function getVideoFile(torrent) {
    return torrent.files
        .filter(f => /\.(mp4|mkv|webm)$/i.test(f.name))
        .sort((a, b) => b.length - a.length)[0]; // biggest file
}

// --- HELPER: ADD TORRENT ---
function addTorrent(magnet, res) {
    const existing = client.get(magnet);

    if (existing) {
        currentTorrent = existing;
        isAdding = false;
        return res.json({
            message: 'Already loaded',
            infoHash: existing.infoHash
        });
    }

    client.add(magnet, { announce: announceList }, (torrent) => {
        currentTorrent = torrent;

        const file = getVideoFile(torrent);

        if (!file) {
            client.remove(torrent.infoHash);
            isAdding = false;
            return res.status(400).json({ error: 'No playable video file found.' });
        }

        file.deselect();

        isAdding = false;
        res.json({
            message: 'Ready to stream',
            infoHash: torrent.infoHash
        });
    });
}

// --- 1. ADD MAGNET ---
app.post('/api/add', (req, res) => {
    const { magnet } = req.body;

    if (!magnet) {
        return res.status(400).json({ error: 'No magnet link provided' });
    }

    if (isAdding) {
        return res.json({ message: 'Already processing...' });
    }

    isAdding = true;

    if (currentTorrent) {
        client.remove(currentTorrent.infoHash, () => {
            currentTorrent = null;
            addTorrent(magnet, res);
        });
    } else {
        addTorrent(magnet, res);
    }
});

// --- 2. STREAM ---
app.get('/api/stream/:infoHash', (req, res) => {
    if (!currentTorrent || currentTorrent.infoHash !== req.params.infoHash) {
        return res.status(404).send('Torrent not found');
    }

    const file = getVideoFile(currentTorrent);
    if (!file) return res.status(404).send('File not found');

    const targetRes = req.query.res;
    const range = req.headers.range;

    // --- TRANSCODING MODE ---
    if (targetRes && targetRes !== 'source') {
        res.writeHead(200, { 'Content-Type': 'video/mp4' });

        const rawStream = file.createReadStream();

        const transcode = ffmpeg(rawStream)
            .videoCodec('libx264')
            .size(`?x${targetRes}`)
            .outputOptions([
                '-movflags frag_keyframe+empty_moov+faststart',
                '-preset ultrafast',
                '-crf 28'
            ])
            .format('mp4')
            .on('error', () => {})
            .pipe(res, { end: true });

        req.on('close', () => {
            rawStream.destroy();
            if (transcode) transcode.destroy?.();
        });

        return;
    }

    // --- NORMAL STREAM ---
    if (!range) {
        res.writeHead(200, {
            'Content-Length': file.length,
            'Content-Type': 'video/mp4'
        });
        file.createReadStream().pipe(res);
        return;
    }

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
    const chunkSize = (end - start) + 1;

    res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${file.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': 'video/mp4',
    });

    const stream = file.createReadStream({ start, end });
    stream.pipe(res);

    const cleanup = () => {
        if (!stream.destroyed) stream.destroy();
    };

    stream.on('error', cleanup);
    req.on('close', cleanup);
});

// --- 3. STATS ---
app.get('/api/stats', (req, res) => {
    if (!currentTorrent) {
        return res.json({ status: 'idle' });
    }

    res.json({
        status: 'downloading',
        progress: currentTorrent.progress,
        downloadSpeed: currentTorrent.downloadSpeed,
        downloaded: currentTorrent.downloaded,
        length: currentTorrent.length,
        numPeers: currentTorrent.numPeers
    });
});

// --- 4. PLAYER ROUTING ---
app.get('/play', (req, res) => {
    const ua = req.headers['user-agent'] || '';

    const isMobile = /android|iphone|ipad|ipod|opera mini|iemobile/i.test(ua.toLowerCase());

    if (isMobile) {
        res.sendFile(path.join(__dirname, 'public/player/mobileplayer.html'));
    } else {
        res.sendFile(path.join(__dirname, 'public/player/pcplayer.html'));
    }
});
