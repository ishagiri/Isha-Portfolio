/**
 * ISHA'S PORTFOLIO - ADMIN DASHBOARD CLIENT CONTROLLER
 */

(function () {
  // Authentication check
  const token = localStorage.getItem('portfolio_admin_token');
  if (!token) {
    window.location.href = '/admin/login';
    return;
  }

  // Load and display current user
  try {
    const user = JSON.parse(localStorage.getItem('portfolio_admin_user') || '{}');
    if (user.username) {
      const usernameEl = document.getElementById('admin-username-display');
      const avatarEl = document.getElementById('admin-avatar');
      if (usernameEl) usernameEl.textContent = user.username;
      if (avatarEl) avatarEl.textContent = user.username.charAt(0).toUpperCase();
    }
  } catch (e) {}

  // State
  let allMessages = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let activeModalMessageId = null;

  // DOM Elements
  const tbody = document.getElementById('messages-tbody');
  const loader = document.getElementById('table-loader');
  const emptyState = document.getElementById('table-empty');
  const searchInput = document.getElementById('search-input');
  const filterBtns = document.querySelectorAll('.filter-btn[data-filter]');
  const refreshBtn = document.getElementById('refresh-btn');
  const logoutBtn = document.getElementById('logout-btn');

  // Stats Elements
  const statTotal = document.getElementById('stat-total');
  const statUnread = document.getElementById('stat-unread');
  const statRead = document.getElementById('stat-read');

  // Modal Elements
  const modal = document.getElementById('message-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalName = document.getElementById('modal-name');
  const modalEmailLink = document.getElementById('modal-email-link');
  const modalDate = document.getElementById('modal-date');
  const modalMessage = document.getElementById('modal-message');
  const modalReplyBtn = document.getElementById('modal-reply-btn');
  const modalToggleReadBtn = document.getElementById('modal-toggle-read-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');

  /**
   * Helper: Authorized Fetch Wrapper
   */
  async function authFetch(url, options = {}) {
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch(url, options);

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('portfolio_admin_token');
      localStorage.removeItem('portfolio_admin_user');
      window.location.href = '/admin/login';
      throw new Error('Session expired or unauthorized');
    }

    return response;
  }

  /**
   * Format ISO date string into readable format
   */
  function formatDate(isoString) {
    if (!isoString) return 'Just now';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return isoString;
    }
  }

  /**
   * Fetch all messages and overview stats
   */
  async function loadDashboard() {
    loader.style.display = 'block';
    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    try {
      const res = await authFetch('/api/admin/messages');
      const data = await res.json();

      if (data.success) {
        allMessages = data.messages || [];
        updateStats(allMessages);
        renderMessages();
      } else {
        alert(data.message || 'Failed to load messages.');
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    } finally {
      loader.style.display = 'none';
    }
  }

  /**
   * Update Stats Cards
   */
  function updateStats(messages) {
    const total = messages.length;
    const unread = messages.filter(m => !m.is_read).length;
    const read = total - unread;

    statTotal.textContent = total;
    statUnread.textContent = unread;
    statRead.textContent = read;
  }

  /**
   * Filter and Render Messages
   */
  function renderMessages() {
    let filtered = allMessages.slice();

    // 1. Status Filter
    if (currentFilter === 'unread') {
      filtered = filtered.filter(m => !m.is_read);
    } else if (currentFilter === 'read') {
      filtered = filtered.filter(m => m.is_read);
    }

    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(m =>
        (m.name && m.name.toLowerCase().includes(q)) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.message && m.message.toLowerCase().includes(q))
      );
    }

    tbody.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    filtered.forEach(msg => {
      const tr = document.createElement('tr');
      if (!msg.is_read) tr.classList.add('unread-row');

      const isUnread = !msg.is_read;
      const statusBadge = isUnread
        ? '<span class="badge unread"><i class="fa-solid fa-circle-dot"></i> Unread</span>'
        : '<span class="badge read"><i class="fa-solid fa-check"></i> Read</span>';

      tr.innerHTML = `
        <td style="white-space: nowrap; color: var(--text-secondary); font-size: 13px;">
          ${formatDate(msg.created_at)}
        </td>
        <td class="sender-cell">${escapeHtml(msg.name)}</td>
        <td>
          <a href="mailto:${encodeURIComponent(msg.email)}">${escapeHtml(msg.email)}</a>
        </td>
        <td>
          <div class="msg-preview" title="${escapeHtml(msg.message)}">
            ${escapeHtml(msg.message)}
          </div>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div class="actions-cell">
            <button class="action-btn view-btn" title="View Full Message" data-id="${msg.id}">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button class="action-btn toggle-read-btn" title="${isUnread ? 'Mark as Read' : 'Mark as Unread'}" data-id="${msg.id}">
              <i class="fa-solid ${isUnread ? 'fa-envelope-open' : 'fa-envelope'}"></i>
            </button>
            <button class="action-btn delete-btn" title="Delete Message" data-id="${msg.id}">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;

      tbody.appendChild(tr);
    });

    attachTableActions();
  }

  /**
   * Attach click events to dynamic table action buttons
   */
  function attachTableActions() {
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.onclick = () => openMessageModal(parseInt(btn.dataset.id, 10));
    });

    document.querySelectorAll('.toggle-read-btn').forEach(btn => {
      btn.onclick = () => toggleReadStatus(parseInt(btn.dataset.id, 10));
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.onclick = () => deleteMessage(parseInt(btn.dataset.id, 10));
    });
  }

  /**
   * Open Message Detail Modal
   */
  async function openMessageModal(messageId) {
    const msg = allMessages.find(m => m.id === messageId);
    if (!msg) return;

    activeModalMessageId = messageId;
    modalName.textContent = msg.name;
    modalEmailLink.textContent = msg.email;
    modalEmailLink.href = `mailto:${msg.email}?subject=${encodeURIComponent("Regarding your message on Isha's Portfolio")}`;
    modalDate.textContent = formatDate(msg.created_at);
    modalMessage.textContent = msg.message;
    modalReplyBtn.href = `mailto:${msg.email}?subject=${encodeURIComponent("Regarding your message on Isha's Portfolio")}`;

    updateModalToggleBtnText(msg.is_read);

    modal.classList.add('active');

    // Automatically mark as read if currently unread
    if (!msg.is_read) {
      await toggleReadStatus(messageId, 1, false);
    }
  }

  function updateModalToggleBtnText(isRead) {
    if (isRead) {
      modalToggleReadBtn.innerHTML = '<i class="fa-solid fa-envelope"></i> <span>Mark Unread</span>';
    } else {
      modalToggleReadBtn.innerHTML = '<i class="fa-solid fa-envelope-open"></i> <span>Mark Read</span>';
    }
  }

  function closeMessageModal() {
    modal.classList.remove('active');
    activeModalMessageId = null;
  }

  modalCloseBtn.onclick = closeMessageModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeMessageModal();
  };

  /**
   * Toggle Message Read/Unread
   */
  async function toggleReadStatus(messageId, explicitState = null, reloadTable = true) {
    const msg = allMessages.find(m => m.id === messageId);
    if (!msg) return;

    const newState = explicitState !== null ? explicitState : (msg.is_read ? 0 : 1);

    try {
      const res = await authFetch(`/api/admin/messages/${messageId}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ is_read: newState }),
      });

      const data = await res.json();
      if (data.success) {
        msg.is_read = newState;
        updateStats(allMessages);
        if (activeModalMessageId === messageId) {
          updateModalToggleBtnText(newState);
        }
        if (reloadTable) renderMessages();
      }
    } catch (err) {
      console.error('Error toggling read status:', err);
    }
  }

  /**
   * Delete Message
   */
  async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to permanently delete this message?')) {
      return;
    }

    try {
      const res = await authFetch(`/api/admin/messages/${messageId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        allMessages = allMessages.filter(m => m.id !== messageId);
        updateStats(allMessages);
        if (activeModalMessageId === messageId) {
          closeMessageModal();
        }
        renderMessages();
      } else {
        alert(data.message || 'Failed to delete message.');
      }
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  }

  modalToggleReadBtn.onclick = () => {
    if (activeModalMessageId) toggleReadStatus(activeModalMessageId);
  };

  modalDeleteBtn.onclick = () => {
    if (activeModalMessageId) deleteMessage(activeModalMessageId);
  };

  /**
   * Filter Tabs
   */
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderMessages();
    });
  });

  /**
   * Search Input with Debounce
   */
  let searchTimeout = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchQuery = e.target.value;
      renderMessages();
    }, 200);
  });

  /**
   * Refresh Button
   */
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadDashboard();
    });
  }

  /**
   * Logout Handler
   */
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await authFetch('/api/admin/logout', { method: 'POST' });
      } catch (e) {}
      localStorage.removeItem('portfolio_admin_token');
      localStorage.removeItem('portfolio_admin_user');
      window.location.href = '/admin/login';
    });
  }

  /**
   * Helper: Escape HTML to prevent XSS
   */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Initial Load
  loadDashboard();
})();
