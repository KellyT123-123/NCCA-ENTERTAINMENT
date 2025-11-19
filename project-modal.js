// Project Detail Modal System
// This file provides modal functionality for displaying project details across all pages

// Create modal HTML structure and inject into page
function initProjectModal() {
  const modalHTML = `
    <div id="projectModal" class="modal" style="display:none;">
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <button class="modal-close" aria-label="Close">&times;</button>
        <div class="modal-body">
          <div class="modal-media" id="modalMedia"></div>
          <div class="modal-info">
            <h2 id="modalTitle"></h2>
            <div class="modal-meta" id="modalMeta"></div>
            <div class="modal-platforms" id="modalPlatforms"></div>
            <div class="modal-description">
              <h3>Synopsis</h3>
              <p id="modalDescription"></p>
            </div>
            <div class="modal-trailer" id="modalTrailer"></div>
            <div class="modal-materials" id="modalMaterials"></div>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Add modal styles
  const modalStyles = document.createElement('style');
  modalStyles.textContent = `
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    
    .modal-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.92);
      backdrop-filter: blur(8px);
    }
    
    .modal-content {
      position: relative;
      background: linear-gradient(145deg, #1a1a1f, #0f0f13);
      border-radius: 20px;
      max-width: 1200px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    
    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #fff;
      font-size: 1.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      transition: all 0.3s ease;
    }
    
    .modal-close:hover {
      background: rgba(212, 139, 60, 0.3);
      border-color: #D48B3C;
    }
    
    .modal-body {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      padding: 2rem;
    }
    
    @media (max-width: 768px) {
      .modal-body {
        grid-template-columns: 1fr;
      }
    }
    
    .modal-media {
      width: 100%;
      aspect-ratio: 16/9;
      background-size: cover;
      background-position: center;
      border-radius: 12px;
      overflow: hidden;
    }
    
    .modal-info h2 {
      font-size: 2rem;
      font-weight: 900;
      margin-bottom: 1rem;
      color: #fff;
    }
    
    .modal-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    
    .modal-platforms {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.5rem;
    }
    
    .modal-description {
      margin-bottom: 1.5rem;
    }
    
    .modal-description h3 {
      color: #D48B3C;
      font-size: 1.2rem;
      margin-bottom: 0.75rem;
    }
    
    .modal-description p {
      color: #B9A98F;
      line-height: 1.7;
      font-size: 1rem;
    }
    
    .modal-trailer {
      margin-bottom: 1.5rem;
    }
    
    .modal-trailer iframe {
      width: 100%;
      aspect-ratio: 16/9;
      border-radius: 12px;
      border: none;
    }
    
    .modal-materials {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    
    .modal-materials h3 {
      color: #D48B3C;
      font-size: 1.2rem;
      margin-bottom: 0.5rem;
    }
    
    .modal-materials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 0.75rem;
    }
    
    .modal-materials a {
      background: #D48B3C;
      color: #111;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 700;
      text-align: center;
      transition: all 0.3s ease;
      display: block;
    }
    
    .modal-materials a:hover {
      background: #E3A463;
      transform: translateY(-2px);
    }
    
    .modal-materials .secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
    
    .modal-materials .secondary:hover {
      background: rgba(255, 255, 255, 0.15);
    }
  `;
  
  document.head.appendChild(modalStyles);
  
  // Setup event listeners
  const modal = document.getElementById('projectModal');
  const overlay = modal.querySelector('.modal-overlay');
  const closeBtn = modal.querySelector('.modal-close');
  
  overlay.addEventListener('click', closeProjectModal);
  closeBtn.addEventListener('click', closeProjectModal);
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeProjectModal();
    }
  });
}

// Open modal with project data
function openProjectModal(project) {
  const modal = document.getElementById('projectModal');
  
  // Populate modal content
  document.getElementById('modalTitle').textContent = project.title;
  document.getElementById('modalDescription').textContent = project.description;
  
  // Set media background
  const modalMedia = document.getElementById('modalMedia');
  modalMedia.style.backgroundImage = `url('${project.image}')`;
  
  // Set meta badges
  const modalMeta = document.getElementById('modalMeta');
  modalMeta.innerHTML = `
    <span class="badge">${project.genre}</span>
    <span class="badge">${project.format}</span>
    ${project.audience ? `<span class="badge">${project.audience}</span>` : ''}
  `;
  
  // Set platforms
  const modalPlatforms = document.getElementById('modalPlatforms');
  if (project.platforms && project.platforms.length > 0) {
    modalPlatforms.innerHTML = project.platforms
      .map(p => `<span class="platform-logo">${p}</span>`)
      .join('');
  } else {
    modalPlatforms.innerHTML = '';
  }
  
  // Set trailer
  const modalTrailer = document.getElementById('modalTrailer');
  if (project.trailer) {
    // Check if it's a YouTube link
    const youtubeMatch = project.trailer.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (youtubeMatch) {
      modalTrailer.innerHTML = `
        <h3 style="color:#D48B3C;font-size:1.2rem;margin-bottom:0.75rem;">Trailer</h3>
        <iframe src="https://www.youtube.com/embed/${youtubeMatch[1]}" allowfullscreen></iframe>
      `;
    } else {
      modalTrailer.innerHTML = `
        <h3 style="color:#D48B3C;font-size:1.2rem;margin-bottom:0.75rem;">Trailer</h3>
        <video controls style="width:100%;border-radius:12px;">
          <source src="${project.trailer}" type="video/mp4">
        </video>
      `;
    }
  } else {
    modalTrailer.innerHTML = '';
  }
  
  // Set materials
  const modalMaterials = document.getElementById('modalMaterials');
  const hasMaterials = project.deck || project.onesheet || project.treatment;
  
  if (hasMaterials) {
    let materialsHTML = '<h3>Industry Materials</h3><div class="modal-materials-grid">';
    
    if (project.deck) {
      materialsHTML += `<a href="${project.deck}" download>📄 Pitch Deck</a>`;
    }
    if (project.onesheet) {
      materialsHTML += `<a href="${project.onesheet}" download>📋 One-Sheet</a>`;
    }
    if (project.treatment) {
      materialsHTML += `<a href="${project.treatment}" download>📝 Treatment</a>`;
    }
    
    materialsHTML += `</div><div class="modal-materials-grid" style="margin-top:0.75rem;">`;
    materialsHTML += `<a href="mailto:NCCAEntertainment@gmail.com?subject=Script Request: ${encodeURIComponent(project.title)}" class="secondary">Request Script</a>`;
    materialsHTML += `</div>`;
    
    modalMaterials.innerHTML = materialsHTML;
  } else {
    modalMaterials.innerHTML = `
      <h3>Request Materials</h3>
      <a href="mailto:NCCAEntertainment@gmail.com?subject=Material Request: ${encodeURIComponent(project.title)}" class="secondary">Contact for Materials</a>
    `;
  }
  
  // Show modal
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Close modal
function closeProjectModal() {
  const modal = document.getElementById('projectModal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// Initialize modal when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProjectModal);
} else {
  initProjectModal();
}
