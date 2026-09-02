document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const sectionLinks = Array.from(navLinks).filter((link) => link.getAttribute('href')?.startsWith('#'));
    const sections = document.querySelectorAll('section[id]');
    const backToTop = document.querySelector('[data-back-to-top]');
    const revealItems = document.querySelectorAll(
        '.shellbound-brief-grid, .section-heading, .section-intro, .vision-copy, .vision-note-card, .stat-item, .project-card, .contact-panel'
    );
    let scrollTicking = false;

    const updateScrollState = () => {
        const scrollY = window.scrollY;

        if (header) {
            header.classList.toggle('scrolled', scrollY > 24);
        }

        if (backToTop) {
            backToTop.classList.toggle('visible', scrollY > 520);
        }
    };

    const requestScrollUpdate = () => {
        if (scrollTicking) return;

        scrollTicking = true;
        window.requestAnimationFrame(() => {
            updateScrollState();
            scrollTicking = false;
        });
    };

    updateScrollState();
    window.addEventListener('scroll', requestScrollUpdate, { passive: true });

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            const isOpen = nav.classList.contains('active');
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            const icon = menuToggle.querySelector('span');
            if (icon) {
                icon.textContent = isOpen ? menuToggle.dataset.labelClose || 'Close' : menuToggle.dataset.labelOpen || 'Menu';
            }
        });
    }

    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            if (!nav || !menuToggle) return;
            nav.classList.remove('active');
            menuToggle.setAttribute('aria-expanded', 'false');
            const icon = menuToggle.querySelector('span');
            if (icon) {
                icon.textContent = menuToggle.dataset.labelOpen || 'Menu';
            }
        });
    });

    if ('IntersectionObserver' in window && sectionLinks.length > 0 && sections.length > 0) {
        const sectionObserver = new IntersectionObserver(
            (entries) => {
                const visibleEntry = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (!visibleEntry) return;

                const current = visibleEntry.target.getAttribute('id') || '';
                sectionLinks.forEach((link) => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
                });
            },
            {
                rootMargin: '-28% 0px -58% 0px',
                threshold: [0.1, 0.35, 0.65]
            }
        );

        sections.forEach((section) => sectionObserver.observe(section));
    }

    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    if ('IntersectionObserver' in window && revealItems.length > 0) {
        const revealObserver = new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                });
            },
            {
                rootMargin: '0px 0px -12% 0px',
                threshold: 0.12
            }
        );

        revealItems.forEach((item, index) => {
            item.classList.add('reveal-on-scroll');
            item.style.transitionDelay = `${Math.min(index % 4, 3) * 55}ms`;
            revealObserver.observe(item);
        });
    } else {
        revealItems.forEach((item) => item.classList.add('visible'));
    }

    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') return;

            const targetElement = document.querySelector(targetId);
            if (!targetElement) return;

            e.preventDefault();
            const headerOffset = header ? header.offsetHeight + 16 : 16;

            window.scrollTo({
                top: targetElement.offsetTop - headerOffset,
                behavior: 'smooth'
            });
        });
    });
});
