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
    disableVideoLongPress(); // Disable downloads completely
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
    renderVideos(videos); // Instant Re-render
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

// Render Videos (Instant Render to prevent hanging)
async function renderVideos(items, sortByViews = false) {
    const grid = document.getElementById('videoGrid');
    if (items.length === 0) {
        grid.innerHTML = `<p style="text-align:center; grid-column:1/-1;">कोई वीडियो उपलब्ध नहीं है।</p>`;
        return;
    }

    let sorted = [...items];

    // If sorting by views is requested
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

        // Check original thumbnail show
        let thumbElement = `<img src="${video.thumbnailUrl}" alt="">`;
        if (isOriginalThumbnailShow && !hasIframeUrl && video.videoUrl) {
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

    // Load view counts asynchronously in background to prevent hanging
    sorted.forEach(async (video) => {
        const views = await fetchLiveViews(video.id);
        const viewSpan = document.getElementById(`card-views-${video.id}`);
        if (viewSpan) {
            viewSpan.innerHTML = `<i class="fa-regular fa-eye"></i> ${views} views`;
        }
    });
}

// 👁️ Live Serverless Counter API (with 1-second safety timeout)
async function fetchLiveViews(videoId) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // Fail fast

    try {
        const response = await fetch(`https://api.counterapi.dev/v1/viralhub_views/${videoId}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
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

// Open Player Screen (Starts with hidden view)
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
        mainVideo.src = video.videoUrl;
        mainVideo.play().catch(() => {});
    }

    addToHistory(video.id);
    renderSuggestedVideos(video.id);
    updatePlayerFavBtn(video.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    // Load suggested view counts asynchronously
    filtered.slice(0, 8).forEach(async (video) => {
        const views = await fetchLiveViews(video.id);
        const viewSpan = document.getElementById(`suggested-views-${video.id}`);
        if (viewSpan) {
            viewSpan.innerHTML = `<i class="fa-regular fa-eye"></i> ${views} views`;
        }
    });
}

function switchTab(tabName) {
    const title = document.getElementById('sectionTitle');
    const gridView = document.getElementById('gridView');
    
    gridView.style.display = "block";
    document.getElementById('playerView').style.display = "none";
    document.getElementById('backBtn').classList.remove('visible');
    mainVideo.pause();

    if (tabName === 'all') {
        title.innerText = "Latest Videos";
        renderVideos(videos, false);
    } else if (tabName === 'favorites') {
        title.innerText = "Favorite Videos";
        renderVideos(videos.filter(v => favorites.includes(v.id)), false);
    } else if (tabName === 'most_viewed') {
        title.innerText = "Most Viewed Videos 🔥";
        renderVideos(videos, true); // Sort by Views
    } else if (tabName === 'history') {
        title.innerText = "Recently Viewed";
        renderVideos(historyList.map(id => videos.find(v => v.id === id)).filter(Boolean), false);
    }
}

function showGridView() {
    document.getElementById('playerView').style.display = "none";
    document.getElementById('gridView').style.display = "block";
    document.getElementById('backBtn').classList.remove('visible');
    mainVideo.pause();
    iframeContainer.innerHTML = "";
}

function toggleSearchOverlay() {
    document.getElementById('searchOverlay').classList.toggle('active');
}

function filterVideosFromBottom(event) {
    const query = event.target.value.toLowerCase();
    const filtered = videos.filter(v => v.title.toLowerCase().includes(query));
    renderVideos(filtered);
}

// Submissions
async function handleContactSubmission(event) {
    event.preventDefault();
    const name = document.getElementById('contactName').value;
    const phone = document.getElementById('contactPhone').value;
    const message = document.getElementById('contactMessage').value;

    const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, message })
    });

    if (response.ok) {
        closeModal('contactModal');
        showToast('Message sent successfully!');
        document.getElementById('contactForm').reset();
    } else {
        showToast('Failed to send message.');
    }
}

function handleFileSelected(event) {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
        selectedFileBase64 = reader.result;
    };
    reader.readAsDataURL(file);
}

async function handleVideoSubmission(event) {
    event.preventDefault();
    const title = document.getElementById('submitTitle').value;
    const thumb = document.getElementById('submitThumb').value;
    const videoUrl = document.getElementById('submitUrl').value;

    const payload = {
        title,
        thumbnailUrl: thumb || "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?q=80&w=1200&auto=format&fit=crop",
        videoUrl: videoUrl || selectedFileBase64
    };

    const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (response.ok) {
        closeModal('uploadModal');
        showToast('Video submitted for approval!');
        document.getElementById('uploadForm').reset();
    } else {
        showToast('Submission failed.');
    }
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

function updatePlayerFavBtn(id) {
    const btn = document.getElementById('playerFavBtn');
    const isFav = favorites.includes(id);
    btn.innerHTML = isFav ? `<i class="fa-solid fa-heart" style="color:#e91e63;"></i>` : `<i class="fa-regular fa-heart"></i>`;
    btn.onclick = () => toggleFavorite(id, btn.querySelector('i'));
}

function addToHistory(id) {
    if (isWatchHistoryPaused) return;
    historyList = historyList.filter(item => item !== id);
    historyList.unshift(id);
    localStorage.setItem('vh_history', JSON.stringify(historyList));
}

function toggleMenuDrawer() {
    document.getElementById('menuDrawer').classList.toggle('open');
    document.getElementById('menuOverlay').classList.toggle('active');
}

function openModal(id) {
    toggleMenuDrawer();
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function showToast(msg) {
    const toast = document.getElementById('toastMessage');
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function setActiveNavItem(id) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

function resetFilters() {
    document.getElementById('bottomSearchInput').value = "";
    renderVideos(videos);
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
