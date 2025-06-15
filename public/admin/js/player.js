document.addEventListener('DOMContentLoaded', () => {
  // Elementos do DOM
  const connectionStatus = document.getElementById('connection-status');
  const loadingElement = document.getElementById('loading');
  const imgElement = document.getElementById('current-content');
  const videoElement = document.getElementById('video-content');
  const htmlElement = document.getElementById('html-content');

  // Função para extrair o código da TV
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
      Código da TV não especificado!<br><br>
      Acesse usando:<br>
      • <a href="/p/0102">/p/0102</a><br>
      • <a href="/player?code=0102">/player?code=0102</a>
    `;
    return;
  }

  console.log('Código da TV detectado:', tvCode);

  // Variáveis de estado
  let currentContentIndex = 0;
  let contents = [];
  let contentInterval;
  let isPlayingVideo = false;

  // Verifica se vídeo é vertical
  function isVerticalVideo(video) {
    return video.videoHeight > video.videoWidth;
  }

  // Ajusta rotação do vídeo
  function adjustVideoRotation() {
    if (videoElement.videoWidth && videoElement.videoHeight) {
      const isVertical = isVerticalVideo(videoElement);
      videoElement.classList.toggle('vertical-video', isVertical);
    }
  }

  // Verifica se imagem é vertical
  function isVerticalImage(img) {
    return img.naturalHeight > img.naturalWidth;
  }

  // Ajusta rotação da imagem
  function adjustImageRotation() {
    if (imgElement.complete && imgElement.naturalWidth && imgElement.naturalHeight) {
      const isVertical = isVerticalImage(imgElement);
      imgElement.classList.toggle('vertical-image', isVertical);
    }
  }

  // Configura listeners
  videoElement.addEventListener('loadedmetadata', adjustVideoRotation);
  imgElement.addEventListener('load', adjustImageRotation);

  // Limpar recursos do conteúdo anterior
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

  // Comparador de conteúdo
  function contentsAreDifferent(a, b) {
    if (!a || !b || a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (
        a[i].filePath !== b[i].filePath ||
        a[i].type !== b[i].type ||
        a[i].duration !== b[i].duration
      ) {
        return true;
      }
    }
    return false;
  }

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

  // Carrega conteúdos
  async function loadContents() {
    try {
      const response = await fetch(`/api/contents/tv/${tvCode}`);
      if (!response.ok) throw new Error('Erro ao carregar conteúdos');

      const newContents = await response.json();
      if (contentsAreDifferent(contents, newContents)) {
        console.log('Lista de reprodução atualizada:', newContents);
        contents = newContents;

        if (contents.length === 0) {
          loadingElement.textContent = 'Nenhum conteúdo disponível para esta TV.';
          loadingElement.classList.remove('hidden');
          return;
        }

        loadingElement.classList.add('hidden');
        playContent(0);
      }
    } catch (error) {
      console.error('Erro ao carregar conteúdos:', error);
      loadingElement.textContent = 'Erro ao carregar conteúdos. Tentando novamente...';
      loadingElement.classList.remove('hidden');
      setTimeout(loadContents, 5000);
    }
  }

  // Função corrigida para loop infinito
  function playNextContent() {
    if (!contents || contents.length === 0) {
      console.warn('Nenhum conteúdo disponível - tentando recarregar');
      setTimeout(loadContents, 5000);
      return;
    }
    
    const nextIndex = (currentContentIndex + 1) % contents.length;
    console.log(`Avançando para conteúdo ${nextIndex + 1}/${contents.length}`);
    playContent(nextIndex);
  }

  // Exibe conteúdo com loop corrigido
  function playContent(index) {
    if (!contents || contents.length === 0) {
      console.warn('Playlist vazia - aguardando conteúdo...');
      setTimeout(loadContents, 5000);
      return;
    }

    // Garante que o índice esteja dentro dos limites
    currentContentIndex = index % contents.length;
    const content = contents[currentContentIndex];
    
    console.log(`Iniciando conteúdo ${currentContentIndex + 1}/${contents.length}:`, content);

    // Reset completo do vídeo antes de cada reprodução
    if (isPlayingVideo) {
      videoElement.pause();
      videoElement.removeAttribute('src');
      videoElement.load();
      isPlayingVideo = false;
    }

    // Oculta todos os elementos primeiro
    imgElement.classList.add('hidden');
    videoElement.classList.add('hidden');
    htmlElement.classList.add('hidden');

    if (!content || !content.type || !content.filePath) {
      console.error('Conteúdo inválido:', content);
      setTimeout(playNextContent, 1000);
      return;
    }

    const contentType = content.type.toUpperCase();
    const contentPath = `/uploads/${content.filePath}?t=${Date.now()}`;

    switch (contentType) {
      case 'IMAGE':
        imgElement.onload = function() {
          adjustImageRotation();
          startContentTimer(content.duration);
          imgElement.classList.remove('hidden');
          console.log('Imagem carregada com sucesso');
        };
        imgElement.onerror = function() {
          console.error('Falha ao carregar imagem:', contentPath);
          setTimeout(playNextContent, 1000);
        };
        imgElement.src = contentPath;
        break;

      case 'VIDEO':
        // Remove listeners antigos para evitar duplicação
        videoElement.onloadeddata = null;
        videoElement.onerror = null;
        videoElement.onended = null;

        videoElement.controls = false;
        videoElement.loop = content.duration === 0;
        videoElement.muted = true;
        videoElement.playsInline = true;
        videoElement.setAttribute('webkit-playsinline', 'true');

        videoElement.onloadeddata = function() {
          adjustVideoRotation();
          isPlayingVideo = true;
          videoElement.classList.remove('hidden');
          console.log('Vídeo carregado - iniciando reprodução');
          videoElement.play().catch(e => {
            console.warn('Autoplay bloqueado, tentando com muted...', e);
            videoElement.muted = true;
            videoElement.play().catch(e2 => {
              console.error('Falha na reprodução:', e2);
              setTimeout(playNextContent, 1000);
            });
          });
        };

        videoElement.onerror = function() {
          console.error('Falha ao carregar vídeo:', contentPath);
          setTimeout(playNextContent, 1000);
        };

        videoElement.onended = function() {
          console.log('Vídeo concluído - avançando para próximo');
          if (!videoElement.loop) playNextContent();
        };

        videoElement.src = contentPath;
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
        console.log('Conteúdo HTML carregado');
        startContentTimer(content.duration);
        break;

      default:
        console.error('Tipo de conteúdo desconhecido:', contentType);
        setTimeout(playNextContent, 1000);
    }
  }

  // Timer do conteúdo
  function startContentTimer(duration) {
    // Limpa timer anterior
    if (contentInterval) {
      clearTimeout(contentInterval);
      contentInterval = null;
    }

    // Só cria novo timer se duration for válido
    if (duration > 0) {
      console.log(`Agendando próximo conteúdo em ${duration} segundos`);
      contentInterval = setTimeout(() => {
        console.log('Timer concluído - avançando conteúdo');
        playNextContent();
      }, duration * 1000);
    }
  }

  // Verifica conexão a cada 10s
  setInterval(checkConnection, 10000);

  // Verifica novos conteúdos a cada 30s
  setInterval(loadContents, 30000);

  // WebSocket para atualizações em tempo real
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${protocol}://${location.host}/ws/tv/${tvCode}`);

  ws.onmessage = (event) => {
    console.log('Atualização via WebSocket recebida:', event.data);
    loadContents();
  };

  ws.onopen = () => {
    console.log('WebSocket conectado');
    connectionStatus.textContent = 'Online (WS)';
    connectionStatus.className = 'status-connected';
  };

  ws.onerror = (err) => {
    console.error('Erro no WebSocket:', err);
    connectionStatus.textContent = 'Offline (WS)';
    connectionStatus.className = 'status-disconnected';
  };

  // Debug adicional
  setInterval(() => {
    console.log('Estado atual:', {
      index: currentContentIndex,
      contentsLength: contents.length,
      playingVideo: isPlayingVideo,
      timerActive: !!contentInterval,
      videoState: videoElement.readyState,
      videoPaused: videoElement.paused
    });
  }, 5000);

  // Início
  checkConnection();
  loadContents();
});