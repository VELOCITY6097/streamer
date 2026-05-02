import express from 'express';
import WebTorrent from 'webtorrent';
import path from 'path';
import { fileURLToPath } from 'url';

// --- FFMPEG IMPORTS FOR LIVE TRANSCODING ---
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const client = new WebTorrent({ maxConns: 200, webSeeds: true });
const PORT = process.env.PORT || 3000;

// --- CRITICAL FIX: Global Error Catcher so the server never crashes ---
client.on('error', (err) => {
    console.error('⚙️ [WebTorrent Engine Error]:', err.message);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Engine active on port ${PORT}`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let currentTorrent = null;

const announceList = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://tracker.openbittorrent.com:80/announce",
    "wss://tracker.openwebtorrent.com"
];

// --- 1. ADD MAGNET LINK (WITH SAFETY CHECKS) ---
app.post('/api/add', (req, res) => {
    const { magnet } = req.body;
    if (!magnet) return res.status(400).json({ error: 'No magnet link provided' });

    // Pre-validate the input to stop crashes before they hit the torrent engine
    const isMagnet = magnet.startsWith('magnet:?xt=urn:btih:');
    const isHash = /^[a-fA-F0-9]{40}$/.test(magnet); 
    
    if (!isMagnet && !isHash) {
        return res.status(400).json({ error: 'Invalid format. Please provide a valid magnet link or 40-character info hash.' });
    }

    try {
        if (currentTorrent) {
            currentTorrent.destroy();
            currentTorrent = null;
        }

        client.add(magnet, { announce: announceList }, (torrent) => {
            currentTorrent = torrent;
            
            // Catch specific torrent errors
            torrent.on('error', (err) => {
                console.error(`Torrent Error [${torrent.infoHash}]:`, err.message);
            });

            // Deselect all files initially to save bandwidth until an episode is picked
            torrent.files.forEach(f => f.deselect());
            res.json({ message: 'Ready to stream', infoHash: torrent.infoHash });
        });
    } catch (err) {
        console.error("Failed to add torrent to engine:", err);
        res.status(500).json({ error: 'Internal server error while processing the link.' });
    }
});

// --- 2. GET TORRENT FILES (For Episodes Sidebar) ---
app.get('/api/files/:infoHash', (req, res) => {
    if (!currentTorrent || currentTorrent.infoHash !== req.params.infoHash) {
        return res.status(404).json({ error: 'Torrent not active.' });
    }

    // Send all files with their original index so the frontend knows which one to request
    const fileList = currentTorrent.files.map((file, index) => ({
        name: file.name,
        size: file.length,
        originalIndex: index 
    }));

    res.json({ files: fileList });
});

// --- 3. STREAMING & LIVE TRANSCODING ---
app.get('/api/stream/:infoHash', (req, res) => {
    if (!currentTorrent || currentTorrent.infoHash !== req.params.infoHash) {
        return res.status(404).send('Torrent not found');
    }

    let file;
    const fileIndex = req.query.file;

    // If the frontend asks for a specific episode index, use it. Otherwise, fallback.
    if (fileIndex !== undefined && currentTorrent.files[fileIndex]) {
        file = currentTorrent.files[fileIndex];
    } else {
        file = currentTorrent.files.find(f => f.name.endsWith('.mp4') || f.name.endsWith('.mkv') || f.name.endsWith('.webm'));
    }

    if (!file) return res.status(404).send('File not found');

    const targetRes = req.query.res; // Grabs '480', '720', or 'source'
    const range = req.headers.range;

    // -- Transcoding Logic --
    if (targetRes && targetRes !== 'source') {
        res.writeHead(200, { 'Content-Type': 'video/mp4' });
        
        const rawStream = file.createReadStream();
        
        const transcodeStream = ffmpeg(rawStream)
            .videoCodec('libx264')
            .size(`?x${targetRes}`)
            .outputOptions([
                '-movflags isml+frag_keyframe+empty_moov+faststart',
                '-preset ultrafast',
                '-crf 28'
            ])
            .format('mp4')
            .on('error', (err) => console.log('Transcode interrupted'))
            .pipe(res, { end: true });

        req.on('close', () => rawStream.destroy());
        return;
    }

    // -- Normal Source Streaming (No Transcoding) --
    if (!range) {
        res.writeHead(200, { 'Content-Length': file.length, 'Content-Type': 'video/mp4' });
        file.createReadStream().pipe(res);
        return;
    }

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : file.length - 1;
    const chunksize = (end - start) + 1;

    res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${file.length}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
    });

    const stream = file.createReadStream({ start, end });
    stream.pipe(res);

    const killStream = () => { if (!stream.destroyed) stream.destroy(); };
    stream.on('error', killStream);
    req.on('close', killStream);
});

// --- 4. TORRENT STATS ---
app.get('/api/stats', (req, res) => {
    if (!currentTorrent) return res.json({ status: 'idle' });
    res.json({
        status: 'downloading', 
        progress: currentTorrent.progress, 
        downloadSpeed: currentTorrent.downloadSpeed,
        downloaded: currentTorrent.downloaded, 
        length: currentTorrent.length, 
        numPeers: currentTorrent.numPeers
    });
});