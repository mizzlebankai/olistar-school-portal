/* ==========================================================================
   Olistar School - Interactive Behaviors & Visual Effects Script
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // 1. Dynamic Navbar Scroll Effect
    const navbar = document.querySelector('.navbar-harvard');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 40) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // 2. Scroll Reveal Observer for Cards, Containers, and Sections
    const revealElements = document.querySelectorAll(
        'section .row > div, .tile-card, header h1, header p, .bg-white.border'
    );

    revealElements.forEach(el => el.classList.add('reveal-on-scroll'));

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    // 3. Dynamic Current Year Update in Footer
    const currentYearSpan = document.getElementById('current-year');
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // 4. Gallery Category Filter Interaction (for gallery.html)
    const filterButtons = document.querySelectorAll('#galleryFilters .btn');
    const galleryItems = document.querySelectorAll('#galleryGrid .gallery-item');

    if (filterButtons.length > 0 && galleryItems.length > 0) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active-filter', 'btn-dark'));
                filterButtons.forEach(btn => btn.classList.add('btn-outline-dark'));

                button.classList.removeClass('btn-outline-dark');
                button.classList.add('active-filter');

                const filterValue = button.getAttribute('data-filter');

                galleryItems.forEach(item => {
                    const category = item.getAttribute('data-category');
                    if (filterValue === 'all' || category === filterValue) {
                        item.style.display = 'block';
                        setTimeout(() => {
                            item.style.opacity = '1';
                            item.style.transform = 'scale(1)';
                        }, 50);
                    } else {
                        item.style.opacity = '0';
                        item.style.transform = 'scale(0.92)';
                        setTimeout(() => {
                            item.style.display = 'none';
                        }, 300);
                    }
                });
            });
        });
    }

    // 5. Form Submission Interactive Feedback
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (contactForm.checkValidity()) {
                const submitBtn = contactForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Dispatching...';

                setTimeout(() => {
                    alert('Thank you! Your institutional inquiry has been successfully dispatched to Olistar School administration.');
                    contactForm.reset();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }, 1200);
            } else {
                contactForm.classList.add('was-validated');
            }
        });
    }

    const admissionsForm = document.getElementById('admissionsForm');
    if (admissionsForm) {
        admissionsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            if (admissionsForm.checkValidity()) {
                const submitBtn = admissionsForm.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Processing Application...';

                setTimeout(() => {
                    alert('Application successfully received! The Olistar School Admissions Desk will contact you shortly.');
                    admissionsForm.reset();
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                }, 1500);
            } else {
                admissionsForm.classList.add('was-validated');
            }
        });
    }
});