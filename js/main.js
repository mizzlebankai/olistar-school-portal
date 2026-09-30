function initializeMain() {
    document.querySelectorAll('header.page-hero, .editorial-hero').forEach((hero) => {
        requestAnimationFrame(() => {
            hero.classList.add('hero-ready');
        });
    });

    // Gallery Filtering
    const filterButtons = document.querySelectorAll('#galleryFilters [data-filter]');

    if (filterButtons.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.getAttribute('data-filter');

                filterButtons.forEach(btn => {
                    btn.classList.remove('btn-dark');
                    btn.classList.add('btn-outline-dark');
                });

                button.classList.remove('btn-outline-dark');
                button.classList.add('btn-dark');

                document.querySelectorAll('.gallery-item').forEach(item => {
                    if (filter === 'all' || item.dataset.category === filter) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        });
    }

    // Dynamic Year for Footer
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMain, { once: true });
} else {
    initializeMain();
}