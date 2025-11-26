document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});

async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();

        if (data.authenticated) {
            updateUserUI(data.user);
            fetchTenders();
        } else {
            showLoginPrompt();
        }
    } catch (err) {
        console.error('Auth check failed', err);
    }
}

function updateUserUI(user) {
    const controls = document.getElementById('user-controls');
    controls.innerHTML = `
        <div class="user-info">
            <img src="${user.avatar_url}" alt="Avatar" class="avatar">
            <span>${user.display_name}</span>
            <a href="/auth/logout" class="btn-logout">Salir</a>
        </div>
    `;
}

function showLoginPrompt() {
    const grid = document.getElementById('tenders-grid');
    grid.innerHTML = `
        <div class="login-prompt">
            <h2>🔒 Acceso Restringido</h2>
            <p>Debes iniciar sesión para ver las licitaciones.</p>
            <a href="/auth/google" class="btn-login-large">Iniciar Sesión con Google</a>
        </div>
    `;
}

async function fetchTenders() {
    const grid = document.getElementById('tenders-grid');

    try {
        const response = await fetch('/api/tenders');
        if (response.status === 401) {
            showLoginPrompt();
            return;
        }
        const tenders = await response.json();
        renderTenders(tenders, grid);
    } catch (error) {
        console.error('Error fetching tenders:', error);
        grid.innerHTML = '<div class="loading">Error al cargar las licitaciones.</div>';
    }
}

function updateStats(tenders) {
    document.getElementById('total-tenders').textContent = tenders.length;
    const highScores = tenders.filter(t => t.ai_score >= 70).length;
    document.getElementById('high-score-tenders').textContent = highScores;
}

function renderTenders(tenders, container) {
    if (tenders.length === 0) {
        container.innerHTML = '<div class="loading">No hay licitaciones aún. Esperando a N8N...</div>';
        return;
    }

    container.innerHTML = tenders.map(tender => {
        const date = new Date(tender.deadline).toLocaleDateString('es-CL');
        const scoreClass = getScoreClass(tender.ai_score);

        return `
            <article class="card">
                <div class="card-header">
                    <span class="code">#${tender.code}</span>
                    <div class="score-badge ${scoreClass}">
                        ${tender.ai_score}% Match
                    </div>
                </div>
                <h3>${tender.title}</h3>
                <p class="summary">${tender.ai_summary || 'Sin resumen disponible.'}</p>
                <div class="card-footer">
                    <div class="deadline">
                        📅 Cierra: ${date}
                    </div>
                    <a href="#" class="btn-link">Ver Detalle →</a>
                </div>
            </article>
        `;
    }).join('');
}

function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 50) return 'score-med';
    return '';
}
