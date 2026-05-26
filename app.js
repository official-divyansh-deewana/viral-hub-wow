// Local database fetch path
const DATA_SOURCE_URL = "./videos.json";

let videos = [];
let favorites = JSON.parse(localStorage.getItem('vh_favorites')) || [];
let historyList = JSON.parse(localStorage.getItem('vh_history')) || [];
let activeTab = 'all'; 
let currentVideo = null;
let playbackSpeed = 1.0;

const mainVideo = document.getElementById('mainVideo');
const iframeContainer = document.getElementById('iframeContainer');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressFill = document.getElementById('progressFill');
const progressContainer = document.getElementById('progressContainer');
const timeDisplay = document.getElementById('timeDisplay');
const volumeBtn = document.getElementById('volumeBtn');
const volumeSlider = document.getElementById('volumeSlider');
const speedBtn = document.getElementById('speedBtn');
const playOverlay = document.getElementById('playOverlay');
const playerControls = document.getElementById('playerControls');

window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchVideos();
    setupPlayerListeners();
});

function initTheme() {
    const savedTheme = localStorage.getItem('vh_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('vh_theme', newTheme);
}

async function fetchVideos() {
    try {
        const response = await fetch(`${DATA_SOURCE_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Data fetch issue.');
        videos = await response.json();
        renderVideos(videos);
    } catch (err) {
        document.getElementById('videoGrid').innerHTML = `<p style="text-align:center; padding:2rem;">डेटाबेस लोड नहीं हो सका। कृपया बॉट से कम से कम एक वीडियो अपलोड करें।</p>`;
    }
}

function renderVideos(items) {
    const grid = document.getElementById('videoGrid');
    if (items.length === 0) {
        grid.innerHTML = `<p style="text-align:center; grid-column:1/-1;">कोई वीडियो उपलब्ध नहीं है।</p>`;
        return;
    }
    const sorted = [...items].sort((a,b) => b.timestamp - a.timestamp);
    grid.innerHTML = sorted.map(video => {
        const isFav = favorites.includes(video.id);
        return `
            <div class="video-card" onclick="openVideoPlayer('${video.id}')">
                <div class="thumbnail-container">
                    <img src="${video.thumbnailUrl}" alt="">
                    <span class="duration-tag">${video.duration || 'Video'}</span>
                </div>
                <div class="card-details">
                    <h3 class="card-title">${video.title}</h3>
                    <div class="card-meta">
                        <span>${new Date(video.timestamp).toLocaleDateString()}</span>
                        <button class="action-icon-btn ${isFav ? 'active-fav' : ''}" onclick="event.stopPropagation(); toggleFavorite('${video.id}', this)">
                            <i class="fa-solid fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function switchTab(tabName) {
    activeTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (tabName === 'all') {
        document.getElementById('tabAll').classList.add('active');
        renderVideos(videos);
    } else if (tabName === 'favorites') {
        document.getElementById('tabFav').classList.add('active');
        renderVideos(videos.filter(v => favorites.includes(v.id)));
    } else if (tabName === 'history') {
        document.getElementById('tabHist').classList.add('active');
        renderVideos(historyList.map(id => videos.find(v => v.id === id)).filter(Boolean));
    }
}

function showGridView() {
    document.getElementById('playerView').classList.remove('active-view');
    document.getElementById('gridView').classList.add('active-view');
    document.getElementById('backBtn').classList.remove('visible');
    mainVideo.pause();
    iframeContainer.innerHTML = ""; // Clear iframe
}

// Multi-Player Engine (Supports Iframe Embeds & Direct MP4s)
function openVideoPlayer(videoId) {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    currentVideo = video;
    document.getElementById('gridView').classList.remove('active-view');
    document.getElementById('playerView').classList.add('active-view');
    document.getElementById('backBtn').classList.add('visible');
    document.getElementById('playerTitle').innerText = video.title;

    // Check if the URL is an external web player (Iframe)
    const url = video.videoUrl.toLowerCase();
    const isIframe = !url.endsWith('.mp4') && !url.endsWith('.mkv') && !url.endsWith('.mov') && !url.endsWith('.m3u8') || 
                     url.includes('embed') || url.includes('iframe') || url.includes('dood') || url.includes('streamwish') || url.includes('fembed') || url.includes('terabox');

    if (isIframe) {
        // Switch to Iframe View
        mainVideo.style.display = "none";
        playerControls.style.display = "none"; // Hide custom controls (iframe has its own)
        iframeContainer.style.display = "block";
        
        let embedUrl = video.videoUrl;
        // Make sure it is formatted as an embed if possible
        if (embedUrl.includes("dood.to/d/")) embedUrl = embedUrl.replace("dood.to/d/", "dood.to/e/");
        if (embedUrl.includes("streamwish.to/")) embedUrl = embedUrl.replace("streamwish.to/", "streamwish.to/e/");
        
        iframeContainer.innerHTML = `<iframe src="${embedUrl}" allowfullscreen scrolling="no"></iframe>`;
    } else {
        // Switch to Direct Video Player View
        iframeContainer.style.display = "none";
        iframeContainer.innerHTML = "";
        mainVideo.style.display = "block";
        playerControls.style.display = "flex";
        
        mainVideo.src = video.videoUrl;
        mainVideo.play().catch(() => {});
    }

    addToHistory(video.id);
    renderSuggestedVideos(video.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Side Column Suggested List Generator
function renderSuggestedVideos(currentId) {
    const sidebar = document.getElementById('suggestedGrid');
    const filtered = videos.filter(v => v.id !== currentId);
    
    if (filtered.length === 0) {
        sidebar.innerHTML = `<p style="font-size:0.85rem; color:var(--text-secondary);">No other suggested videos.</p>`;
        return;
    }

    sidebar.innerHTML = filtered.slice(0, 8).map(video => `
        <div class="video-card" onclick="openVideoPlayer('${video.id}')" style="display: flex; gap: 0.8rem; border-radius: 8px; padding: 4px;">
            <div class="thumbnail-container" style="width: 110px; height: 62px; aspect-ratio: auto; flex-shrink: 0; border-radius: 6px; overflow: hidden;">
                <img src="${video.thumbnailUrl}" alt="">
            </div>
            <div class="card-details" style="padding: 0; display: flex; flex-direction: column; justify-content: center;">
                <h4 class="card-title" style="font-size: 0.85rem; height: auto; -webkit-line-clamp: 2; line-height: 1.3; margin: 0;">${video.title}</h4>
                <span style="font-size: 0.72rem; color: var(--text-secondary); margin-top: 4px;">${new Date(video.timestamp).toLocaleDateString()}</span>
            </div>
        </div>
    `).join('');
}

function toggleFavorite(id, btn) {
    const index = favorites.indexOf(id);
    if (index > -1) {
        favorites.splice(index, 1);
        btn.classList.remove('active-fav');
    } else {
        favorites.push(id);
        btn.classList.add('active-fav');
    }
    localStorage.setItem('vh_favorites', JSON.stringify(favorites));
}

function addToHistory(id) {
    historyList = historyList.filter(item => item !== id);
    historyList.unshift(id);
    localStorage.setItem('vh_history', JSON.stringify(historyList));
}

function setupPlayerListeners() {
    mainVideo.addEventListener('timeupdate', () => {
        if (mainVideo.duration) {
            const pct = (mainVideo.currentTime / mainVideo.duration) * 100;
            progressFill.style.width = `${pct}%`;
            timeDisplay.innerText = `${formatTime(mainVideo.currentTime)} / ${formatTime(mainVideo.duration)}`;
        }
    });
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}
