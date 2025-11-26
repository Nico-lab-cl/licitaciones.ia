document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupAuthListeners();
});

async function checkAuth() {
    try {
        const res = await fetch('/api/me');
        const data = await res.json();

        if (data.authenticated) {
            updateUILoggedIn(data.user);
            fetchTenders();
        } else {
            updateUILoggedOut();
        }
    } catch (err) {
        console.error('Auth check failed', err);
    }
}

function updateUILoggedIn(user) {
    // Navbar
    document.getElementById('guest-nav').style.display = 'none';
    const userNav = document.getElementById('user-nav');
    userNav.style.display = 'flex';
    userNav.innerHTML = `
        <div class="user-info">
            <img src="${user.avatar_url || 'https://ui-avatars.com/api/?name=' + user.display_name}" alt="Avatar" class="avatar">
            <span>${user.display_name}</span>
            <a href="/auth/logout" class="btn-text" style="color: var(--danger);">Salir</a>
        </div>
    `;

    // Content
    document.getElementById('hero-section').style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'block';

    // Close modal if open
    document.getElementById('auth-overlay').style.display = 'none';
}

function updateUILoggedOut() {
    // Navbar
    document.getElementById('guest-nav').style.display = 'flex';
    document.getElementById('user-nav').style.display = 'none';

    // Content
    document.getElementById('hero-section').style.display = 'block';
    document.getElementById('dashboard-container').style.display = 'none';
}

function setupAuthListeners() {
    const overlay = document.getElementById('auth-overlay');
    const btnLogin = document.getElementById('btn-nav-login');
    const btnRegister = document.getElementById('btn-nav-register');
    const btnClose = document.getElementById('close-auth');

    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const msg = document.getElementById('auth-message');

    // Open Modal
    function openModal(mode) {
        overlay.style.display = 'flex';
        msg.textContent = '';
        if (mode === 'login') {
            tabLogin.click();
        } else {
            tabRegister.click();
        }
    }

    btnLogin.addEventListener('click', () => openModal('login'));
    btnRegister.addEventListener('click', () => openModal('register'));
    btnClose.addEventListener('click', () => overlay.style.display = 'none');

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
    });

    // Tabs
    tabLogin.addEventListener('click', () => {
        loginForm.style.display = 'flex';
        registerForm.style.display = 'none';
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
        msg.textContent = '';
    });

    tabRegister.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'flex';
        tabRegister.classList.add('active');
        tabLogin.classList.remove('active');
        msg.textContent = '';
    });

    // Login Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();

            if (res.ok) {
                updateUILoggedIn(data.user);
                fetchTenders();
            } else {
                msg.textContent = data.error || 'Error al iniciar sesión';
                msg.className = 'auth-message error';
            }
        } catch (err) {
            msg.textContent = 'Error de conexión';
        }
    });

    // Register Submit
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const res = await fetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();

            if (res.ok) {
                msg.textContent = data.message;
                msg.className = 'auth-message success';
                registerForm.reset();
            } else {
                msg.textContent = data.error || 'Error al registrarse';
                msg.className = 'auth-message error';
            }
        } catch (err) {
            msg.textContent = 'Error de conexión';
        }
    });
}

async function fetchTenders() {
    const grid = document.getElementById('tenders-grid');

    try {
        const response = await fetch('/api/tenders');
        if (response.status === 401) return; // Should be handled by checkAuth
        const tenders = await response.json();
        renderTenders(tenders, grid);
    } catch (error) {
        console.error('Error fetching tenders:', error);
        grid.innerHTML = '<div class="loading">Error al cargar las licitaciones.</div>';
    }
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
