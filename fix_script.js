// Cycling background images
let currentBg = 0;
const backgrounds = document.querySelectorAll('.hero-background');

function cycleBg() {
    backgrounds[currentBg].classList.remove('active');
    currentBg = (currentBg + 1) % backgrounds.length;
    backgrounds[currentBg].classList.add('active');
}

// Initialize first background
if (backgrounds.length > 0) {
    backgrounds[0].classList.add('active');
    // Cycle every 5 seconds
    setInterval(cycleBg, 5000);
}

// Modal functionality
function openModal(projectId) {
    const modal = document.getElementById('projectModal');
    const modalContent = document.getElementById('modalContent');
    
    // Project data
    const projects = {
        'the-last-dynasty': {
            title: 'The Last Dynasty',
            year: '2025',
            genre: 'Gothic Crime Thriller / Musical Mystery',
            description: 'When tremor-ridden music heiress Jasmine Carter returns to her father\'s empire for a life-saving payout, she\'s trapped in his mansion during a glittering lockdown party where the king is murdered, the crown is stolen, and every guest—from her cartel-blackmailed brother to the detective hunting her family—is both suspect and accomplice.',
            details: 'A Gothic crime thriller with musical mystery elements that combines "Succession" meets "The Godfather" with the lyrical grit of Atlanta. To survive the night, Jasmine must decode her father\'s last song, exposing a generational conspiracy that ties her sister\'s suicide, a 19-year-old\'s buried demo tape, and the $200M debt that could drown them all. In the Carter dynasty, blood isn\'t thicker than royalties—and the only thing more dangerous than the truth is who\'s willing to sing it.',
            pitchDeck: 'the_last_dynasty_pitch_deck.pdf'
        },
        'southern-belles-secret': {
            title: 'The Southern Belle\'s Secret',
            year: '2025',
            genre: 'Southern Gothic Mystery / Family Drama',
            description: 'When a young woman returns to her grandmother\'s antebellum mansion to settle the estate, she uncovers a century-old family secret that threatens to destroy everything she thought she knew about her heritage—and herself.',
            details: 'A haunting Southern Gothic mystery that explores themes of family legacy, buried secrets, and the weight of history. Set against the backdrop of a crumbling antebellum mansion, the story weaves together past and present as dark family truths come to light.',
            pitchDeck: 'southern_belles_secret_pitch_deck.pdf'
        }
        // Add more projects as needed
    };

    const project = projects[projectId];
    if (project) {
        modalContent.innerHTML = `
            <h2>${project.title} (${project.year})</h2>
            <p><strong>Genre:</strong> ${project.genre}</p>
            <p><strong>Description:</strong> ${project.description}</p>
            <p><strong>Details:</strong> ${project.details}</p>
            ${project.pitchDeck ? `<div style="margin-top: 20px;"><a href="${project.pitchDeck}" target="_blank" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">📄 Download Pitch Deck</a></div>` : ''}
        `;
        modal.style.display = 'block';
    }
}

function closeModal() {
    document.getElementById('projectModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('projectModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Make functions globally available
window.openModal = openModal;
window.closeModal = closeModal;

