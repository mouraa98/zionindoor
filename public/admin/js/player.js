document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const connectionStatus = document.getElementById('connection-status');
  const loadingElement = document.getElementById('loading');
  const contentContainer = document.getElementById('content-container');
  const imgElement = document.getElementById('current-content');
  const videoElement = document.getElementById('video-content');
  const htmlElement = document.getElementById('html-content');

  // Get TV code from URL
  function getTVCode() {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');

    if (!code) {
      const pathParts = window.location.pathname.split('/').filter(part => part !== '');
      if (pathParts[0] === 'p' && pathParts.length > 1) {
        code = pathParts[1];
      }
    }

    return code;
  }

  const tvCode = getTVCode();

  if (!tvCode) {
    loadingElement.innerHTML = `
      TV code not specified!<br><br>
      Access using:<br>
      • <a href="/p/0102">/p/0102</a><br>
      • <a href="/player?code=0102">/player?code=0102</a>
    `;
    return;
  }

  console.log('TV code detected:', tvCode);

  // State variables
  let currentContentIndex = 0;
  let contents = [];
  let contentInterval;
  let isPlayingVideo = false;

  // Check if video is vertical
  function isVerticalVideo(video) {
    return video.videoHeight > video.videoWidth;
  }

  // Adjust video rotation
  function adjustVideoRotation() {
    if (videoElement.videoWidth && videoElement.videoHeight) {
      videoElement.classList.toggle('vertical-video', isVerticalVideo(videoElement));
    }
  }

  // Check if image is vertical
  function isVerticalImage(img) {
    return img.naturalHeight > img.naturalWidth;
  }

  // Adjust image rotation
  function adjustImageRotation() {
    if (imgElement.complete && imgElement.naturalWidth && imgElement.naturalHeight) {
      imgElement.classList.toggle('vertical-image', isVerticalImage(imgElement));
    }
  }

  // Setup listeners
  videoElement.addEventListener('loadedmetadata', adjustVideoRotation);
  imgElement.addEventListener('load', adjustImageRotation);

  // Clean up previous content
  function cleanupPreviousContent() {
    if (isPlayingVideo) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
      isPlayingVideo = false;
    }

    if (htmlElement.firstChild) {
      htmlElement.innerHTML = '';
    }
  }

  // Content comparison
  function contentsAreDifferent(a, b) {
    if (!a || !b || a.length !== b.length) return true;
    return a.some((item, i) => 
      item.filePath !== b[i].filePath ||
      item.type !== b[i].type ||
      item.duration !== b[i].duration
    );
  }

  // Check connection status
  function checkConnection() {
    fetch('/api/ping')
      .then(() => {
        connectionStatus.textContent = 'Online';
        connectionStatus.className = 'status-connected';
      })
      .catch(() => {
        connectionStatus.textContent = 'Offline';
        connectionStatus.className = 'status-disconnected';
      });
  }

  // Smooth transition effect
  async function applyTransition() {
    return new Promise(resolve => {
      contentContainer.style.opacity = '0';
      setTimeout(() => {
        contentContainer.style.opacity = '1';
        resolve();
      }, 500);
    });
  }

  // Load contents from API
  async function loadContents() {
    try {
      const response = await fetch(`/api/contents/tv/${tvCode}`);
      if (!response.ok) throw new Error('Failed to load contents');

      const newContents = await response.json();
      if (contentsAreDifferent(contents, newContents)) {
        console.log('Playlist updated');
        contents = newContents;

        if (contents.length === 0) {
          loadingElement.textContent = 'No content available for this TV.';
          loadingElement.classList.remove('hidden');
          return;
        }

        loadingElement.classList.add('hidden');
        await playContent(0);
      }
    } catch (error) {
      console.error('Error loading contents:', error);
      loadingElement.textContent = 'Error loading contents. Retrying...';
      loadingElement.classList.remove('hidden');
      setTimeout(loadContents, 5000);
    }
  }

  // Play content with index
  async function playContent(index) {
    if (!contents || contents.length === 0) return;
    if (index >= contents.length) index = 0;

    currentContentIndex = index;
    const content = contents[index];

    // Start transition out
    contentContainer.style.opacity = '0';
    await new Promise(resolve => setTimeout(resolve, 500));

    // Clean up and change content during transition
    cleanupPreviousContent();

    if (!content || !content.type || !content.filePath) {
      console.error('Invalid content:', content);
      await playNextContent();
      return;
    }

    const contentType = content.type.toUpperCase();
    const contentPath = `/uploads/${content.filePath}?t=${Date.now()}`;

    // Hide all elements first
    imgElement.classList.add('hidden');
    videoElement.classList.add('hidden');
    htmlElement.classList.add('hidden');

    switch (contentType) {
      case 'IMAGE':
        imgElement.onload = async function() {
          adjustImageRotation();
          startContentTimer(content.duration);
          await applyTransition();
        };
        imgElement.onerror = async function() {
          console.error('Error loading image:', contentPath);
          await playNextContent();
        };
        imgElement.src = contentPath;
        imgElement.classList.remove('hidden');
        break;

      case 'VIDEO':
        videoElement.controls = false;
        const preloader = document.createElement('video');
        preloader.preload = 'auto';
        preloader.src = contentPath;
        preloader.muted = true;
        preloader.playsInline = true;
        preloader.setAttribute('webkit-playsinline', 'true');

        preloader.addEventListener('canplaythrough', async () => {
          videoElement.src = preloader.src;
          videoElement.loop = content.duration === 0;
          videoElement.muted = true;
          videoElement.playsInline = true;
          videoElement.setAttribute('webkit-playsinline', 'true');

          videoElement.onloadeddata = async () => {
            adjustVideoRotation();
            isPlayingVideo = true;
            await applyTransition();
            
            try {
              await videoElement.play();
            } catch (e) {
              console.warn('Autoplay failed, trying with muted...');
              videoElement.muted = true;
              await videoElement.play().catch(e2 => console.error('Video play error:', e2));
            }
          };

          videoElement.onerror = async () => {
            console.error('Error loading video:', contentPath);
            await playNextContent();
          };

          videoElement.onended = async () => {
            if (!videoElement.loop) await playNextContent();
          };

          videoElement.classList.remove('hidden');
        }, { once: true });

        preloader.onerror = async () => {
          console.error('Error preloading video:', contentPath);
          await playNextContent();
        };
        break;

      case 'HTML':
        const iframe = document.createElement('iframe');
        iframe.src = contentPath;
        iframe.frameBorder = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';

        htmlElement.innerHTML = '';
        htmlElement.appendChild(iframe);
        htmlElement.classList.remove('hidden');
        await applyTransition();
        startContentTimer(content.duration);
        break;

      default:
        console.error('Unknown content type:', contentType);
        await playNextContent();
    }
  }

  // Start content timer
  function startContentTimer(duration) {
    if (contentInterval) clearTimeout(contentInterval);
    if (duration > 0) {
      contentInterval = setTimeout(() => playNextContent(), duration * 1000);
    }
  }

  // Play next content
  async function playNextContent() {
    await playContent(currentContentIndex + 1);
  }

  // Check connection every 10s
  setInterval(checkConnection, 10000);

  // Check for new contents every 30s
  setInterval(loadContents, 30000);

  // WebSocket for real-time updates
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws/tv/${tvCode}`);

  ws.onmessage = (event) => {
    console.log('WebSocket update received:', event.data);
    loadContents();
  };

  ws.onopen = () => {
    console.log('WebSocket connected');
    connectionStatus.textContent = 'Online (WS)';
    connectionStatus.className = 'status-connected';
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    connectionStatus.textContent = 'Offline (WS)';
    connectionStatus.className = 'status-disconnected';
  };

  // Initial setup
  contentContainer.style.transition = 'opacity 0.5s ease-in-out';
  checkConnection();
  loadContents();
});