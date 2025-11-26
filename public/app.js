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
