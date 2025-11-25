document.addEventListener('DOMContentLoaded', () => {
    fetchTenders();
});

async function fetchTenders() {
    const grid = document.getElementById('tenders-grid');

    try {
        const response = await fetch('/api/tenders');
        const tenders = await response.json();

        updateStats(tenders);
        renderTenders(tenders, grid);
    } catch (error) {
        console.error('Error fetching tenders:', error);
        grid.innerHTML = '<div class="loading">Error al cargar las licitaciones. Asegúrate de que el servidor esté corriendo.</div>';
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
