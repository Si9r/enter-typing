// 카테고리 필터링 구현
const tabs = document.querySelectorAll('.filter-tab');
const cards = document.querySelectorAll('.notice-card');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const category = tab.getAttribute('data-category');

        cards.forEach(card => {
            card.classList.remove('expanded');

            if (category === 'all' || card.getAttribute('data-category') === category) {
                card.style.display = 'block';
                card.style.opacity = '0';
                setTimeout(() => {
                    card.style.transition = 'all 0.25s ease';
                    card.style.opacity = '1';
                }, 10);
            } else {
                card.style.display = 'none';
            }
        });
    });
});

// 카드 클릭 시 아코디언 슬라이드
cards.forEach(card => {
    card.addEventListener('click', (e) => {
        // 상세 내용 카드 자체를 클릭했거나 텍스트 드래그 시 확대/축소 오동작 방지
        if (e.target.closest('.notice-detail-content')) {
            return;
        }
        card.classList.toggle('expanded');
    });
});
