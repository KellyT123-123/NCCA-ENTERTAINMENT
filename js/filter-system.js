/**
 * NCCA Entertainment - Advanced Filter System
 * Handles project filtering, sorting, search, and view management
 */

// ==========================================
// CONFIGURATION & STATE
// ==========================================

const FilterSystem = {
  currentFilters: {
    platform: '',
    format: '',
    genre: '',
    status: ''
  },
  
  currentSort: 'recent',
  currentView: 'grid',
  
  // DOM Elements (initialized on page load)
  elements: {},
  
  // Project data for search (can be expanded)
  projectsData: [],
  
  init() {
    this.cacheElements();
    this.bindEvents();
    this.applyUrlFilters();
    this.initializeSearch();
  },
  
  cacheElements() {
    this.elements = {
      // Filters
      platformFilter: document.getElementById('platformFilter'),
      formatFilter: document.getElementById('formatFilter'),
      genreFilter: document.getElementById('genreFilter'),
      statusFilter: document.getElementById('statusFilter'),
      
      // Actions
      clearFiltersBtn: document.getElementById('clearFilters'),
      sortSelect: document.getElementById('sortSelect'),
      
      // Display
      activeFilters: document.getElementById('activeFilters'),
      resultCount: document.getElementById('resultCount'),
      projectsGrid: document.getElementById('projectsGrid'),
      
      // View toggle
      viewGrid: document.getElementById('viewGrid'),
      viewList: document.getElementById('viewList'),
      
      // Search
      searchTrigger: document.getElementById('searchTrigger'),
      searchExpanded: document.getElementById('searchExpanded'),
      searchInput: document.getElementById('searchInput'),
      searchClear: document.getElementById('searchClear'),
      searchResults: document.getElementById('searchResults'),
      
      // Mobile menu
      mobileMenuToggle: document.getElementById('mobileMenuToggle'),
      mobileMenuOverlay: document.getElementById('mobileMenuOverlay'),
      mobileMenuClose: document.getElementById('mobileMenuClose'),
      
      // Back to top
      backToTop: document.getElementById('backToTop')
    };
  },
  
  bindEvents() {
    // Filter change events
    if (this.elements.platformFilter) {
      this.elements.platformFilter.addEventListener('change', () => this.updateFilters());
    }
    if (this.elements.formatFilter) {
      this.elements.formatFilter.addEventListener('change', () => this.updateFilters());
    }
    if (this.elements.genreFilter) {
      this.elements.genreFilter.addEventListener('change', () => this.updateFilters());
    }
    if (this.elements.statusFilter) {
      this.elements.statusFilter.addEventListener('change', () => this.updateFilters());
    }
    
    // Clear filters
    if (this.elements.clearFiltersBtn) {
      this.elements.clearFiltersBtn.addEventListener('click', () => this.clearAllFilters());
    }
    
    // Sort
    if (this.elements.sortSelect) {
      this.elements.sortSelect.addEventListener('change', (e) => this.sortProjects(e.target.value));
    }
    
    // View toggle
    if (this.elements.viewGrid) {
      this.elements.viewGrid.addEventListener('click', () => this.setView('grid'));
    }
    if (this.elements.viewList) {
      this.elements.viewList.addEventListener('click', () => this.setView('list'));
    }
    
    // Search
    if (this.elements.searchTrigger) {
      this.elements.searchTrigger.addEventListener('click', (e) => this.toggleSearch(e));
    }
    if (this.elements.searchInput) {
      this.elements.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    }
    if (this.elements.searchClear) {
      this.elements.searchClear.addEventListener('click', () => this.clearSearch());
    }
    
    // Mobile menu
    if (this.elements.mobileMenuToggle) {
      this.elements.mobileMenuToggle.addEventListener('click', () => this.openMobileMenu());
    }
    if (this.elements.mobileMenuClose) {
      this.elements.mobileMenuClose.addEventListener('click', () => this.closeMobileMenu());
    }
    
    // Mobile projects submenu
    const mobileProjectsToggle = document.getElementById('mobileProjectsToggle');
    if (mobileProjectsToggle) {
      mobileProjectsToggle.addEventListener('click', (e) => {
        e.preventDefault();
        const submenu = document.getElementById('mobileProjectsSubmenu');
        if (submenu) {
          submenu.classList.toggle('active');
        }
      });
    }
    
    // Back to top
    if (this.elements.backToTop) {
      window.addEventListener('scroll', () => this.handleScroll());
      this.elements.backToTop.addEventListener('click', () => this.scrollToTop());
    }
    
    // Global events
    document.addEventListener('click', (e) => this.handleDocumentClick(e));
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    
    // Quick view buttons
    document.querySelectorAll('.quick-view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.showQuickView(e.target.getAttribute('data-project')));
    });
  },
  
  // ==========================================
  // FILTER FUNCTIONALITY
  // ==========================================
  
  updateFilters() {
    this.currentFilters.platform = this.elements.platformFilter?.value || '';
    this.currentFilters.format = this.elements.formatFilter?.value || '';
    this.currentFilters.genre = this.elements.genreFilter?.value || '';
    this.currentFilters.status = this.elements.statusFilter?.value || '';
    
    this.updateActiveFiltersDisplay();
    this.filterProjects();
    this.updateUrl();
  },
  
  updateActiveFiltersDisplay() {
    if (!this.elements.activeFilters) return;
    
    const filterLabels = {
      platform: 'Platform',
      format: 'Format',
      genre: 'Genre',
      status: 'Status'
    };
    
    const chips = [];
    Object.keys(this.currentFilters).forEach(key => {
      if (this.currentFilters[key]) {
        const select = document.getElementById(`${key}Filter`);
        if (select) {
          const selectedOption = select.options[select.selectedIndex].text;
          chips.push({ key, label: filterLabels[key], value: selectedOption });
        }
      }
    });
    
    if (chips.length === 0) {
      this.elements.activeFilters.innerHTML = '';
      this.elements.clearFiltersBtn?.classList.remove('visible');
    } else {
      this.elements.clearFiltersBtn?.classList.add('visible');
      this.elements.activeFilters.innerHTML = chips.map(chip => `
        <div class="filter-chip" role="status" aria-live="polite">
          <span>${chip.label}: ${chip.value}</span>
          <button class="filter-chip-remove" data-filter="${chip.key}" aria-label="Remove ${chip.label} filter">×</button>
        </div>
      `).join('');
      
      // Add click handlers to remove buttons
      document.querySelectorAll('.filter-chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const filterKey = e.target.getAttribute('data-filter');
          const filterElement = document.getElementById(`${filterKey}Filter`);
          if (filterElement) {
            filterElement.value = '';
            this.updateFilters();
          }
        });
      });
    }
  },
  
  filterProjects() {
    const allCards = document.querySelectorAll('.project-card');
    let visibleCount = 0;
    
    allCards.forEach(card => {
      let show = true;
      
      // Check platform filter
      if (this.currentFilters.platform) {
        const platforms = card.getAttribute('data-platforms');
        if (!platforms || !platforms.includes(this.currentFilters.platform)) {
          show = false;
        }
      }
      
      // Check format filter
      if (this.currentFilters.format && show) {
        const format = card.getAttribute('data-format');
        if (format !== this.currentFilters.format) {
          show = false;
        }
      }
      
      // Check genre filter
      if (this.currentFilters.genre && show) {
        const genre = card.getAttribute('data-genre');
        if (genre !== this.currentFilters.genre) {
          show = false;
        }
      }
      
      // Check status filter
      if (this.currentFilters.status && show) {
        const status = card.getAttribute('data-status');
        if (status !== this.currentFilters.status) {
          show = false;
        }
      }
      
      if (show) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });
    
    if (this.elements.resultCount) {
      this.elements.resultCount.textContent = visibleCount;
    }
    
    // Announce to screen readers
    this.announceFilterResults(visibleCount);
  },
  
  clearAllFilters() {
    if (this.elements.platformFilter) this.elements.platformFilter.value = '';
    if (this.elements.formatFilter) this.elements.formatFilter.value = '';
    if (this.elements.genreFilter) this.elements.genreFilter.value = '';
    if (this.elements.statusFilter) this.elements.statusFilter.value = '';
    
    this.updateFilters();
  },
  
  // ==========================================
  // SORTING FUNCTIONALITY
  // ==========================================
  
  sortProjects(sortValue) {
    this.currentSort = sortValue;
    const cards = Array.from(document.querySelectorAll('.project-card'));
    const grid = this.elements.projectsGrid;
    
    if (!grid) return;
    
    cards.sort((a, b) => {
      switch(sortValue) {
        case 'title-asc':
          return this.getProjectTitle(a).localeCompare(this.getProjectTitle(b));
        case 'title-desc':
          return this.getProjectTitle(b).localeCompare(this.getProjectTitle(a));
        case 'priority':
          return this.getPriority(b) - this.getPriority(a);
        case 'genre':
          const genreA = a.getAttribute('data-genre') || '';
          const genreB = b.getAttribute('data-genre') || '';
          return genreA.localeCompare(genreB);
        default: // recent
          return 0;
      }
    });
    
    // Re-append sorted cards
    cards.forEach(card => grid.appendChild(card));
  },
  
  getProjectTitle(card) {
    const titleElement = card.querySelector('.project-title');
    return titleElement ? titleElement.textContent : '';
  },
  
  getPriority(card) {
    if (card.querySelector('.project-priority.high')) return 3;
    if (card.querySelector('.project-priority.medium')) return 2;
    return 1;
  },
  
  // ==========================================
  // VIEW MANAGEMENT
  // ==========================================
  
  setView(view) {
    this.currentView = view;
    const grid = this.elements.projectsGrid;
    
    if (!grid) return;
    
    if (view === 'grid') {
      grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(340px, 1fr))';
      document.querySelectorAll('.project-card').forEach(card => {
        card.classList.remove('list-view');
      });
      this.elements.viewGrid?.classList.add('active');
      this.elements.viewList?.classList.remove('active');
    } else {
      grid.style.gridTemplateColumns = '1fr';
      document.querySelectorAll('.project-card').forEach(card => {
        card.classList.add('list-view');
      });
      this.elements.viewList?.classList.add('active');
      this.elements.viewGrid?.classList.remove('active');
    }
    
    // Save preference
    localStorage.setItem('ncca_view_preference', view);
  },
  
  // ==========================================
  // SEARCH FUNCTIONALITY
  // ==========================================
  
  initializeSearch() {
    // Build search index from page content
    const cards = document.querySelectorAll('.project-card');
    this.projectsData = Array.from(cards).map((card, index) => {
      const title = card.querySelector('.project-title')?.textContent || '';
      const description = card.querySelector('.project-description')?.textContent || '';
      const genre = card.getAttribute('data-genre') || '';
      const format = card.getAttribute('data-format') || '';
      const platforms = card.getAttribute('data-platforms') || '';
      const image = card.querySelector('.project-image')?.src || '';
      const url = card.querySelector('.btn-primary')?.href || '#';
      
      return {
        id: card.getAttribute('data-project-id') || index,
        title,
        description,
        genre,
        format,
        platforms: platforms.split(','),
        image,
        url
      };
    });
  },
  
  toggleSearch(e) {
    e.stopPropagation();
    const isActive = this.elements.searchExpanded?.classList.toggle('active');
    if (this.elements.searchTrigger) {
      this.elements.searchTrigger.setAttribute('aria-expanded', isActive ? 'true' : 'false');
    }
    if (isActive && this.elements.searchInput) {
      this.elements.searchInput.focus();
    }
  },
  
  handleSearch(query) {
    query = query.trim().toLowerCase();
    
    if (query.length === 0) {
      this.elements.searchClear?.classList.remove('visible');
      if (this.elements.searchResults) {
        this.elements.searchResults.innerHTML = '';
      }
      return;
    }
    
    this.elements.searchClear?.classList.add('visible');
    
    // Filter projects
    const filtered = this.projectsData.filter(project => {
      return project.title.toLowerCase().includes(query) ||
             project.genre.toLowerCase().includes(query) ||
             project.format.toLowerCase().includes(query) ||
             project.description.toLowerCase().includes(query) ||
             project.platforms.some(p => p.toLowerCase().includes(query));
    });
    
    // Display results
    if (!this.elements.searchResults) return;
    
    if (filtered.length === 0) {
      this.elements.searchResults.innerHTML = `
        <div class="search-no-results">
          <p>No projects found for "${this.escapeHtml(query)}"</p>
          <p style="font-size: .85rem; margin-top: .5rem; color: rgba(255,255,255,.4);">
            Try searching for genres, platforms, or keywords
          </p>
        </div>
      `;
    } else {
      this.elements.searchResults.innerHTML = filtered.slice(0, 5).map(project => `
        <a href="${project.url}" class="search-result-item">
          <img src="${project.image}" alt="${this.escapeHtml(project.title)}" class="search-result-thumb" loading="lazy">
          <div class="search-result-content">
            <div class="search-result-title">${this.highlightQuery(project.title, query)}</div>
            <div class="search-result-meta">
              <span class="search-result-tag">${project.genre}</span>
              <span class="search-result-tag">${project.format}</span>
              ${project.platforms.slice(0, 2).map(p => `<span class="search-result-tag">${p}</span>`).join('')}
            </div>
          </div>
        </a>
      `).join('');
      
      if (filtered.length > 5) {
        this.elements.searchResults.innerHTML += `
          <div style="text-align: center; padding: 1rem; color: rgba(255,255,255,.5); font-size: .85rem;">
            +${filtered.length - 5} more results
          </div>
        `;
      }
    }
  },
  
  clearSearch() {
    if (this.elements.searchInput) {
      this.elements.searchInput.value = '';
    }
    this.elements.searchClear?.classList.remove('visible');
    if (this.elements.searchResults) {
      this.elements.searchResults.innerHTML = '';
    }
    this.elements.searchInput?.focus();
  },
  
  highlightQuery(text, query) {
    const regex = new RegExp(`(${this.escapeRegex(query)})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark style="background: rgba(212,139,60,.3); color: var(--brand);">$1</mark>');
  },
  
  // ==========================================
  // URL MANAGEMENT
  // ==========================================
  
  applyUrlFilters() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.has('platform') && this.elements.platformFilter) {
      this.elements.platformFilter.value = urlParams.get('platform') || '';
    }
    if (urlParams.has('format') && this.elements.formatFilter) {
      this.elements.formatFilter.value = urlParams.get('format') || '';
    }
    if (urlParams.has('genre') && this.elements.genreFilter) {
      this.elements.genreFilter.value = urlParams.get('genre') || '';
    }
    if (urlParams.has('status') && this.elements.statusFilter) {
      this.elements.statusFilter.value = urlParams.get('status') || '';
    }
    
    if (urlParams.has('platform') || urlParams.has('format') || urlParams.has('genre') || urlParams.has('status')) {
      this.updateFilters();
    }
  },
  
  updateUrl() {
    const params = new URLSearchParams();
    
    if (this.currentFilters.platform) params.set('platform', this.currentFilters.platform);
    if (this.currentFilters.format) params.set('format', this.currentFilters.format);
    if (this.currentFilters.genre) params.set('genre', this.currentFilters.genre);
    if (this.currentFilters.status) params.set('status', this.currentFilters.status);
    
    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  },
  
  // ==========================================
  // MOBILE MENU
  // ==========================================
  
  openMobileMenu() {
    this.elements.mobileMenuOverlay?.classList.add('active');
    if (this.elements.mobileMenuToggle) {
      this.elements.mobileMenuToggle.setAttribute('aria-expanded', 'true');
    }
    document.body.style.overflow = 'hidden';
  },
  
  closeMobileMenu() {
    this.elements.mobileMenuOverlay?.classList.remove('active');
    if (this.elements.mobileMenuToggle) {
      this.elements.mobileMenuToggle.setAttribute('aria-expanded', 'false');
    }
    document.body.style.overflow = '';
  },
  
  // ==========================================
  // SCROLL MANAGEMENT
  // ==========================================
  
  handleScroll() {
    if (window.pageYOffset > 300) {
      this.elements.backToTop?.classList.add('visible');
    } else {
      this.elements.backToTop?.classList.remove('visible');
    }
  },
  
  scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  },
  
  // ==========================================
  // EVENT HANDLERS
  // ==========================================
  
  handleDocumentClick(e) {
    // Close search when clicking outside
    if (this.elements.searchExpanded && 
        !this.elements.searchExpanded.contains(e.target) && 
        !this.elements.searchTrigger?.contains(e.target)) {
      this.elements.searchExpanded.classList.remove('active');
      if (this.elements.searchTrigger) {
        this.elements.searchTrigger.setAttribute('aria-expanded', 'false');
      }
    }
  },
  
  handleKeyDown(e) {
    if (e.key === 'Escape') {
      // Close search
      if (this.elements.searchExpanded?.classList.contains('active')) {
        this.elements.searchExpanded.classList.remove('active');
        if (this.elements.searchTrigger) {
          this.elements.searchTrigger.setAttribute('aria-expanded', 'false');
        }
      }
      
      // Close mobile menu
      if (this.elements.mobileMenuOverlay?.classList.contains('active')) {
        this.closeMobileMenu();
      }
      
      // Close quick view
      const quickViewOverlay = document.getElementById('quickViewOverlay');
      if (quickViewOverlay?.classList.contains('active')) {
        quickViewOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    }
  },
  
  // ==========================================
  // QUICK VIEW
  // ==========================================
  
  showQuickView(projectId) {
    const project = this.projectsData.find(p => p.id == projectId);
    const quickViewOverlay = document.getElementById('quickViewOverlay');
    const quickViewContent = document.getElementById('quickViewContent');
    
    if (!project || !quickViewOverlay || !quickViewContent) return;
    
    quickViewContent.innerHTML = `
      <img src="${project.image}" alt="${this.escapeHtml(project.title)}" style="width: 100%; border-radius: 12px 12px 0 0;" loading="lazy">
      <div style="padding: 2rem;">
        <h2 style="color: var(--brand); margin-bottom: 1rem;">${this.escapeHtml(project.title)}</h2>
        <div style="display: flex; gap: .5rem; margin-bottom: 1rem; flex-wrap: wrap;">
          <span class="project-tag">${project.genre}</span>
          <span class="project-tag">${project.format}</span>
        </div>
        <p style="color: rgba(255,255,255,.9); line-height: 1.7; margin-bottom: 1.5rem;">
          ${this.escapeHtml(project.description)}
        </p>
        <div style="display: flex; gap: .5rem; margin-bottom: 2rem; flex-wrap: wrap;">
          ${project.platforms.map(p => `<span class="platform-badge">${p}</span>`).join('')}
        </div>
        <div style="display: flex; gap: 1rem;">
          <a href="${project.url}" class="btn btn-primary">View Full Details</a>
          <button class="btn btn-secondary" onclick="FilterSystem.closeQuickView()">Close</button>
        </div>
      </div>
    `;
    
    quickViewOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  },
  
  closeQuickView() {
    const quickViewOverlay = document.getElementById('quickViewOverlay');
    if (quickViewOverlay) {
      quickViewOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  },
  
  // ==========================================
  // UTILITY FUNCTIONS
  // ==========================================
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  },
  
  announceFilterResults(count) {
    // Create an announcement for screen readers
    const announcement = `Showing ${count} project${count !== 1 ? 's' : ''}`;
    const liveRegion = document.getElementById('filterAnnouncement') || this.createLiveRegion();
    liveRegion.textContent = announcement;
  },
  
  createLiveRegion() {
    const region = document.createElement('div');
    region.id = 'filterAnnouncement';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    region.style.position = 'absolute';
    region.style.left = '-10000px';
    region.style.width = '1px';
    region.style.height = '1px';
    region.style.overflow = 'hidden';
    document.body.appendChild(region);
    return region;
  }
};

// ==========================================
// QUICK VIEW MODAL SETUP
// ==========================================

function setupQuickViewModal() {
  const quickViewOverlay = document.getElementById('quickViewOverlay');
  const quickViewClose = document.getElementById('quickViewClose');
  
  if (quickViewClose) {
    quickViewClose.addEventListener('click', () => FilterSystem.closeQuickView());
  }
  
  if (quickViewOverlay) {
    quickViewOverlay.addEventListener('click', (e) => {
      if (e.target === quickViewOverlay) {
        FilterSystem.closeQuickView();
      }
    });
  }
}

// ==========================================
// INITIALIZE ON PAGE LOAD
// ==========================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    FilterSystem.init();
    setupQuickViewModal();
    
    // Restore view preference
    const savedView = localStorage.getItem('ncca_view_preference');
    if (savedView) {
      FilterSystem.setView(savedView);
    }
  });
} else {
  FilterSystem.init();
  setupQuickViewModal();
}

// Export for use in other scripts
window.FilterSystem = FilterSystem;
window.filterProjects = () => FilterSystem.filterProjects();
