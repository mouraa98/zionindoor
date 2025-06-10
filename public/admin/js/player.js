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
const connectionStatus = document.getElementById('connection-status');

if (!tvCode) {
  document.getElementById('loading').innerHTML = `
    Código da TV não especificado!<br><br>
    Acesse usando:<br>
    • <a href="/p/0102">/p/0102</a><br>
    • <a href="/player?code=0102">/player?code=0102</a>
  `;
  throw new Error('Código da TV não especificado');
}

console.log('Código da TV detectado:', tvCode);

const loadingElement = document.getElementById('loading');
const imgElement = document.getElementById('current-content');
const videoElement = document.getElementById('video-content');
const htmlElement = document.getElementById('html-content');

let currentContentIndex = 0;
let contents = [];
let contentInterval;

// Comparador de conteúdo
function contentsAreDifferent(a, b) {
  if (a.length !== b.length) return true;
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
      connectionStatus.textContent = '';
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
  }
}

// Exibe conteúdo
function playContent(index) {
  if (contents.length === 0) return;
  if (index >= contents.length) index = 0;

  currentContentIndex = index;
  const content = contents[index];

  imgElement.classList.add('hidden');
  videoElement.classList.add('hidden');
  htmlElement.classList.add('hidden');

  switch (content.type) {
    case 'IMAGE':
      imgElement.onload = () => {
        imgElement.classList.remove('hidden');
        startContentTimer(content.duration);
      };
      imgElement.onerror = () => {
        console.error('Erro ao carregar imagem:', content.filePath);
        playNextContent();
      };
      imgElement.src = `/uploads/${content.filePath}?t=${Date.now()}`;
      break;

    case 'VIDEO':
      videoElement.onloadeddata = () => {
        videoElement.classList.remove('hidden');
        videoElement.play().catch(e => console.error('Erro ao reproduzir vídeo:', e));
      };
      videoElement.onerror = () => {
        console.error('Erro ao carregar vídeo:', content.filePath);
        playNextContent();
      };
      videoElement.src = `/uploads/${content.filePath}?t=${Date.now()}`;
      videoElement.loop = content.duration === 0;
      break;

    case 'HTML':
      htmlElement.innerHTML = `
  <iframe 
    src="/uploads/${content.filePath}?t=${Date.now()}" 
    frameborder="0" 
    width="100%" 
    height="100%" 
    style="border: none; width: 100%; height: 100%;">
  </iframe>
`;
htmlElement.classList.remove('hidden');
startContentTimer(content.duration);

      break;
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

// Evento fim do vídeo
videoElement.onended = playNextContent;

// Verifica conexão a cada 10s
setInterval(checkConnection, 10000);

// Verifica novos conteúdos a cada 30s
setInterval(loadContents, 30000);

// WebSocket para atualizações em tempo real
const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const ws = new WebSocket(`${protocol}://${location.host}/ws/tv/${tvCode}`);


ws.onmessage = (event) => {
  console.log('Atualização via WebSocket recebida:', event.data);
  loadContents(); // Atualiza a lista imediatamente
};

ws.onopen = () => {
  console.log('WebSocket conectado');
};

ws.onerror = (err) => {
  console.error('Erro no WebSocket:', err);
};

// Início
checkConnection();
loadContents();
