document.addEventListener('DOMContentLoaded', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scrollDirection = 1;
    let lastScrollY = window.scrollY;

    document.addEventListener('page-splash-dismissed', () => {
        if (reduceMotion) return;
        document.querySelector('.navbar-harvard .navbar-brand')?.classList.add('brand-reveal');
    }, { once: true });

    // -----------------------------------------------------------------
    // Scroll reveal: enter from below while scrolling down and above while scrolling up
    // -----------------------------------------------------------------
    document.querySelectorAll('section:not(.reveal-on-scroll):not([data-no-reveal])')
        .forEach(section => section.classList.add('reveal-on-scroll'));

    const revealElements = document.querySelectorAll('.reveal-on-scroll');

    if (reduceMotion || !('IntersectionObserver' in window)) {
        revealElements.forEach(el => el.classList.add('is-visible'));
    } else {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                entry.target.style.setProperty('--reveal-offset', scrollDirection > 0 ? '20px' : '-20px');
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                } else {
                    entry.target.classList.remove('is-visible');
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });

        revealElements.forEach((el, index) => {
            el.style.setProperty('--reveal-delay', `${(index % 3) * 60}ms`);
            observer.observe(el);
        });
    }

    // -----------------------------------------------------------------
    // Count homepage statistics once when they enter the viewport
    // -----------------------------------------------------------------
    const counters = document.querySelectorAll('[data-count-to]');
    if (!reduceMotion && 'IntersectionObserver' in window) {
        counters.forEach(element => {
            element.textContent = `0${element.dataset.countSuffix || ''}`;
        });
    }
    const countUp = element => {
        const target = Number(element.dataset.countTo);
        if (!Number.isFinite(target)) return;
        const suffix = element.dataset.countSuffix || '';
        const duration = 1400;
        const startedAt = performance.now();
        const format = new Intl.NumberFormat('en');

        const tick = now => {
            const progress = Math.min(1, (now - startedAt) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = Math.round(target * eased);
            element.textContent = `${format.format(progress === 1 ? target : value)}${suffix}`;
            if (progress < 1) requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    };

    if (reduceMotion || !('IntersectionObserver' in window)) {
        counters.forEach(element => {
            const target = Number(element.dataset.countTo);
            if (Number.isFinite(target)) {
                element.textContent = `${new Intl.NumberFormat('en').format(target)}${element.dataset.countSuffix || ''}`;
            }
        });
    } else {
        const counterObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                countUp(entry.target);
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.5 });
        counters.forEach(counter => counterObserver.observe(counter));
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
            if (y !== lastScrollY) scrollDirection = y > lastScrollY ? 1 : -1;
            lastScrollY = y;
            if (navbar) navbar.classList.toggle('scrolled', y > 30);
            if (backToTop) backToTop.classList.toggle('show', y > 500);
            ticking = false;
        });
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    onScroll();
});
