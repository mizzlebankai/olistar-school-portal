document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // -----------------------------------------------------------------
    // Scroll reveal: fade-and-rise sections as they enter the viewport
    // -----------------------------------------------------------------
    document.querySelectorAll('section:not(.reveal-on-scroll):not([data-no-reveal])')
        .forEach(section => section.classList.add('reveal-on-scroll'));

    const revealElements = document.querySelectorAll('.reveal-on-scroll');

    if (reduceMotion || !('IntersectionObserver' in window)) {
        revealElements.forEach(el => el.classList.add('is-visible'));
    } else {
        const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    obs.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

        revealElements.forEach((el, index) => {
            el.style.setProperty('--reveal-delay', `${(index % 3) * 60}ms`);
            observer.observe(el);
        });
    }

    // -----------------------------------------------------------------
    // Navbar condenses with a shadow once the page is scrolled
    // -----------------------------------------------------------------
    const navbar = document.querySelector('.navbar-harvard');
    const backToTop = document.createElement('button');
    backToTop.className = 'back-to-top';
    backToTop.setAttribute('aria-label', 'Back to top');
    backToTop.innerHTML = '<i class="bi bi-arrow-up"></i>';
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
    document.body.appendChild(backToTop);

    let ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const y = window.scrollY;
            if (navbar) navbar.classList.toggle('scrolled', y > 30);
            if (backToTop) backToTop.classList.toggle('show', y > 500);
            ticking = false;
        });
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    onScroll();
});
