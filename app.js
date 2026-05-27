const DATA_SOURCE_URL = "./videos.json";

let videos = [];
let favorites = JSON.parse(localStorage.getItem('vh_favorites')) || [];
let historyList = JSON.parse(localStorage.getItem('vh_history')) || [];
let searchHistory = JSON.parse(localStorage.getItem('vh_search_history')) || [];

// States & Pause Toggles
let isWatchHistoryPaused = JSON.parse(localStorage.getItem('vh_watch_paused')) || false;
let isSearchHistoryPaused = JSON.parse(localStorage.getItem('vh_search_paused')) || false;
let isOriginalThumbnailShow = JSON.parse(localStorage.getItem('vh_orig_thumb')) || false;

let currentVideo = null;
let selectedFileBase64 = "";

const mainVideo = document.getElementById('mainVideo');
const iframeContainer = document.getElementById('iframeContainer');
const playPauseBtn = document.getElementById('playPauseBtn');
const progressFill = document.getElementById('progressFill');
const progressContainer = document.getElementById('progressContainer');
const timeDisplay = document.getElementById('timeDisplay');
const playOverlay = document.getElementById('playOverlay');
const playerControls = document.getElementById('playerControls');

window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadToggleStates();
    fetchVideos();
    setupPlayerListeners();
    disableVideoLongPress(); // Disable downloads
});

function initTheme() {
    const savedTheme = localStorage.getItem('vh_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function loadToggleStates() {
    document.getElementById('pauseWatchHistory').checked = isWatchHistoryPaused;
    document.getElementById('pauseSearchHistory').checked = isSearchHistoryPaused;
    document.getElementById('originalThumbnailShow').checked = isOriginalThumbnailShow;
}

function toggleWatchHistoryPause() {
    isWatchHistoryPaused = document.getElementById('pauseWatchHistory').checked;
    localStorage.setItem('vh_watch_paused', JSON.stringify(isWatchHistoryPaused));
}

function toggleSearchHistoryPause() {
    isSearchHistoryPaused = document.getElementById('pauseSearchHistory').checked;
    localStorage.setItem('vh_search_paused', JSON.stringify(isSearchHistoryPaused));
}

function toggleOriginalThumbnails() {
    isOriginalThumbnailShow = document.getElementById('originalThumbnailShow').checked;
    localStorage.setItem('vh_orig_thumb', JSON.stringify(isOriginalThumbnailShow));
    renderVideos(videos); 
}

function disableVideoLongPress() {
    document.addEventListener('contextmenu', (e) => {
        if (e.target.tagName === 'VIDEO' || e.target.classList.contains('video-element')) {
            e.preventDefault();
        }
    }, { capture: true });
}

async function fetchVideos() {
    try {
        const response = await fetch(`${DATA_SOURCE_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error('Data fetch issue.');
        videos = await response.json();
        renderVideos(videos);
    } catch (err) {
        document.getElementById('videoGrid').innerHTML = `<p style="text-align:center; padding:2rem;">डेटाबेस लोड करने में समस्या आई।</p>`;
    }
}

async function renderVideos(items, sortByViews = false) {
    const grid = document.getElementById('videoGrid');
    if (items.length === 0) {
        grid.innerHTML = `<p style="text-align:center; grid-column:1/-1;">कोई वीडियो उपलब्ध नहीं है।</p>`;
        return;
    }

    let sorted = [...items];

    if (sortByViews) {
        const videoDataWithViews = await Promise.all(sorted.map(async (v) => {
            const views = await fetchLiveViews(v.id);
            return { ...v, views };
        }));
        videoDataWithViews.sort((a, b) => b.views - a.views);
        sorted = videoDataWithViews;
    } else {
        sorted.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    const htmlCards = sorted.map(video => {
        const isFav = favorites.includes(video.id);
        const url = video.videoUrl ? video.videoUrl.toLowerCase() : "";
        const hasIframeUrl = url.includes('iframe') || url.includes('embed') || url.includes('dood') || url.includes('streamwish') || url.includes('t.me');

        let thumbElement = `<img src="${video.thumbnailUrl}" alt="">`;
        if (isOriginalThumbnailShow && !hasIframeUrl && video.videoUrl) {
            // Optimized video tag for ultra-fast thumbnail loading
            thumbElement = `<video src="${video.videoUrl}" muted playsinline preload="metadata" style="width:100%; height:100%; object-fit:cover;"></video>`;
        }

        return `
            <div class="video-card" onclick="openVideoPlayer('${video.id}')">
                <div class="thumbnail-container">
                    ${thumbElement}
                    <span class="duration-tag">${video.duration || 'Video'}</span>
                </div>
                <div class="card-details">
                    <h3 class="card-title">${video.title}</h3>
                    <div class="card-meta">
                        <span id="card-views-${video.id}"><i class="fa-regular fa-eye"></i> Loading...</span>
                        <button class="action-icon-btn ${isFav ? 'active-fav' : ''}" onclick="event.stopPropagation(); toggleFavorite('${video.id}', this)">
                            <i class="fa-solid fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    grid.innerHTML = htmlCards.join('');

    sorted.forEach(async (video) => {
        const views = await fetchLiveViews(video.id);
        const viewSpan = document.getElementById(`card-views-${video.id}`);
        if (viewSpan) {
            viewSpan.innerHTML = `<i class="fa-regular fa-eye"></i> ${views} views`;
        }
    });
}

async function fetchLiveViews(videoId) {
    try {
        const response = await fetch(`/api/views?id=${videoId}`);
        if (response.ok) {
            const data = await response.json();
            return data.views;
        }
        return 0;
    } catch (e) {
        return 0;
    }
}

async function incrementLiveViews(videoId) {
    try {
        await fetch(`/api/views?id=${videoId}&action=up`, { method: "POST" });
    } catch (e) {
        console.error(e);
    }
}

// Open Player & Fast-Load Optimization
async function openVideoPlayer(videoId) {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    currentVideo = video;
    
    document.getElementById('gridView').style.display = "none";
    const playerView = document.getElementById('playerView');
    playerView.style.display = "block";
    playerView.classList.add('active-view');
    
    document.getElementById('backBtn').classList.add('visible');
    document.getElementById('playerTitle').innerText = video.title;

    await incrementLiveViews(video.id);
    const updatedViews = await fetchLiveViews(video.id);
    document.getElementById('playerViewsCount').innerHTML = `<i class="fa-regular fa-eye"></i> ${updatedViews} views`;

    const url = video.videoUrl ? video.videoUrl.toLowerCase() : "";
    const isTelegramLink = url.includes("t.me/");
    const isIframe = !url.endsWith('.mp4') && !url.endsWith('.mkv') && !url.endsWith('.mov') && !url.endsWith('.m3u8') || 
                     url.includes('embed') || url.includes('iframe') || url.includes('dood') || url.includes('streamwish') || isTelegramLink;

    if (isIframe) {
        mainVideo.style.display = "none";
        playerControls.style.display = "none";
        iframeContainer.style.display = "block";
        
        let embedUrl = video.videoUrl;
        if (isTelegramLink) {
            embedUrl = video.videoUrl + "?embed=1";
        }
        iframeContainer.innerHTML = `<iframe src="${embedUrl}" allowfullscreen scrolling="no" style="width:100%; height:100%; border:0;"></iframe>`;
    } else {
        iframeContainer.style.display = "none";
        iframeContainer.innerHTML = "";
        mainVideo.style.display = "block";
        playerControls.style.display = "flex";
        
        // Fast buffer loading attributes
        mainVideo.setAttribute("preload", "auto");
        mainVideo.src = video.videoUrl;
        
        playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        mainVideo.play().catch(() => {});
    }

    addToHistory(video.id);
    renderSuggestedVideos(video.id);
    updatePlayerFavBtn(video.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 🕹️ Player Custom Actions (Fully Implemented!)
function togglePlay() {
    if (mainVideo.paused) {
        mainVideo.play();
        playPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        mainVideo.pause();
        playPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

function toggleMute() {
    mainVideo.muted = !mainVideo.muted;
    const volIcon = document.getElementById('volumeBtn').querySelector('i');
    if (mainVideo.muted) {
        volIcon.className = "fa-solid fa-volume-mute";
    } else {
        volIcon.className = "fa-solid fa-volume-high";
    }
}

async function toggleFullscreen() {
    const container = document.getElementById('playerContainer');
    try {
        if (!document.fullscreenElement) {
            await container.requestFullscreen();
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape').catch(() => {});
            }
        } else {
            await document.exitFullscreen();
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        }
    } catch (e) {
        console.error("Fullscreen lock error: ", e);
    }
}

async function renderSuggestedVideos(currentId) {
    const sidebar = document.getElementById('suggestedGrid');
    const filtered = videos.filter(v => v.id !== currentId);
    
    if (filtered.length === 0) {
        sidebar.innerHTML = `<p style="font-size:0.85rem; color:var(--text-secondary);">No suggested videos.</p>`;
        return;
    }

    sidebar.innerHTML = filtered.slice(0, 8).map(video => `
        <div class="video-card" onclick="openVideoPlayer('${video.id}')" style="display: flex; gap: 0.8rem; border-radius: 8px; padding: 4px;">
            <div class="thumbnail-container" style="width: 100px; height: 56px; flex-shrink: 0; border-radius: 6px; overflow: hidden;">
                <img src="${video.thumbnailUrl}" alt="">
            </div>
            <div class="card-details" style="padding: 0; display: flex; flex-direction: column; justify-content: center;">
                <h4 class="card-title" style="font-size: 0.8rem; height: auto; -webkit-line-clamp: 2; margin: 0;">${video.title}</h4>
                <span id="suggested-views-${video.id}" style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px;"><i class="fa-regular fa-eye"></i> Loading...</span>
            </div>
        </div>
    `).join('');

    filtered.slice(0, 8).forEach(async (video) => {
        const views = await fetchLiveViews(video.id);
        const viewSpan = document.getElementById(`suggested-views-${video.id}`);
        if (viewSpan) {
            viewSpan.innerHTML = `<i class="fa-regular fa-eye"></i> ${views} views`;
        }
    });
}

function switchTab(tabName) {
    const title = document.getEle
