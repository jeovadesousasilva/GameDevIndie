document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    const nav = document.querySelector('.nav');
    const navLinks = document.querySelectorAll('.nav-link');
    const sectionLinks = Array.from(navLinks).filter((link) => link.getAttribute('href')?.startsWith('#'));
    const sections = document.querySelectorAll('section[id]');

    if (header) {
        const updateHeaderState = () => {
            header.classList.toggle('scrolled', window.scrollY > 24);
        };

        updateHeaderState();
        window.addEventListener('scroll', updateHeaderState, { passive: true });
    }

    if (menuToggle && nav) {
        menuToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
            const icon = menuToggle.querySelector('span');
            if (icon) {
                icon.textContent = nav.classList.contains('active') ? 'Fechar' : 'Menu';
            }
        });
    }

    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            if (!nav || !menuToggle) return;
            nav.classList.remove('active');
            const icon = menuToggle.querySelector('span');
            if (icon) {
                icon.textContent = 'Menu';
            }
        });
    });

    if (sectionLinks.length > 0 && sections.length > 0) {
        const updateActiveSection = () => {
            let current = '';

            sections.forEach((section) => {
                if (window.scrollY >= section.offsetTop - 140) {
                    current = section.getAttribute('id') || '';
                }
            });

            sectionLinks.forEach((link) => {
                link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
            });
        };

        updateActiveSection();
        window.addEventListener('scroll', updateActiveSection, { passive: true });
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
