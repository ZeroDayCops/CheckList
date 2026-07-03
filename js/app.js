/**
 * Checklist By ZeroDayCops — Application Logic
 * Pure vanilla JS, no dependencies.
 */

(function () {
  'use strict';

  // ── Constants ──
  const STORAGE_KEY = 'zdc-checklist-progress';
  const THEME_KEY = 'zdc-theme';
  const RING_CIRCUMFERENCE = 2 * Math.PI * 52; // r=52

  // ── State ──
  let checkedItems = new Set();
  let activeDomain = 'all';
  let searchQuery = '';
  let showUncheckedOnly = false;
  let allExpanded = false;
  let expandedCategories = new Set();

  // ── DOM refs ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const domainNav = $('#domainNav');
  const categoriesContainer = $('#categoriesContainer');
  const searchInput = $('#searchInput');
  const searchCount = $('#searchCount');
  const uncheckedFilter = $('#uncheckedFilter');
  const expandAllBtn = $('#expandAllBtn');
  const progressRing = $('#progressRing');
  const ringPercent = $('#ringPercent');
  const ringCount = $('#ringCount');
  const totalChecksEl = $('#totalChecks');
  const doneChecksEl = $('#doneChecks');
  const heroBadge = $('#heroBadge');
  const mobileProgress = $('#mobileProgress');
  const themeToggle = $('#themeToggle');
  const resetAllBtn = $('#resetAllBtn');
  const modalOverlay = $('#modalOverlay');
  const modalTitle = $('#modalTitle');
  const modalText = $('#modalText');
  const modalCancel = $('#modalCancel');
  const modalConfirm = $('#modalConfirm');
  const toast = $('#toast');
  const toastText = $('#toastText');
  const menuToggle = $('#menuToggle');
  const sidebar = $('#sidebar');
  const sidebarOverlay = $('#sidebarOverlay');

  // ── Helpers ──
  function getAllItems() {
    const items = [];
    for (const domain of CHECKLIST_DATA) {
      for (const cat of domain.categories) {
        for (const item of cat.items) {
          items.push({ ...item, domainId: domain.id, categoryId: cat.id });
        }
      }
    }
    return items;
  }

  function getVisibleCategories() {
    const domains = activeDomain === 'all'
      ? CHECKLIST_DATA
      : CHECKLIST_DATA.filter(d => d.id === activeDomain);

    const categories = [];
    for (const domain of domains) {
      for (const cat of domain.categories) {
        const filteredItems = cat.items.filter(item => {
          const matchSearch = !searchQuery ||
            item.title.toLowerCase().includes(searchQuery) ||
            (item.description && item.description.toLowerCase().includes(searchQuery));
          const matchUnchecked = !showUncheckedOnly || !checkedItems.has(item.id);
          return matchSearch && matchUnchecked;
        });

        if (filteredItems.length > 0 || (!searchQuery && !showUncheckedOnly)) {
          categories.push({
            ...cat,
            domainId: domain.id,
            domainEmoji: domain.emoji,
            filteredItems: filteredItems,
            totalItems: cat.items.length,
          });
        }
      }
    }
    return categories;
  }

  function getTotalAndChecked() {
    let total = 0;
    let done = 0;
    const domains = activeDomain === 'all'
      ? CHECKLIST_DATA
      : CHECKLIST_DATA.filter(d => d.id === activeDomain);

    for (const domain of domains) {
      for (const cat of domain.categories) {
        total += cat.items.length;
        for (const item of cat.items) {
          if (checkedItems.has(item.id)) done++;
        }
      }
    }
    return { total, done };
  }

  function getGlobalTotalAndChecked() {
    let total = 0;
    let done = 0;
    for (const domain of CHECKLIST_DATA) {
      for (const cat of domain.categories) {
        total += cat.items.length;
        for (const item of cat.items) {
          if (checkedItems.has(item.id)) done++;
        }
      }
    }
    return { total, done };
  }

  function getDomainStats(domainId) {
    const domain = CHECKLIST_DATA.find(d => d.id === domainId);
    if (!domain) return { total: 0, done: 0 };
    let total = 0, done = 0;
    for (const cat of domain.categories) {
      total += cat.items.length;
      for (const item of cat.items) {
        if (checkedItems.has(item.id)) done++;
      }
    }
    return { total, done };
  }

  function getCategoryChecked(category) {
    let done = 0;
    for (const item of category.items) {
      if (checkedItems.has(item.id)) done++;
    }
    return done;
  }

  function countCategories() {
    let count = 0;
    for (const d of CHECKLIST_DATA) count += d.categories.length;
    return count;
  }

  // ── Persistence ──
  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...checkedItems]));
    } catch (e) { /* quota exceeded — ignore */ }
  }

  function loadProgress() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        checkedItems = new Set(JSON.parse(data));
      }
    } catch (e) { /* corrupted — ignore */ }
  }

  // ── Theme ──
  function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const iconSun = themeToggle.querySelector('.icon-sun');
    const iconMoon = themeToggle.querySelector('.icon-moon');
    if (theme === 'dark') {
      iconSun.style.display = '';
      iconMoon.style.display = 'none';
    } else {
      iconSun.style.display = 'none';
      iconMoon.style.display = '';
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  // ── Toast ──
  let toastTimer;
  function showToast(message) {
    toastText.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  // ── Modal ──
  let modalCallback = null;

  function showModal(title, text, confirmLabel, callback) {
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalConfirm.textContent = confirmLabel || 'Reset';
    modalCallback = callback;
    modalOverlay.classList.add('visible');
  }

  function hideModal() {
    modalOverlay.classList.remove('visible');
    modalCallback = null;
  }

  // ── Render Domain Nav ──
  function renderDomainNav() {
    const globalStats = getGlobalTotalAndChecked();

    let html = `<p class="domain-nav-label">Domains</p>`;
    html += `<button class="domain-btn ${activeDomain === 'all' ? 'active' : ''}" data-domain="all">
      <span class="domain-emoji">🗂️</span>
      <span class="domain-name">All checks</span>
      <span class="domain-count">${globalStats.total}</span>
    </button>`;

    for (const domain of CHECKLIST_DATA) {
      const stats = getDomainStats(domain.id);
      html += `<button class="domain-btn ${activeDomain === domain.id ? 'active' : ''}" data-domain="${domain.id}">
        <span class="domain-emoji">${domain.emoji}</span>
        <span class="domain-name">${domain.name}</span>
        <span class="domain-count">${stats.total}</span>
      </button>`;
    }

    domainNav.innerHTML = html;
  }

  // ── Render Categories ──
  function renderCategories() {
    const categories = getVisibleCategories();
    const { total, done } = getTotalAndChecked();

    if (categories.length === 0 && (searchQuery || showUncheckedOnly)) {
      categoriesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">No items match your search</div>
          <div class="empty-state-hint">Try a different keyword or clear the filter.</div>
        </div>`;
      updateSearchCount(0, total);
      return;
    }

    if (categories.length === 0) {
      categoriesContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">Select a domain to get started</div>
          <div class="empty-state-hint">Pick a domain from the sidebar to see its checklist.</div>
        </div>`;
      updateSearchCount(0, total);
      return;
    }

    let visibleItemCount = 0;
    let html = '';

    for (const cat of categories) {
      const catDone = getCategoryChecked(cat);
      const catTotal = cat.totalItems;
      const catPercent = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0;
      const isExpanded = expandedCategories.has(cat.id);
      const displayItems = (searchQuery || showUncheckedOnly) ? cat.filteredItems : cat.items;
      visibleItemCount += displayItems.length;

      html += `<div class="category-card ${isExpanded ? 'expanded' : ''}" data-category-id="${cat.id}">
        <button class="category-header" aria-expanded="${isExpanded}" data-cat-toggle="${cat.id}">
          <span class="category-icon">${cat.domainEmoji}</span>
          <div class="category-info">
            <div class="category-name">${escapeHtml(cat.name)}</div>
            <div class="category-meta">${displayItems.length} checks</div>
          </div>
          <div class="category-progress-area">
            <div class="category-progress-bar">
              <div class="category-progress-fill" style="width: ${catPercent}%"></div>
            </div>
            <span class="category-progress-text">${catDone}/${catTotal}</span>
          </div>
          <svg class="category-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        <div class="category-items">
          <div class="category-items-inner">
            <ul class="items-list">`;

      for (const item of displayItems) {
        const isChecked = checkedItems.has(item.id);
        html += `<li class="check-item ${isChecked ? 'checked' : ''}" data-item-id="${item.id}">
          <span class="check-box" role="checkbox" aria-checked="${isChecked}" tabindex="0">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12l5 5L20 7"/>
            </svg>
          </span>
          <span class="check-content">
            <span class="check-title">${escapeHtml(item.title)}</span>
            ${item.description ? `<span class="check-description">${escapeHtml(item.description)}</span>` : ''}
          </span>
          ${item.severity ? `<span class="check-severity ${item.severity}">${item.severity}</span>` : ''}
        </li>`;
      }

      html += `</ul>
            <button class="category-reset-btn" data-cat-reset="${cat.id}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              Reset this category
            </button>
          </div>
        </div>
      </div>`;
    }

    categoriesContainer.innerHTML = html;
    updateSearchCount(visibleItemCount, total);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Update Progress Display ──
  function updateProgress() {
    const { total, done } = getGlobalTotalAndChecked();
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;

    progressRing.style.strokeDashoffset = offset;
    ringPercent.textContent = percent + '%';
    ringCount.textContent = `${done} / ${total}`;
    totalChecksEl.textContent = total;
    doneChecksEl.textContent = done;
    mobileProgress.textContent = `${percent}%`;

    // Hero badge
    const catCount = countCategories();
    heroBadge.textContent = `${catCount} categories · ${total} checks`;

    // Update domain nav counts (highlight done)
    renderDomainNav();
  }

  function updateSearchCount(visible, total) {
    const { done } = getTotalAndChecked();
    if (searchQuery || showUncheckedOnly) {
      searchCount.textContent = `${visible} results`;
    } else {
      searchCount.textContent = `${done}/${total}`;
    }
  }

  // ── Event Handlers ──
  function handleItemClick(itemId) {
    if (checkedItems.has(itemId)) {
      checkedItems.delete(itemId);
    } else {
      checkedItems.add(itemId);
    }
    saveProgress();
    // Micro-update: toggle class on the element directly for snappy feel
    const el = document.querySelector(`.check-item[data-item-id="${itemId}"]`);
    if (el) {
      const isNowChecked = checkedItems.has(itemId);
      el.classList.toggle('checked', isNowChecked);
      const checkbox = el.querySelector('.check-box');
      if (checkbox) checkbox.setAttribute('aria-checked', isNowChecked);
    }
    updateProgress();
    // Update category progress inline
    updateCategoryProgressInline(itemId);
  }

  function updateCategoryProgressInline(itemId) {
    // Find which category this item belongs to
    for (const domain of CHECKLIST_DATA) {
      for (const cat of domain.categories) {
        const found = cat.items.find(i => i.id === itemId);
        if (found) {
          const catDone = getCategoryChecked(cat);
          const catTotal = cat.items.length;
          const catPercent = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0;
          const card = document.querySelector(`.category-card[data-category-id="${cat.id}"]`);
          if (card) {
            const fill = card.querySelector('.category-progress-fill');
            const text = card.querySelector('.category-progress-text');
            const meta = card.querySelector('.category-meta');
            if (fill) fill.style.width = catPercent + '%';
            if (text) text.textContent = `${catDone}/${catTotal}`;
          }
          return;
        }
      }
    }
  }

  function handleCategoryToggle(catId) {
    if (expandedCategories.has(catId)) {
      expandedCategories.delete(catId);
    } else {
      expandedCategories.add(catId);
    }
    const card = document.querySelector(`.category-card[data-category-id="${catId}"]`);
    if (card) {
      card.classList.toggle('expanded', expandedCategories.has(catId));
      const header = card.querySelector('.category-header');
      if (header) header.setAttribute('aria-expanded', expandedCategories.has(catId));
    }
  }

  function handleCategoryReset(catId) {
    // Find the category
    for (const domain of CHECKLIST_DATA) {
      const cat = domain.categories.find(c => c.id === catId);
      if (cat) {
        showModal(
          'Reset category?',
          `This will uncheck all ${cat.items.length} items in "${cat.name}". This cannot be undone.`,
          'Reset',
          () => {
            for (const item of cat.items) {
              checkedItems.delete(item.id);
            }
            saveProgress();
            renderCategories();
            updateProgress();
            showToast(`"${cat.name}" progress reset`);
          }
        );
        return;
      }
    }
  }

  function handleDomainSwitch(domainId) {
    activeDomain = domainId;
    expandedCategories.clear();
    renderCategories();
    updateProgress();
    // Close mobile sidebar
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('open');
  }

  function handleResetAll() {
    const { total, done } = getGlobalTotalAndChecked();
    if (done === 0) {
      showToast('Nothing to reset');
      return;
    }
    showModal(
      'Reset all progress?',
      `This will uncheck all ${done} completed items across every domain. This action cannot be undone.`,
      'Reset Everything',
      () => {
        checkedItems.clear();
        saveProgress();
        renderCategories();
        updateProgress();
        showToast('All progress has been reset');
      }
    );
  }

  function handleExpandAll() {
    const categories = getVisibleCategories();
    if (allExpanded) {
      expandedCategories.clear();
      allExpanded = false;
    } else {
      for (const cat of categories) {
        expandedCategories.add(cat.id);
      }
      allExpanded = true;
    }
    renderCategories();
  }



  // ── Search ──
  let searchDebounce;
  function handleSearch(e) {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderCategories();
    }, 150);
  }

  function handleUncheckedFilter() {
    showUncheckedOnly = !showUncheckedOnly;
    uncheckedFilter.classList.toggle('active', showUncheckedOnly);
    renderCategories();
  }

  // ── Mobile Sidebar ──
  function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('open');
  }

  // ── Delegated Event Listeners ──
  function setupEvents() {
    // Theme
    themeToggle.addEventListener('click', toggleTheme);

    // Search
    searchInput.addEventListener('input', handleSearch);

    // Filters
    uncheckedFilter.addEventListener('click', handleUncheckedFilter);
    expandAllBtn.addEventListener('click', handleExpandAll);


    // Reset all
    resetAllBtn.addEventListener('click', handleResetAll);

    // Modal
    modalCancel.addEventListener('click', hideModal);
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) hideModal();
    });
    modalConfirm.addEventListener('click', () => {
      if (modalCallback) modalCallback();
      hideModal();
    });

    // Mobile
    menuToggle.addEventListener('click', toggleSidebar);
    sidebarOverlay.addEventListener('click', toggleSidebar);

    // Domain nav (delegated)
    domainNav.addEventListener('click', (e) => {
      const btn = e.target.closest('.domain-btn');
      if (btn) handleDomainSwitch(btn.dataset.domain);
    });

    // Categories container (delegated)
    categoriesContainer.addEventListener('click', (e) => {
      // Category toggle
      const catToggle = e.target.closest('[data-cat-toggle]');
      if (catToggle) {
        handleCategoryToggle(catToggle.dataset.catToggle);
        return;
      }

      // Category reset
      const catReset = e.target.closest('[data-cat-reset]');
      if (catReset) {
        handleCategoryReset(catReset.dataset.catReset);
        return;
      }

      // Item click
      const itemEl = e.target.closest('.check-item');
      if (itemEl) {
        handleItemClick(itemEl.dataset.itemId);
        return;
      }
    });

    // Keyboard: space/enter on checkboxes
    categoriesContainer.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        const checkbox = e.target.closest('.check-box');
        if (checkbox) {
          e.preventDefault();
          const itemEl = checkbox.closest('.check-item');
          if (itemEl) handleItemClick(itemEl.dataset.itemId);
        }
      }
    });

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (modalOverlay.classList.contains('visible')) {
          hideModal();
        }
        if (sidebar.classList.contains('open')) {
          toggleSidebar();
        }
      }
    });
  }

  // ── Init ──
  function init() {
    // Load saved state
    loadProgress();

    // Theme
    applyTheme(getPreferredTheme());

    // Set up events
    setupEvents();

    // Initial render
    renderDomainNav();
    renderCategories();
    updateProgress();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
