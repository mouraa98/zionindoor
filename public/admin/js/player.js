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

      // Limpar recursos do vídeo anterior
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
            console.log('Lista de reprodução atualizada');
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
          
          // Tentar novamente após 5 segundos
          setTimeout(loadContents, 5000);
        }
      }

      // Exibe conteúdo
      function playContent(index) {
        if (!contents || contents.length === 0) return;
        if (index >= contents.length) index = 0;

        currentContentIndex = index;
        const content = contents[index];

        cleanupPreviousContent();

        // Verifica se o conteúdo é válido
        if (!content || !content.type || !content.filePath) {
          console.error('Conteúdo inválido:', content);
          playNextContent();
          return;
        }

        const contentType = content.type.toUpperCase();
        const contentPath = `/uploads/${content.filePath}?t=${Date.now()}`;

        // Oculta todos os elementos primeiro
        imgElement.classList.add('hidden');
        videoElement.classList.add('hidden');
        htmlElement.classList.add('hidden');

        switch (contentType) {
          case 'IMAGE':
            imgElement.onload = function() {
              adjustImageRotation();
              startContentTimer(content.duration);
            };
            imgElement.onerror = function() {
              console.error('Erro ao carregar imagem:', contentPath);
              playNextContent();
            };
            imgElement.src = contentPath;
            imgElement.classList.remove('hidden');
            break;

          case 'VIDEO':
            videoElement.onloadeddata = function() {
              adjustVideoRotation();
              isPlayingVideo = true;
              videoElement.play().catch(e => console.error('Erro ao reproduzir vídeo:', e));
            };
            videoElement.onerror = function() {
              console.error('Erro ao carregar vídeo:', contentPath);
              playNextContent();
            };
            videoElement.onended = function() {
              if (!videoElement.loop) playNextContent();
            };
            videoElement.loop = content.duration === 0;
            videoElement.src = contentPath;
            videoElement.classList.remove('hidden');
            break;

          case 'HTML':
            const iframe = document.createElement('iframe');
            iframe.src = contentPath;
            iframe.frameBorder = 0;
            iframe.style.width = '100%';
            iframe.style.height = '100%';

            htmlElement.innerHTML = '';
            htmlElement.appendChild(iframe);
            htmlElement.classList.remove('hidden');

            startContentTimer(content.duration);
            break;

          default:
            console.error('Tipo de conteúdo desconhecido:', contentType);
            playNextContent();
        }
      }

      // Timer do conteúdo
      function startContentTimer(duration) {
        if (contentInterval) clearTimeout(contentInterval);
        if (duration > 0) {
          contentInterval = setTimeout(playNextContent, duration * 1000);
        }
      }

      // Próximo conteúdo
      function playNextContent() {
        playContent(currentContentIndex + 1);
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

      // Início
      checkConnection();
      loadContents();
    });