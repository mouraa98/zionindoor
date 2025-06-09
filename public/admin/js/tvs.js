document.addEventListener('DOMContentLoaded', async () => {
  // Verificação de login
  try {
    const response = await fetch('/api/auth/me');
    if (!response.ok) {
      window.location.href = '/admin/login.html';
      return;
    }
  } catch (error) {
    window.location.href = '/admin/login.html';
  }

  // Elementos
  const addTvBtn = document.getElementById('addTvBtn');
  const tvModal = document.getElementById('tvModal');
  const closeTvModal = document.getElementById('closeTvModal');
  const cancelTvBtn = document.getElementById('cancelTvBtn');
  const tvForm = document.getElementById('tvForm');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const closeToast = document.getElementById('closeToast');

  // Variáveis globais
  let tvStatusMap = {};

  // Inicialização
  loadTVs();
  initTvStatusWebSocket();

  // Função auxiliar para adicionar listener só se o elemento existir
  function safeAddListener(el, event, fn) {
    if (el) el.addEventListener(event, fn);
  }

  // Event Listeners seguros
  safeAddListener(addTvBtn, 'click', () => openTvModal());
  safeAddListener(closeTvModal, 'click', () => tvModal.classList.add('hidden'));
  safeAddListener(cancelTvBtn, 'click', () => tvModal.classList.add('hidden'));
  safeAddListener(closeToast, 'click', () => toast.classList.add('hidden'));
  safeAddListener(tvForm, 'submit', saveTV);

  // Funções

  async function loadTVs() {
    try {
      const response = await fetch('/api/tvs');
      if (!response.ok) throw new Error('Erro ao carregar TVs');

      const tvs = await response.json();
      const tvList = document.getElementById('tvList');
      if (!tvList) return;

      tvList.innerHTML = '';

      if (tvs.length === 0) {
        tvList.innerHTML = `
          <tr>
            <td colspan="5" class="px-6 py-4 text-center text-gray-500">
              Nenhuma TV cadastrada. Clique em "Adicionar TV" para começar.
            </td>
          </tr>
        `;
        return;
      }

      tvs.forEach(tv => {
        const isOnline = tvStatusMap[tv.code] ?? false;
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        row.innerHTML = `
          <td class="px-6 py-4 whitespace-nowrap">${tv.name}</td>
          <td class="px-6 py-4 whitespace-nowrap font-mono">${tv.code}</td>
          <td class="px-6 py-4 whitespace-nowrap">${tv.location || '-'}</td>
          <td class="px-6 py-4 whitespace-nowrap">
            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
              ${isOnline ? 'Conectada' : 'Desconectada'}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button data-id="${tv.id}" class="edit-tv-btn text-blue-600 hover:text-blue-900 mr-3">
              <i class="fas fa-edit mr-1"></i> Editar
            </button>
            <button data-id="${tv.id}" class="delete-tv-btn text-red-600 hover:text-red-900">
              <i class="fas fa-trash mr-1"></i> Excluir
            </button>
          </td>
        `;
        tvList.appendChild(row);
      });

      // Adicionar eventos aos botões de editar/excluir
      document.querySelectorAll('.edit-tv-btn').forEach(btn => {
        btn.addEventListener('click', () => openTvModal(btn.dataset.id));
      });

      document.querySelectorAll('.delete-tv-btn').forEach(btn => {
        btn.addEventListener('click', () => confirmDelete('TV', btn.dataset.id, deleteTV));
      });

    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function initTvStatusWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
const socket = new WebSocket(`${protocol}://${location.host}/ws/admin/tvs-status`);


    socket.addEventListener('open', () => {
      console.log('[WebSocket] Conectado ao status das TVs');
    });

    socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'status') {
          tvStatusMap[data.code] = data.status === 'online';
          updateTvStatusInTable(data.code, data.status === 'online');
        }
      } catch (e) {
        console.error('Erro ao processar mensagem WebSocket:', e);
      }
    });

    socket.addEventListener('close', () => {
      console.warn('[WebSocket] Desconectado. Tentando reconectar em 5s...');
      setTimeout(initTvStatusWebSocket, 5000);
    });
  }

  function updateTvStatusInTable(code, isOnline) {
    const rows = document.querySelectorAll('#tvList tr');
    rows.forEach(row => {
      const codeCell = row.children[1];
      if (codeCell && codeCell.textContent === code) {
        const statusCell = row.children[3];
        statusCell.innerHTML = `
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${isOnline ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
            ${isOnline ? 'Conectada' : 'Desconectada'}
          </span>
        `;
      }
    });
  }

  async function openTvModal(tvId = null) {
    const title = document.getElementById('modalTvTitle');
    if (!tvModal || !title || !tvForm) return;

    if (tvId) {
      title.textContent = 'Editar TV';
      try {
        const response = await fetch(`/api/tvs/${tvId}`);
        if (!response.ok) throw new Error('Erro ao carregar TV');
        const tv = await response.json();
        document.getElementById('tvId').value = tv.id;
        document.getElementById('tvName').value = tv.name;
        document.getElementById('tvCode').value = tv.code;
        document.getElementById('tvLocation').value = tv.location || '';
        document.getElementById('tvDescription').value = tv.description || '';
      } catch (error) {
        showToast(error.message, 'error');
        return;
      }
    } else {
      title.textContent = 'Adicionar TV';
      tvForm.reset();
      document.getElementById('tvId').value = '';
    }

    tvModal.classList.remove('hidden');
  }

  async function saveTV(e) {
    e.preventDefault();

    const formData = {
      name: document.getElementById('tvName').value,
      code: document.getElementById('tvCode').value,
      location: document.getElementById('tvLocation').value,
      description: document.getElementById('tvDescription').value
    };

    const tvId = document.getElementById('tvId').value;
    const url = tvId ? `/api/tvs/${tvId}` : '/api/tvs';
    const method = tvId ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar TV');
      }

      tvModal.classList.add('hidden');
      showToast(`TV ${tvId ? 'atualizada' : 'adicionada'} com sucesso!`, 'success');
      loadTVs();

    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function deleteTV(tvId) {
    try {
      const response = await fetch(`/api/tvs/${tvId}`, { method: 'DELETE' });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao excluir TV');
      }

      showToast('TV excluída com sucesso!', 'success');
      loadTVs();

    } catch (error) {
      showToast(error.message.includes('midia') ? 'Para deletar uma TV, desvincule as mídias dela primeiro.' : error.message, 'error');
    }
  }

  function confirmDelete(itemType, itemId, deleteFunction) {
    const confirmModal = document.getElementById('confirmModal');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    const closeConfirmModal = document.getElementById('closeConfirmModal');

    if (!confirmModal || !confirmTitle || !confirmMessage || !confirmBtn || !cancelConfirmBtn || !closeConfirmModal) return;

    confirmTitle.textContent = `Excluir ${itemType}`;
    confirmMessage.textContent = `Tem certeza que deseja excluir esta ${itemType}? Esta ação não pode ser desfeita.`;

    // Limpa listeners anteriores
    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    const newConfirmBtn = document.getElementById('confirmBtn');

    newConfirmBtn.addEventListener('click', () => {
      deleteFunction(itemId);
      confirmModal.classList.add('hidden');
    });

    cancelConfirmBtn.addEventListener('click', () => confirmModal.classList.add('hidden'));
    closeConfirmModal.addEventListener('click', () => confirmModal.classList.add('hidden'));

    confirmModal.classList.remove('hidden');
  }

  function showToast(message, type = 'info') {
    if (!toast || !toastMessage) return;
    toastMessage.textContent = message;
    toast.className = ''; // reseta classes
    toast.classList.add('toast', 'fixed', 'bottom-4', 'right-4', 'p-4', 'rounded', 'shadow-lg', 'flex', 'items-center', 'space-x-3', 'z-50');

    if (type === 'success') {
      toast.classList.add('bg-green-500', 'text-white');
    } else if (type === 'error') {
      toast.classList.add('bg-red-500', 'text-white');
    } else {
      toast.classList.add('bg-gray-700', 'text-white');
    }

    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }
});
