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

// 📷 Original Thumbnail Show Switcher
function toggleOriginalThumbnails() {
    isOriginalThumbnailShow = document.getElementById('originalThumbnailShow').checked;
    localStorage.setItem('vh_orig_thumb', JSON.stringify(isOriginalThumbnailShow));
    renderVideos(videos); // Re-render feed instantly
}

// Disable Right Click and Long Press on Video Player
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

// Render Videos dynamically with View integration
async function renderVideos(items, sortByViews = false) {
    const grid = document.getElementById('videoGrid');
    if (items.length === 0) {
        grid.innerHTML = `<p style="text-align:center; grid-column:1/-1;">कोई वीडियो उपलब्ध नहीं है।</p>`;
        return;
    }

    let sorted = [...items];
    
    // Fetch live views for all items
    const videoDataWithViews = await Promise.all(sorted.map(async (v) => {
        const views = await fetchLiveViews(v.id);
        return { ...v, views };
    }));

    // Sorting Logics
    if (sortByViews) {
        // High to Low view count
        videoDataWithViews.sort((a, b) => b.views - a.views);
    } else {
        // Latest timestamps first
        videoDataWithViews.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    const htmlCards = videoDataWithViews.map(video => {
        const isFav = favorites.includes(video.id);
        const hasIframeUrl = video.videoUrl.includes('iframe') || video.videoUrl.includes('dood') || video.videoUrl.includes('streamwish') || video.videoUrl.includes('t.me');

        // Check if "Original Thumbnail Show" toggle is ON and the URL is a direct media stream
        let thumbElement = `<img src="${video.thumbnailUrl}" alt="">`;
        if (isOriginalThumbnailShow && !hasIframeUrl) {
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
                        <span><i class="fa-regular fa-eye"></i> ${video.views} views</span>
                        <button class="action-icon-btn ${isFav ? 'active-fav' : ''}" onclick="event.stopPropagation(); toggleFavorite('${video.id}', this)">
                            <i class="fa-solid fa-heart"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    });
    grid.innerHTML = htmlCards.join('');
}

// 👁️ Live Serverless Counter API for Persistent Views
async function fetchLiveViews(videoId) {
    try {
        const response = await fetch(`https://api.counterapi.dev/v1/viralhub_views/${videoId}`);
        if (response.ok) {
            const data = await response.json();
            return data.value;
        }
        return 0;
    } catch (e) {
        return 0;
    }
}

async function incrementLiveViews(videoId) {
    try {
        await fetch(`https://api.counterapi.dev/v1/viralhub_views/${videoId}/up`);
    } catch (e) {
        console.error(e);
    }
}

// Open Player Screen (Player remains 100% hidden until this is triggered)
async function openVideoPlayer(videoId) {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;
    currentVideo = video;
    
    // Smooth scroll and unhide player
    document.getElementById('gridView').style.display = "none";
    const playerView = document.getElementById('playerView');
    playerView.style.display = "block";
    playerView.classList.add('active-view');
    
    document.getElementById('backBtn').classList.add('visible');
    document.getElementById('playerTitle').innerText = video.title;

    // Increment views
    await incrementLiveViews(video.id);
    const updatedViews = await fetchLiveViews(video.id);
    docume
