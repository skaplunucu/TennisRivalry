class RankingTimeline {
    constructor() {
        this.data = null;
        this.currentIndex = 0;
        this.scroller = null;
        this.init();
    }

    init() {
        console.log('Initializing...');
        this.loadData();
    }

    async loadData() {
        try {
            console.log('Loading weekly_rankings.json...');
            const response = await fetch('./data/weekly_rankings.json');
            this.data = await response.json();
            console.log(`✅ Loaded ${this.data.length} weeks from ${this.data[0].formatted_date} to ${this.data[this.data.length-1].formatted_date}`);
        } catch (error) {
            console.log('❌ Using sample data:', error.message);
        }

        // Continue setup after data is loaded
        this.createScrollSections();
        this.renderRankings();
        this.updateDate();
        this.setupScrollama();

        console.log('✅ Initialization complete!');
    }

    createScrollSections() {
        const container = document.getElementById('scroll-container');

        // Create a scroll section for each week
        this.data.forEach((week, index) => {
            const section = document.createElement('div');
            section.className = 'scroll-section';
            section.setAttribute('data-week-index', index);

            if (index === 0) {
                section.classList.add('first-section');
            }

            container.appendChild(section);
        });

        console.log(`Created ${this.data.length} scroll sections`);
    }

    renderRankings() {
        const table = document.getElementById('ranking-table');
        const currentWeek = this.data[this.currentIndex];

        table.innerHTML = '';

        currentWeek.rankings.forEach(player => {
            const row = document.createElement('div');
            row.className = 'ranking-row';
            row.innerHTML = `
                <div class="rank-number">${player.rank}</div>
                <div class="player-name">${player.name}</div>
                <div class="player-points">${player.points > 0 ? player.points.toLocaleString() : '-'}</div>
            `;
            table.appendChild(row);
        });
    }

    updateDate() {
        const dateEl = document.getElementById('current-date');
        const currentWeek = this.data[this.currentIndex];
        dateEl.textContent = currentWeek.formatted_date;
    }

    setupScrollama() {
        this.scroller = scrollama();

        this.scroller
            .setup({
                step: '.scroll-section',
                offset: 0.5,
                debug: false
            })
            .onStepEnter((response) => {
                const newIndex = parseInt(response.element.getAttribute('data-week-index'));

                if (newIndex !== this.currentIndex) {
                    this.currentIndex = newIndex;
                    this.renderRankings();
                    this.updateDate();

                    console.log(`Week ${newIndex + 1}/${this.data.length}: ${this.data[newIndex].formatted_date}`);
                }
            });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.scroller.resize();
        });

        console.log('Scrollama setup complete');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RankingTimeline();
});