(() => {
    const splash = document.getElementById('page-splash');
    if (!splash) return;

    const minimumVisibleTime = 650;
    const startedAt = performance.now();
    let dismissed = false;

    const hideSplash = () => {
        if (dismissed) return;
        dismissed = true;

        const remainingTime = Math.max(0, minimumVisibleTime - (performance.now() - startedAt));
        window.setTimeout(() => {
            splash.classList.add('is-hidden');
            splash.setAttribute('aria-hidden', 'true');
            window.setTimeout(() => splash.remove(), 400);
        }, remainingTime);
    };

    if (document.readyState === 'complete') {
        hideSplash();
    } else {
        window.addEventListener('load', hideSplash, { once: true });
        window.setTimeout(hideSplash, 2800);
    }
})();
