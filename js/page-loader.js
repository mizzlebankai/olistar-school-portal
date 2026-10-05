(() => {
    const splash = document.getElementById('page-splash');
    if (!splash) return;

    const minimumVisibleTime = 650;
    const maximumContentWait = 8000;
    const startedAt = performance.now();
    let dismissed = false;
    let domReady = document.readyState !== 'loading';
    let contentReady = document.documentElement.dataset.publicContentReady === 'true';
    let contentTimedOut = false;
    let contentTimeout;

    const hideSplash = () => {
        if (dismissed) return;
        dismissed = true;
        window.clearTimeout(contentTimeout);

        const remainingTime = Math.max(0, minimumVisibleTime - (performance.now() - startedAt));
        window.setTimeout(() => {
            splash.classList.add('is-hidden');
            splash.setAttribute('aria-hidden', 'true');
            window.setTimeout(() => {
                splash.remove();
                document.dispatchEvent(new Event('page-splash-dismissed'));
            }, 400);
        }, remainingTime);
    };

    const hasPublicContent = () => Boolean(document.querySelector('script[src*="public-content.js"]'));
    const tryHideSplash = () => {
        if (domReady && (!hasPublicContent() || contentReady || contentTimedOut)) hideSplash();
    };
    const markContentReady = () => {
        contentReady = true;
        tryHideSplash();
    };

    document.addEventListener('public-content-ready', markContentReady);

    if (domReady) {
        if (hasPublicContent() && !contentReady) {
            contentTimeout = window.setTimeout(() => {
                contentTimedOut = true;
                console.warn('Website content did not finish loading before the page-load timeout.');
                tryHideSplash();
            }, maximumContentWait);
        }
        tryHideSplash();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            domReady = true;
            if (hasPublicContent() && !contentReady) {
                contentTimeout = window.setTimeout(() => {
                    contentTimedOut = true;
                    console.warn('Website content did not finish loading before the page-load timeout.');
                    tryHideSplash();
                }, maximumContentWait);
            }
            tryHideSplash();
        }, { once: true });
        window.setTimeout(() => {
            domReady = true;
            contentTimedOut = true;
            tryHideSplash();
        }, maximumContentWait + 1000);
    }

})();
