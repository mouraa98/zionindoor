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
  const addContentBtn = document.getElementById('addContentBtn');
  const contentModal = document.getElementById('contentModal');
  const closeContentModal = document.getElementById('closeContentModal');
  const cancelContentBtn = document.getElementById('cancelContentBtn');
  const contentForm = document.getElementById('contentForm');
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toastMessage');
  const closeToast = document.getElementById('closeToast');
  const confirmModal = document.getElementById('confirmModal');
  const filterTv = document.getElementById('filterTv');
  const tvGroupsContainer = document.getElementById('tvGroupsContainer');

  // Variável para armazenar todas as TVs
  let allTvs = [];

  // Carregar dados iniciais
  await loadTvs();
  await loadContents();

  // Event listeners
  addContentBtn.addEventListener('click', () => openContentModal());
  closeContentModal.addEventListener('click', () => contentModal.classList.add('hidden'));
  cancelContentBtn.addEventListener('click', () => contentModal.classList.add('hidden'));
  closeToast.addEventListener('click', () => toast.classList.add('hidden'));
  contentForm.addEventListener('submit', saveContent);
  filterTv.addEventListener('change', () => {
    const tvId = filterTv.value;
    loadContents(tvId);
  });

  async function loadTvs() {
    try {
      const response = await fetch('/api/tvs');
      if (!response.ok) throw new Error('Erro ao carregar TVs');
      
      allTvs = await response.json();
      
      // Preencher filtro
      filterTv.innerHTML = '<option value="">Todas as TVs</option>';
      allTvs.forEach(tv => {
        const option = document.createElement('option');
        option.value = tv.id;
        option.textContent = tv.name;
        filterTv.appendChild(option);
      });
      
      return allTvs;
    } catch (error) {
      showToast(error.message, 'error');
      return [];
    }
  }

  async function loadContents(tvId = '') {
    try {
      let url = '/api/contents';
      if (tvId) {
        url += `?tvId=${tvId}`;
      }
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Erro ao carregar conteúdos');
      
      const contents = await response.json();
      renderContentsByTv(contents, allTvs, tvId);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function renderContentsByTv(contents, tvs, filterTvId = '') {
    tvGroupsContainer.innerHTML = '';
    
    // Se não houver nenhum conteúdo
    if (contents.length === 0) {
        tvGroupsContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                Nenhum conteúdo encontrado
            </div>
        `;
        return;
    }
    
    // Agrupar conteúdos por TV
    const contentsByTv = {};
    contents.forEach(content => {
        const tv = tvs.find(t => t.id === content.tvId) || { id: content.tvId, name: 'TV Desconhecida' };
        
        // Se estiver filtrando, só adiciona se for a TV selecionada
        if (filterTvId && tv.id !== filterTvId) return;
        
        if (!contentsByTv[tv.id]) {
            contentsByTv[tv.id] = {
                tv,
                contents: []
            };
        }
        contentsByTv[tv.id].contents.push(content);
    });
    
    // Se não encontrou nenhum grupo (todos filtrados)
    if (Object.keys(contentsByTv).length === 0) {
        tvGroupsContainer.innerHTML = `
            <div class="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                Nenhum conteúdo encontrado para esta TV
            </div>
        `;
        return;
    }
    
    // Renderizar cada grupo de TV
    Object.values(contentsByTv).forEach(group => {
        const groupElement = document.createElement('div');
        groupElement.className = 'tv-group';
        
        groupElement.innerHTML = `
            <div class="tv-group-header">
                <span>${group.tv.name}</span>
                <span class="text-sm font-normal">${group.contents.length} conteúdo(s)</span>
            </div>
            <div class="tv-group-content">
                <table class="tv-group-table w-full">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Tipo</th>
                            <th>Duração (s)</th>
                            <th>Ações</th>
                        </tr>
                    </thead>
                    <tbody id="tv-${group.tv.id}-contents">
                        ${group.contents.length === 0 ? `
                            <tr>
                                <td colspan="4" class="px-6 py-4 text-center text-gray-500">
                                    Nenhum conteúdo cadastrado para esta TV
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `;
        
        tvGroupsContainer.appendChild(groupElement);
        
        // Preencher conteúdos da TV (apenas se houver conteúdos)
        if (group.contents.length > 0) {
            const tbody = groupElement.querySelector(`#tv-${group.tv.id}-contents`);
            tbody.innerHTML = ''; // Limpa a mensagem de "Nenhum conteúdo"
            
            group.contents.forEach(content => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition-colors';
                
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap">${content.title}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeBadgeClass(content.type)}">
                            ${getTypeDisplay(content.type)}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">${content.duration}s</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button data-id="${content.id}" class="edit-content-btn text-blue-600 hover:text-blue-900 mr-3">
                            <i class="fas fa-edit mr-1"></i> Editar
                        </button>
                        <button data-id="${content.id}" class="delete-content-btn text-red-600 hover:text-red-900">
                            <i class="fas fa-trash mr-1"></i> Excluir
                        </button>
                    </td>
                `;
                
                tbody.appendChild(row);
            });
            
            // Adicionar event listeners
            groupElement.querySelectorAll('.edit-content-btn').forEach(btn => {
                btn.addEventListener('click', () => openContentModal(btn.dataset.id));
            });
            
            groupElement.querySelectorAll('.delete-content-btn').forEach(btn => {
                btn.addEventListener('click', () => confirmDelete('Conteúdo', btn.dataset.id, deleteContent));
            });
        }
    });
}

  function getTypeDisplay(type) {
    const types = {
      'IMAGE': 'Imagem',
      'VIDEO': 'Vídeo',
      'HTML': 'HTML'
    };
    return types[type] || type;
  }

  function getTypeBadgeClass(type) {
    const classes = {
      'IMAGE': 'bg-purple-100 text-purple-800',
      'VIDEO': 'bg-blue-100 text-blue-800',
      'HTML': 'bg-yellow-100 text-yellow-800'
    };
    return classes[type] || 'bg-gray-100 text-gray-800';
  }

  async function openContentModal(contentId = null) {
    const title = document.getElementById('modalContentTitle');
    const tvSelect = document.getElementById('contentTv');

    try {
      const response = await fetch('/api/tvs');
      if (!response.ok) throw new Error('Erro ao carregar TVs');

      const tvs = await response.json();
      tvSelect.innerHTML = '<option value="">Selecione uma TV</option>';
      tvs.forEach(tv => {
        const option = document.createElement('option');
        option.value = tv.id;
        option.textContent = tv.name;
        tvSelect.appendChild(option);
      });

      if (contentId) {
        title.textContent = 'Editar Conteúdo';
        const contentResponse = await fetch(`/api/contents/${contentId}`);
        if (!contentResponse.ok) throw new Error('Erro ao carregar conteúdo');

        const content = await contentResponse.json();
        document.getElementById('contentId').value = content.id;
        document.getElementById('contentTitle').value = content.title;
        document.getElementById('contentDescription').value = content.description || '';
        document.getElementById('contentType').value = content.type;
        document.getElementById('contentDuration').value = content.duration;
        document.getElementById('contentTv').value = content.tvId;
        document.getElementById('contentFile').required = false;

      } else {
        title.textContent = 'Adicionar Conteúdo';
        contentForm.reset();
        document.getElementById('contentId').value = '';
        document.getElementById('contentFile').required = true;
      }

      contentModal.classList.remove('hidden');

    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  async function saveContent(e) {
    e.preventDefault();

    const formData = new FormData();
    formData.append('title', document.getElementById('contentTitle').value);
    formData.append('description', document.getElementById('contentDescription').value);
    formData.append('type', document.getElementById('contentType').value);
    formData.append('duration', document.getElementById('contentDuration').value);
    formData.append('tvId', document.getElementById('contentTv').value);

    const fileInput = document.getElementById('contentFile');
    if (fileInput.files.length > 0) {
      formData.append('file', fileInput.files[0]);
    }

    const contentId = document.getElementById('contentId').value;
    const url = contentId ? `/api/contents/${contentId}` : '/api/contents';
    const method = contentId ? 'PUT' : 'POST';

    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressPercent = document.getElementById('uploadProgressPercent');

    progressContainer.classList.remove('hidden');
    progressBar.style.width = '0%';
    progressPercent.textContent = '0%';

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);

        xhr.upload.onprogress = function (event) {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            progressBar.style.width = percentComplete + '%';
            progressPercent.textContent = percentComplete + '%';
          }
        };

        xhr.onload = function () {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            let errorMsg = 'Erro ao salvar conteúdo';
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.message) errorMsg = res.message;
            } catch {}
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = function () {
          reject(new Error('Erro de rede durante o upload'));
        };

        xhr.send(formData);
      });

      progressContainer.classList.add('hidden');
      progressBar.style.width = '0%';
      progressPercent.textContent = '0%';

      contentModal.classList.add('hidden');
      showToast(`Conteúdo ${contentId ? 'atualizado' : 'adicionado'} com sucesso!`, 'success');
      loadContents(filterTv.value);

    } catch (error) {
      progressContainer.classList.add('hidden');
      progressBar.style.width = '0%';
      progressPercent.textContent = '0%';
      showToast(error.message, 'error');
    }
  }

  async function deleteContent(contentId) {
    try {
      const response = await fetch(`/api/contents/${contentId}`, { method: 'DELETE' });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao excluir conteúdo');
      }

      showToast('Conteúdo excluído com sucesso!', 'success');
      loadContents(filterTv.value);

    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  function confirmDelete(itemType, itemId, deleteFunction) {
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmBtn');
    const cancelConfirmBtn = document.getElementById('cancelConfirmBtn');
    const closeConfirmModal = document.getElementById('closeConfirmModal');

    confirmTitle.textContent = `Excluir ${itemType}`;
    confirmMessage.textContent = `Tem certeza que deseja excluir este ${itemType}? Esta ação não pode ser desfeita.`;

    confirmBtn.replaceWith(confirmBtn.cloneNode(true));
    cancelConfirmBtn.replaceWith(cancelConfirmBtn.cloneNode(true));
    closeConfirmModal.replaceWith(closeConfirmModal.cloneNode(true));

    document.getElementById('confirmBtn').addEventListener('click', () => {
      confirmModal.classList.add('hidden');
      deleteFunction(itemId);
    });

    document.getElementById('cancelConfirmBtn').addEventListener('click', () => {
      confirmModal.classList.add('hidden');
    });

    document.getElementById('closeConfirmModal').addEventListener('click', () => {
      confirmModal.classList.add('hidden');
    });

    confirmModal.classList.remove('hidden');
  }

  function showToast(message, type = 'info') {
    toast.className = `fixed bottom-4 right-4 flex items-center px-4 py-3 rounded-lg shadow-lg transition-all`;
    toast.classList.add(`toast-${type}`);
    toastMessage.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 5000);
  }
});