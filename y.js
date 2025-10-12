document.addEventListener('DOMContentLoaded', function () {

    const BACKEND_URL = 'http://127.0.0.1:5000';

    function isWebGLAvailable() {
        try {
            const canvas = document.createElement( 'canvas' );
            return !! ( window.WebGLRenderingContext && ( canvas.getContext( 'webgl' ) || canvas.getContext( 'experimental-webgl' ) ) );
        } catch ( e ) {
            return false;
        }
    }
    
     // --- 3D BACKGROUND ANIMATION ---
    function init3DBackground() {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg-animation'), alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        
        const particles = [];
        const particleCount = 200;
        const geometry = new THREE.IcosahedronGeometry(0.1, 0);

        for (let i = 0; i < particleCount; i++) {
            const material = new THREE.MeshBasicMaterial({ color: 0x64748b, wireframe: true });
            const particle = new THREE.Mesh(geometry, material);
            
            particle.position.x = (Math.random() - 0.5) * 20;
            particle.position.y = (Math.random() - 0.5) * 20;
            particle.position.z = (Math.random() - 0.5) * 20;
            
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01,
                (Math.random() - 0.5) * 0.01
            );

            particles.push(particle);
            scene.add(particle);
        }
        
        const lines = new THREE.Group();
        scene.add(lines);

        camera.position.z = 5;

        function animate() {
            requestAnimationFrame(animate);
            
            lines.children.forEach(line => {
                line.geometry.dispose();
                line.material.dispose();
            });
            lines.children = [];

            for (let i = 0; i < particleCount; i++) {
                const p1 = particles[i];
                p1.position.add(p1.velocity);
                
                if (p1.position.x < -10 || p1.position.x > 10) p1.velocity.x *= -1;
                if (p1.position.y < -10 || p1.position.y > 10) p1.velocity.y *= -1;
                if (p1.position.z < -10 || p1.position.z > 10) p1.velocity.z *= -1;

                for (let j = i + 1; j < particleCount; j++) {
                    const p2 = particles[j];
                    const distance = p1.position.distanceTo(p2.position);

                    if (distance < 1.5) {
                        const lineMaterial = new THREE.LineBasicMaterial({
                            color: 0x64748b,
                            transparent: true,
                            opacity: 1 - distance / 1.5
                        });
                        const lineGeometry = new THREE.BufferGeometry().setFromPoints([p1.position, p2.position]);
                        const line = new THREE.Line(lineGeometry, lineMaterial);
                        lines.add(line);
                    }
                }
            }

            scene.rotation.y += 0.0002;
            scene.rotation.x += 0.0001;

            renderer.render(scene, camera);
        }

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        window.addEventListener('resize', onWindowResize, false);
        animate();
    }
    
    if (isWebGLAvailable()) {
        init3DBackground();
    } else {
        console.warn("WebGL not available. Skipping 3D background.");
        document.getElementById('bg-animation').style.display = 'none';
    }
    
    // --- STATE MANAGEMENT ---
    let allComments = [];
    let filteredComments = [];
    let currentPage = 1;
    const itemsPerPage = 5;
    let sentimentChart = null;
    let provisionChartInstance = null;
    const sentimentColors = {
        positive: '#22c55e', // green-500
        negative: '#ef4444', // red-500
        neutral: '#f59e0b',  // amber-500
    };
    const sentimentBGClasses = {
        positive: 'bg-green-100 text-green-800',
        negative: 'bg-red-100 text-red-800',
        neutral: 'bg-yellow-100 text-yellow-800',
    };
    
    // --- DOM ELEMENT SELECTORS ---
    const tableBody = document.getElementById('commentsTableBody');
    const searchInput = document.getElementById('searchInput');
    const sentimentFilter = document.getElementById('sentimentFilter');
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationControls = document.getElementById('paginationControls');
    const commentTemplate = document.getElementById('comment-row-template');
    const keywordListContainer = document.getElementById('keyword-list');
    const sidebarNav = document.getElementById('sidebar-nav');
    const navLinks = sidebarNav.querySelectorAll('.nav-link');
    const pageContents = document.querySelectorAll('#app-container .page-content');
    const logoutButton = document.getElementById('logout-button');
    const uploadButton = document.getElementById('upload-button');
    const fileUploadInput = document.getElementById('file-upload-input');
    const exportButton = document.getElementById('export-button');
    const viewModal = document.getElementById('view-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const modalTitle = document.getElementById('modal-title');
    const modalProvision = document.getElementById('modal-provision');
    const modalSentiment = document.getElementById('modal-sentiment');
    const modalFullText = document.getElementById('modal-full-text');
    const toast = document.getElementById('toast-notification');
    const toastMessage = document.getElementById('toast-message');
    const loadingOverlay = document.getElementById('loading-overlay');
    const aiSummaryCard = document.getElementById('ai-summary-card');
    const aiSummaryText = document.getElementById('ai-summary-text');


     // --- AUTH ELEMENTS ---
    const loginModal = document.getElementById('login-modal');
    const closeLoginModalBtn = document.getElementById('close-login-modal-btn');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username-input');
    const passwordInput = document.getElementById('password-input');
    const loginError = document.getElementById('login-error');
    const authContainer = document.getElementById('auth-container');
    const userWelcomeContainer = document.getElementById('user-welcome-container');
    const welcomeUsername = document.getElementById('welcome-username');
    const welcomeAvatar = document.getElementById('welcome-avatar-img');
    const loginBtn = document.getElementById('login-btn');
    const loginGuestBtn = document.getElementById('login-guest-btn');
    const sidebarUsername = document.getElementById('sidebar-username');
    const sidebarRole = document.getElementById('sidebar-role');
    const sidebarAvatar = document.getElementById('sidebar-avatar-img');

    
    // --- AUTH LOGIC ---
    function updateUIAfterLogin(user) {
        const avatarUrl = `https://placehold.co/40x40/E2E8F0/475569?text=${user.name.charAt(0).toUpperCase()}`;
        
        sidebarUsername.textContent = user.name;
        sidebarRole.textContent = user.role;
        sidebarAvatar.src = avatarUrl;
        
        welcomeUsername.textContent = user.name;
        welcomeAvatar.src = avatarUrl;
        authContainer.classList.add('hidden');
        userWelcomeContainer.classList.remove('hidden');
        
        logoutButton.classList.remove('hidden');
        loginModal.classList.add('hidden');
    }

    function updateUIAfterLogout() {
        sidebarUsername.textContent = 'Guest User';
        sidebarRole.textContent = 'Public Access';
        sidebarAvatar.src = 'https://placehold.co/40x40/cbd5e1/475569?text=G';

        authContainer.classList.remove('hidden');
        userWelcomeContainer.classList.add('hidden');

        logoutButton.classList.add('hidden');
    }

    loginBtn.addEventListener('click', () => { loginModal.classList.remove('hidden'); });
    loginGuestBtn.addEventListener('click', () => {
        const guestUser = { name: 'Guest', role: 'Public Access' };
        updateUIAfterLogin(guestUser);
        logoutButton.classList.add('hidden'); 
    });
    closeLoginModalBtn.addEventListener('click', () => { loginModal.classList.add('hidden'); });
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (username.toLowerCase() === 'admin' && password === '12345') {
            const adminUser = { name: 'Admin', role: 'System Administrator' };
            updateUIAfterLogin(adminUser);
        } else {
            loginError.textContent = 'Invalid username or password.';
            loginError.classList.remove('hidden');
        }
    });
    logoutButton.addEventListener('click', () => { updateUIAfterLogout(); });

    // --- DATA PROCESSING AND UI UPDATE ---

    function processBackendResponse(data) {
        // Map backend response to frontend data structure
        const topKeywords = Object.keys(data.wordcloud_data || {}).slice(0, 5);
        allComments = (data.individual_results || []).map((item, index) => ({
            id: index + 1,
            text: item.comment,
            sentiment: item.sentiment.toLowerCase(),
            summary: item.comment.substring(0, 75) + (item.comment.length > 75 ? '...' : ''), // Generate simple summary
            keywords: topKeywords, // Use top overall keywords as a placeholder for each comment
            provision: "General Comment", // Placeholder as backend doesn't provide this
            flagged: false
        }));

        // Update UI components with new data
        updateDashboardStats(data.overall_distribution, allComments.length);
        updateSentimentChart(data.overall_distribution);
        updateKeywordList(data.wordcloud_data);
        
        // Update AI Summary Card
        if(data.summary) {
            aiSummaryText.textContent = data.summary;
            aiSummaryCard.classList.remove('hidden');
        } else {
            aiSummaryCard.classList.add('hidden');
        }

        // Apply filters and render the table
        handleFilterAndSearch();
    }
    
    function updateAllVisuals() {
        const sentimentCounts = filteredComments.reduce((acc, comment) => {
            const capitalizedSentiment = comment.sentiment.charAt(0).toUpperCase() + comment.sentiment.slice(1);
            acc[capitalizedSentiment] = (acc[capitalizedSentiment] || 0) + 1;
            return acc;
        }, { Positive: 0, Negative: 0, Neutral: 0 });

        updateDashboardStats(sentimentCounts, filteredComments.length);
        updateSentimentChart(sentimentCounts);
        // Keyword list is now updated directly from backend data, not from filtered comments
        renderTable();
    }

    function updateDashboardStats(counts, total) {
        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-positive').textContent = counts.Positive || 0;
        document.getElementById('stat-negative').textContent = counts.Negative || 0;
        document.getElementById('stat-neutral').textContent = counts.Neutral || 0;
        const getPercentage = (count, total) => (total === 0 ? '0.0%' : ((count / total) * 100).toFixed(1) + '%');
        document.getElementById('stat-positive-sub').textContent = `${getPercentage(counts.Positive, total)} of total`;
        document.getElementById('stat-negative-sub').textContent = `${getPercentage(counts.Negative, total)} of total`;
        document.getElementById('stat-neutral-sub').textContent = `${getPercentage(counts.Neutral, total)} of total`;
    }

    function updateSentimentChart(counts) {
        const data = [counts.Positive || 0, counts.Negative || 0, counts.Neutral || 0];
        if (sentimentChart) {
            sentimentChart.data.datasets[0].data = data;
            sentimentChart.update();
        } else {
            sentimentChart = new Chart(document.getElementById('sentimentChart').getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ['Positive', 'Negative', 'Neutral'],
                    datasets: [{ data: data, backgroundColor: [sentimentColors.positive, sentimentColors.negative, sentimentColors.neutral], borderColor: '#fff', borderWidth: 4 }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 20 } } } }
            });
        }
    }

    function updateKeywordList(wordcloudData) {
        keywordListContainer.innerHTML = '';
        const sortedKeywords = Object.entries(wordcloudData || {});
        if (sortedKeywords.length === 0) {
            keywordListContainer.innerHTML = '<p class="text-sm text-slate-500">No keywords found. Upload a file to begin.</p>';
            return;
        }
        sortedKeywords.forEach(([keyword, count]) => {
            keywordListContainer.innerHTML += `<div class="flex justify-between items-center text-sm pb-2 border-b border-slate-100"><span class="font-medium text-slate-700">${keyword}</span><span class="font-bold text-indigo-600 bg-indigo-100 px-2.5 py-0.5 rounded-full text-xs">${count}</span></div>`;
        });
    }

    function renderTable() {
        tableBody.innerHTML = '';
        const paginatedComments = filteredComments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        
        if (paginatedComments.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-16"><div class="flex flex-col items-center"><svg class="h-16 w-16 text-slate-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" /></svg><h3 class="mt-2 text-lg font-semibold text-slate-800">No Comments to Display</h3><p class="mt-1 text-sm text-slate-500">Please upload a file to start the analysis.</p></div></td></tr>`;
        } else {
            paginatedComments.forEach(comment => {
                const clone = commentTemplate.content.cloneNode(true);
                const row = clone.querySelector('tr');
                row.dataset.commentId = comment.id;
                clone.querySelector('.data-summary').firstChild.textContent = comment.summary;
                clone.querySelector('.data-text').textContent = `"${comment.text}"`;
                clone.querySelector('.data-provision').textContent = comment.provision;
                const sentimentBadge = clone.querySelector('.data-sentiment');
                sentimentBadge.textContent = comment.sentiment.charAt(0).toUpperCase() + comment.sentiment.slice(1);
                sentimentBadge.className += ` ${sentimentBGClasses[comment.sentiment]}`;
                const keywordsContainer = clone.querySelector('.data-keywords');
                comment.keywords.forEach(keyword => {
                    const span = document.createElement('span');
                    span.className = 'bg-slate-100 text-slate-700 text-xs font-medium px-2 py-0.5 rounded';
                    span.textContent = keyword;
                    keywordsContainer.appendChild(span);
                });
                const flagButton = clone.querySelector('.action-flag');
                if (comment.flagged) {
                    flagButton.classList.add('text-red-600');
                }
                tableBody.appendChild(clone);
            });
        }
        renderPagination();
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredComments.length / itemsPerPage);
        paginationControls.innerHTML = '';

        const createButton = (text, onClick, isDisabled, isCurrent) => {
            const button = document.createElement('button');
            button.innerHTML = text;
            button.className = isCurrent 
                ? 'px-3 py-1 rounded-md text-sm bg-indigo-600 text-white' 
                : `px-3 py-1 rounded-md text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed`;
            button.disabled = isDisabled;
            button.onclick = onClick;
            return button;
        };

        paginationControls.appendChild(createButton('<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>', () => { currentPage--; renderTable(); }, currentPage === 1));

        for (let i = 1; i <= totalPages; i++) {
            paginationControls.appendChild(createButton(i, () => { currentPage = i; renderTable(); }, false, currentPage === i));
        }
        
        paginationControls.appendChild(createButton('<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg>', () => { currentPage++; renderTable(); }, currentPage === totalPages || totalPages === 0));

        const startItem = filteredComments.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
        const endItem = Math.min(currentPage * itemsPerPage, filteredComments.length);
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${filteredComments.length} results`;
    }
    
    function renderProvisionChart() {
        const dataByProvision = allComments.reduce((acc, comment) => {
            if (!acc[comment.provision]) acc[comment.provision] = { positive: 0, negative: 0, neutral: 0 };
            acc[comment.provision][comment.sentiment]++;
            return acc;
        }, {});
        
        const labels = Object.keys(dataByProvision);
        const datasets = [
            { label: 'Positive', data: labels.map(p => dataByProvision[p].positive || 0), backgroundColor: sentimentColors.positive },
            { label: 'Negative', data: labels.map(p => dataByProvision[p].negative || 0), backgroundColor: sentimentColors.negative },
            { label: 'Neutral', data: labels.map(p => dataByProvision[p].neutral || 0), backgroundColor: sentimentColors.neutral }
        ];

        if(provisionChartInstance) provisionChartInstance.destroy();
        provisionChartInstance = new Chart(document.getElementById('provisionChart').getContext('2d'), {
            type: 'bar',
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
        });
    }

    // --- EVENT HANDLERS & LOGIC ---

    function handleFilterAndSearch() {
        const searchText = searchInput.value.toLowerCase();
        const sentimentValue = sentimentFilter.value;
        
        filteredComments = allComments.filter(comment => {
            const matchesSearch = searchText === '' ||
                comment.text.toLowerCase().includes(searchText) ||
                comment.summary.toLowerCase().includes(searchText) ||
                comment.provision.toLowerCase().includes(searchText) ||
                comment.keywords.some(k => k.toLowerCase().includes(searchText));
            
            const matchesSentiment = sentimentValue === 'all' || comment.sentiment === sentimentValue;
            
            return matchesSearch && matchesSentiment;
        });
        
        currentPage = 1;
        renderTable();
    }

    function handleTableClick(event) {
        const actionButton = event.target.closest('.action-view, .action-flag');
        if (!actionButton) return;
        
        const row = event.target.closest('tr');
        const commentId = parseInt(row.dataset.commentId);
        const comment = allComments.find(c => c.id === commentId);

        if (actionButton.classList.contains('action-view')) {
            showModal(comment);
        } else if (actionButton.classList.contains('action-flag')) {
            comment.flagged = !comment.flagged;
            actionButton.classList.toggle('text-red-600', comment.flagged);
        }
    }
    
    function handleNavigation(event) {
        const link = event.target.closest('.nav-link');
        if (!link) return;
        event.preventDefault();

        link.classList.add('nav-link-active-animation');
        link.addEventListener('animationend', () => {
            link.classList.remove('nav-link-active-animation');
        }, { once: true });
        
        const targetId = link.dataset.target;
        
        navLinks.forEach(navLink => {
            navLink.classList.remove('bg-indigo-100', 'text-indigo-600');
            navLink.classList.add('text-slate-600', 'hover:bg-slate-100');
            navLink.removeAttribute('aria-current');
        });
        
        link.classList.add('bg-indigo-100', 'text-indigo-600');
        link.classList.remove('text-slate-600', 'hover:bg-slate-100');
        link.setAttribute('aria-current', 'page');
        
        pageContents.forEach(page => {
            page.classList.toggle('active', page.id === targetId);
        });
        
        if (targetId === 'page-reports') {
            renderProvisionChart();
        }
    }
    
    function showModal(comment) {
        modalTitle.textContent = `Comment #${comment.id} Details`;
        modalProvision.textContent = `Regarding: ${comment.provision}`;
        modalFullText.textContent = comment.text;
        modalSentiment.innerHTML = `<span class="px-2 py-1 text-xs font-medium rounded-full ${sentimentBGClasses[comment.sentiment]}">${comment.sentiment.charAt(0).toUpperCase() + comment.sentiment.slice(1)}</span>`;
        viewModal.classList.remove('hidden');
    }

    function exportDataToCSV() {
        if (filteredComments.length === 0) {
            showToast('No data to export.', 'error');
            return;
        }
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID,Sentiment,Provision,Keywords,Full Text\n";

        filteredComments.forEach(comment => {
            const row = [
                comment.id,
                comment.sentiment,
                comment.provision,
                `"${comment.keywords.join(', ')}"`,
                `"${comment.text.replace(/"/g, '""')}"`
            ].join(',');
            csvContent += row + "\n";
        });
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "sentiment_analysis_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const allowedExtensions = ['csv', 'txt', 'xls', 'xlsx'];
        const extension = file.name.split('.').pop().toLowerCase();

        if (!allowedExtensions.includes(extension)) {
            showToast('Invalid file type. Please upload a valid document.', 'error');
            return;
        }

        loadingOverlay.classList.remove('hidden');
        showToast(`Processing "${file.name}"...`, 'info');
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${BACKEND_URL}/analyze`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'An unknown error occurred.');
            }
            
            processBackendResponse(data);
            showToast('Analysis complete!', 'success');

        } catch (error) {
            console.error("Error analyzing file:", error);
            showToast(`Error: ${error.message}`, 'error');
        } finally {
            loadingOverlay.classList.add('hidden');
            // Reset file input to allow uploading the same file again
            event.target.value = '';
        }
    }

    function showToast(message, type = 'success') {
        toastMessage.textContent = message;
        toast.classList.remove('bg-green-500', 'bg-red-500', 'bg-blue-500');
        if (type === 'success') toast.classList.add('bg-green-500');
        else if (type === 'error') toast.classList.add('bg-red-500');
        else toast.classList.add('bg-blue-500');

        toast.style.transform = 'translateX(0)';
        setTimeout(() => {
            toast.style.transform = 'translateX(120%)';
        }, 3000);
    }

    // --- EVENT LISTENERS BINDING ---
    sidebarNav.addEventListener('click', handleNavigation);
    searchInput.addEventListener('input', handleFilterAndSearch);
    sentimentFilter.addEventListener('change', handleFilterAndSearch);
    tableBody.addEventListener('click', handleTableClick);
    
    uploadButton.addEventListener('click', () => fileUploadInput.click());
    fileUploadInput.addEventListener('change', handleFileUpload);
    exportButton.addEventListener('click', exportDataToCSV);

    closeModalBtn.addEventListener('click', () => viewModal.classList.add('hidden'));
    viewModal.addEventListener('click', (e) => { if (e.target === viewModal) viewModal.classList.add('hidden'); });

    // --- INITIALIZATION ---
    function initialize() {
        allComments = [];
        handleFilterAndSearch();
        updateKeywordList({});
    }
    
    initialize();

    // --- CHATBOT LOGIC ---
    const chatWidget = document.getElementById('chat-widget-container');
    const chatToggleButton = document.getElementById('chat-toggle-button');
    const chatCloseButton = document.getElementById('chat-close-btn');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');

    function toggleChatWidget() {
        chatWidget.classList.toggle('hidden');
        setTimeout(() => {
            chatWidget.classList.toggle('active');
        }, 10);
    }

    function appendMessage(message, sender) {
        let messageHtml = '';
        if (sender === 'user') {
            messageHtml = `
                <div class="flex items-start gap-3 justify-end">
                    <div class="bg-indigo-600 text-white p-3 rounded-lg rounded-br-none max-w-xs">
                        <p class="text-sm">${message}</p>
                    </div>
                    <div class="p-2 bg-slate-200 rounded-full"><svg class="h-6 w-6 text-slate-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 0 5 5 5 5 0 0 0-5-5zm0 8a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm9 11v-1a7 7 0 0 0-7-7h-4a7 7 0 0 0-7 7v1h2v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1z" /></svg></div>
                </div>`;
        } else if (sender === 'bot') {
            messageHtml = `
                <div class="flex items-start gap-3">
                    <div class="p-2 bg-indigo-100 rounded-full"><svg class="h-6 w-6 text-indigo-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><path d="M12 20h4"/><path d="M12 4H8"/><path d="M20 12h-4"/><path d="M4 12h4"/></svg></div>
                    <div class="bg-slate-100 text-slate-700 p-3 rounded-lg rounded-tl-none max-w-xs">
                        <p class="text-sm">${message}</p>
                    </div>
                </div>`;
        }
        chatMessagesContainer.innerHTML += messageHtml;
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }
    
    // The Chatbot logic remains as-is, using its own API key.
    // It is separate from the file analysis backend.
    chatToggleButton.addEventListener('click', toggleChatWidget);
    chatCloseButton.addEventListener('click', toggleChatWidget);
    // Placeholder for chat form submission
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userInput = chatInput.value.trim();
        if (!userInput) return;
        appendMessage(userInput, 'user');
        chatInput.value = '';
        setTimeout(() => appendMessage("Chatbot functionality is configured separately and is currently for demonstration.", 'bot'), 1000);
    });
});
