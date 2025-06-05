class RankingTimeline {
    constructor() {
        this.data = null;
        this.mostMatchesData = null;
        this.mostTitlesData = null;
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
            console.log('Loading momentum_score_data.json...');
            const response = await fetch('./data/momentum_score_data.json');
            this.data = await response.json();
            console.log(`✅ Loaded ${this.data.length} monthly timepoints from ${this.data[0].date} to ${this.data[this.data.length-1].date}`);
        } catch (error) {
            console.log('❌ Failed to load monthly data:', error.message);
            // Fallback to weekly momentum data
            try {
                console.log('Trying title_momentum_data.json...');
                const fallbackResponse = await fetch('./data/title_momentum_data.json');
                this.data = await fallbackResponse.json();
                console.log(`✅ Loaded ${this.data.length} weekly timepoints (fallback)`);
            } catch (fallbackError) {
                console.log('❌ Failed to load weekly momentum data:', fallbackError.message);
                // Final fallback to old rankings format
                try {
                    console.log('Trying weekly_rankings.json...');
                    const finalFallbackResponse = await fetch('./data/weekly_rankings.json');
                    const finalFallbackData = await finalFallbackResponse.json();
                    // Convert old format to new format
                    this.data = finalFallbackData.map(week => ({
                        date: week.date,
                        rank: week.rankings || [],
                        top: [],
                        total_period_titles: 0
                    }));
                    console.log(`✅ Loaded ${this.data.length} weeks (final fallback format)`);
                } catch (finalFallbackError) {
                    console.log('❌ Using sample data:', finalFallbackError.message);
                    this.data = this.createSampleData();
                }
            }
        }

        // Load player nationality data
        await this.loadPlayerNationalities();

        // Load line chart data
        await this.loadLineChartData();

        // Continue setup after data is loaded
        this.createScrollSections();
        this.createTimeline();
        this.renderTables();
        this.renderLineCharts();
        this.updateTimeline(); // Initialize timeline highlighting for first date
        this.setupScrollama();

        console.log('✅ Initialization complete!');
    }

    async loadPlayerNationalities() {
        try {
            console.log('Loading player_list.json...');
            const response = await fetch('./data/player_list.json');
            const playerList = await response.json();

            // Create nationality mapping: player_name -> country_code
            this.playerNationalities = new Map();
            playerList.forEach(player => {
                this.playerNationalities.set(player.player_name, player.country);
            });

            console.log(`✅ Loaded nationalities for ${this.playerNationalities.size} players`);
        } catch (error) {
            console.log('❌ Failed to load player nationalities:', error.message);
            this.playerNationalities = new Map();
        }
    }

    async loadLineChartData() {
        try {
            console.log('Loading line chart data...');
            
            // Load most matches data
            const matchesResponse = await fetch('./data/most_matches_data.json');
            this.mostMatchesData = await matchesResponse.json();
            console.log(`✅ Loaded ${this.mostMatchesData.length} timepoints for most matches`);
            
            // Load most titles data
            const titlesResponse = await fetch('./data/most_titles_data.json');
            this.mostTitlesData = await titlesResponse.json();
            console.log(`✅ Loaded ${this.mostTitlesData.length} timepoints for most titles`);
            
        } catch (error) {
            console.log('❌ Failed to load line chart data:', error.message);
            this.mostMatchesData = [];
            this.mostTitlesData = [];
        }
    }

    getCountryFlag(countryCode) {
        // Convert country code to flag emoji using proper Unicode
        const flagMap = {
            'USA': '🇺🇸', 'ESP': '🇪🇸', 'SUI': '🇨🇭', 'SRB': '🇷🇸', 'ARG': '🇦🇷',
            'RUS': '🇷🇺', 'AUT': '🇦🇹', 'GBR': '🇬🇧', 'GER': '🇩🇪', 'FRA': '🇫🇷',
            'ITA': '🇮🇹', 'NED': '🇳🇱', 'BEL': '🇧🇪', 'CRO': '🇭🇷', 'GRE': '🇬🇷',
            'CAN': '🇨🇦', 'AUS': '🇦🇺', 'JPN': '🇯🇵', 'KOR': '🇰🇷', 'CHN': '🇨🇳',
            'BRA': '🇧🇷', 'CHI': '🇨🇱', 'URU': '🇺🇾', 'PER': '🇵🇪', 'COL': '🇨🇴',
            'MEX': '🇲🇽', 'RSA': '🇿🇦', 'EGY': '🇪🇬', 'MAR': '🇲🇦', 'TUN': '🇹🇳',
            'ISR': '🇮🇱', 'IND': '🇮🇳', 'PAK': '🇵🇰', 'THA': '🇹🇭', 'VIE': '🇻🇳',
            'TPE': '🇹🇼', 'HKG': '🇭🇰', 'SIN': '🇸🇬', 'MAS': '🇲🇾', 'PHI': '🇵🇭',
            'INA': '🇮🇩', 'UZB': '🇺🇿', 'KAZ': '🇰🇿', 'GEO': '🇬🇪', 'ARM': '🇦🇲',
            'BLR': '🇧🇾', 'UKR': '🇺🇦', 'POL': '🇵🇱', 'CZE': '🇨🇿', 'SVK': '🇸🇰',
            'HUN': '🇭🇺', 'ROU': '🇷🇴', 'BUL': '🇧🇬', 'SLO': '🇸🇮', 'FIN': '🇫🇮',
            'SWE': '🇸🇪', 'NOR': '🇳🇴', 'DEN': '🇩🇰', 'ISL': '🇮🇸', 'IRL': '🇮🇪',
            'POR': '🇵🇹', 'ECU': '🇪🇨', 'VEN': '🇻🇪', 'PAR': '🇵🇾', 'BOL': '🇧🇴',
            // Add more common tennis countries
            'TCH': '🇨🇿', 'YUG': '🇷🇸', 'URS': '🇷🇺', 'FRG': '🇩🇪', 'GDR': '🇩🇪'
        };
        return flagMap[countryCode] || '🏳️';
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

    createTimeline() {
        const container = document.getElementById('timeline-container');

        // Clear any existing timeline elements
        container.innerHTML = '';

        // Add background click area for the entire timeline
        const backgroundArea = document.createElement('div');
        backgroundArea.className = 'timeline-background';
        backgroundArea.style.position = 'absolute';
        backgroundArea.style.top = '0';
        backgroundArea.style.right = '-30px'; // Extend to cover the bars that are positioned at right: 0
        backgroundArea.style.width = '120px'; // Wide enough to cover all bar sizes
        backgroundArea.style.height = '100%';
        backgroundArea.style.cursor = 'pointer';
        backgroundArea.style.zIndex = '1';
        backgroundArea.style.backgroundColor = 'transparent';

        // Add click handler to background for timeline navigation
        backgroundArea.addEventListener('click', (e) => {
            // Only handle clicks if not dragging
            if (!this.isDragging) {
                console.log('Background clicked');
                const rect = container.getBoundingClientRect();
                const clickY = e.clientY - rect.top;
                const percentage = clickY / rect.height;
                const yearIndex = Math.round(percentage * (this.timelineYears.length - 1));
                console.log(`Click at ${clickY}px, ${(percentage*100).toFixed(1)}%, year index: ${yearIndex}`);
                if (yearIndex >= 0 && yearIndex < this.timelineYears.length) {
                    this.navigateToYear(yearIndex);
                }
            }
        });

        container.appendChild(backgroundArea);

        // Get date range from data
        const dates = this.data.map(d => new Date(d.date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));

        // Generate one bar per year
        const years = [];
        const startYear = minDate.getFullYear();
        const endYear = maxDate.getFullYear();

        for (let year = startYear; year <= endYear; year++) {
            const yearDate = new Date(year, 0, 1); // January 1st of each year
            years.push({
                date: yearDate,
                year: year
            });
        }

        const totalYears = years.length;

        years.forEach((yearData, index) => {
            // Create wrapper for better click area
            const yearWrapper = document.createElement('div');
            yearWrapper.className = 'timeline-year-wrapper';
            yearWrapper.setAttribute('data-year', yearData.year);
            yearWrapper.setAttribute('data-index', index);

            // Position vertically - evenly distributed with larger click area
            const topPercent = (index / (totalYears - 1)) * 100;
            const wrapperHeight = Math.max(8, 80 / totalYears); // Minimum 8px, scales with timeline density
            yearWrapper.style.top = `calc(${topPercent}% - ${wrapperHeight/2}px)`;
            yearWrapper.style.height = `${wrapperHeight}px`;
            yearWrapper.style.zIndex = '2'; // Above background

            // Create the actual visible bar
            const yearDiv = document.createElement('div');
            yearDiv.className = 'timeline-year';

            // Check if this is a decade year
            const year = yearData.year;
            const isDecadeYear = year % 10 === 0 && [1980, 1990, 2000, 2010, 2020].includes(year);

            if (isDecadeYear) {
                yearDiv.classList.add('decade');
            }

            // Add year label
            const label = document.createElement('div');
            label.className = 'timeline-year-label';
            if (isDecadeYear) {
                label.textContent = year;
                label.style.display = 'block';
            } else {
                label.style.display = 'none';
            }
            yearDiv.appendChild(label);

            // Add the bar to the wrapper
            yearWrapper.appendChild(yearDiv);

            // Add click handler to the wrapper for better UX
            yearWrapper.addEventListener('click', (e) => {
                console.log(`Year bar clicked: ${year}`);
                e.stopPropagation(); // Prevent background handler
                this.navigateToYear(index);
            });

            container.appendChild(yearWrapper);
        });

        // Store years for later use
        this.timelineYears = years;

        // Setup drag functionality
        this.setupDragHandlers();

        console.log(`Created timeline with ${totalYears} year bars`);
    }

    updateTimeline() {
        const currentData = this.data[this.currentIndex];
        const currentDate = new Date(currentData.date);
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        // Find the closest year to current data
        let currentYearIndex = 0;
        let minDiff = Infinity;

        this.timelineYears.forEach((yearData, index) => {
            const diff = Math.abs(yearData.year - currentYear);
            if (diff < minDiff) {
                minDiff = diff;
                currentYearIndex = index;
            }
        });

        // Update year marker states with gradient effect
        const yearMarkers = document.querySelectorAll('.timeline-year');
        yearMarkers.forEach((marker, index) => {
            const label = marker.querySelector('.timeline-year-label');

            // Remove all current state classes
            marker.classList.remove('current', 'current-prev-1', 'current-next-1',
                                   'current-prev-2', 'current-next-2');

            // Reset label visibility and content, and reset styling
            if (label) {
                label.style.display = 'none';
                label.textContent = '';
            }

            // Reset all custom styling first
            marker.style.width = '';
            marker.style.backgroundColor = '';

            // Get the year for this year marker
            const markerYear = this.timelineYears[index].year;
            const yearDiff = Math.abs(markerYear - currentYear);

            // Calculate progressive sizing based on exact position within year
            const progress = (currentMonth + 1) / 12; // 0 to 1 through the year

            if (markerYear === currentYear) {
                // Current year - 300% width with label
                marker.classList.add('current');
                if (label) {
                    label.textContent = `${monthNames[currentMonth]} ${currentYear}`;
                    label.style.display = 'block';
                }
            } else if (yearDiff === 1) {
                // Adjacent years - progressive sizing and coloring based on proximity
                let size = 200; // Base 200%
                let colorIntensity = 0.5; // Base color intensity

                if (markerYear < currentYear) {
                    // Previous year - size based on how far into current year we are
                    size = 150 + (50 * (1 - progress)); // 150% to 200%
                    colorIntensity = 0.3 + (0.4 * (1 - progress)); // 0.3 to 0.7
                    marker.classList.add('current-prev-1');
                } else {
                    // Next year - size based on how far into current year we are
                    size = 150 + (50 * progress); // 150% to 200%
                    colorIntensity = 0.3 + (0.4 * progress); // 0.3 to 0.7
                    marker.classList.add('current-next-1');
                }

                marker.style.width = `${size * 0.2}px`; // Convert percentage to pixels (base 20px)
                // Apply progressive color - blend between gray and blue
                const grayAmount = Math.round(221 * (1 - colorIntensity)); // #ddd = 221
                const blueAmount = Math.round(77 + (102 * colorIntensity)); // From #4d to #66
                marker.style.backgroundColor = `rgb(${grayAmount}, ${grayAmount + Math.round(40 * colorIntensity)}, ${blueAmount + Math.round(136 * colorIntensity)})`;
            } else if (yearDiff === 2) {
                // 2 years away - 150% width
                if (markerYear < currentYear) {
                    marker.classList.add('current-prev-2');
                } else {
                    marker.classList.add('current-next-2');
                }
            } else {
                // Show decade labels if applicable (styling already reset above)
                if (marker.classList.contains('decade')) {
                    // Show decade labels for decade years only
                    if (label) {
                        label.textContent = markerYear;
                        label.style.display = 'block';
                    }
                }
            }
        });
    }

    setupDragHandlers() {
        const timelineContainer = document.getElementById('timeline-container');
        this.isDragging = false;

        // Remove any existing event listeners to prevent duplicates
        if (this.dragHandlers) {
            document.removeEventListener('mousemove', this.dragHandlers.handleMouseMove);
            document.removeEventListener('mouseup', this.dragHandlers.handleMouseUp);
            document.removeEventListener('touchmove', this.dragHandlers.handleTouchMove);
            document.removeEventListener('touchend', this.dragHandlers.handleMouseUp);
        }

        const handleMouseDown = (e) => {
            // Only enable dragging when clicking on the background, not on bars themselves
            const clickedBar = e.target.closest('.timeline-year-wrapper') || e.target.closest('.timeline-year');
            const clickedBackground = e.target.closest('.timeline-background');

            if (clickedBackground && !clickedBar) {
                this.isDragging = true;
                e.preventDefault();
                handleMouseMove(e); // Immediately update position for background clicks
            }
        };

        const handleMouseMove = (e) => {
            if (!this.isDragging) return;

            const rect = timelineContainer.getBoundingClientRect();
            const containerHeight = rect.height;
            let newTop = e.clientY - rect.top;

            // Constrain to container bounds
            newTop = Math.max(0, Math.min(containerHeight, newTop));

            // Calculate progress percentage
            const progressPercent = (newTop / containerHeight) * 100;

            // Calculate corresponding data index
            const dataIndex = Math.round((progressPercent / 100) * (this.data.length - 1));

            // Update visualization if index changed
            if (dataIndex !== this.currentIndex && dataIndex >= 0 && dataIndex < this.data.length) {
                this.currentIndex = dataIndex;
                this.renderTables();
                this.updateTimeline();

                // Scroll to corresponding section
                const scrollContainer = document.getElementById('scroll-container');
                const sections = scrollContainer.children;
                if (sections[dataIndex]) {
                    sections[dataIndex].scrollIntoView({ behavior: 'instant' });
                }
            }

            e.preventDefault();
        };

        const handleMouseUp = () => {
            this.isDragging = false;
        };

        const handleTouchMove = (e) => {
            if (this.isDragging) {
                const touch = e.touches[0];
                handleMouseMove({ clientY: touch.clientY, preventDefault: () => e.preventDefault() });
            }
        };

        // Store handlers for cleanup
        this.dragHandlers = {
            handleMouseMove,
            handleMouseUp,
            handleTouchMove
        };

        // Mouse events
        timelineContainer.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Touch events for mobile
        timelineContainer.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            handleMouseDown({ target: e.target, clientY: touch.clientY, preventDefault: () => e.preventDefault() });
        });

        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('touchend', handleMouseUp);
    }

    navigateToYear(yearIndex) {
        // Map year index to data index
        if (!this.timelineYears || yearIndex >= this.timelineYears.length) return;

        const targetYearData = this.timelineYears[yearIndex];

        // Find the closest data point to the target year
        let closestIndex = 0;
        let closestDiff = Infinity;

        this.data.forEach((dataPoint, index) => {
            const dataDate = new Date(dataPoint.date);
            const diff = Math.abs(dataDate.getFullYear() - targetYearData.year);
            if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = index;
            }
        });

        // Update to closest data point
        if (closestIndex !== this.currentIndex) {
            this.currentIndex = closestIndex;
            this.renderTables();
            this.updateTimeline();

            // Scroll to corresponding section
            const scrollContainer = document.getElementById('scroll-container');
            const sections = scrollContainer.children;
            if (sections[closestIndex]) {
                sections[closestIndex].scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    renderTables() {
        this.renderRankings();
        this.renderMomentum();
        this.renderLineCharts();
    }

    renderRankings() {
        const table = document.getElementById('ranking-table');
        const header = document.getElementById('ranking-header');
        const currentTimepoint = this.data[this.currentIndex];

        // Update header with current date
        const date = new Date(currentTimepoint.date);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        if (header) {
            header.textContent = `Ranking • ${formattedDate}`;
            console.log(`Updated ranking header to: Ranking • ${formattedDate}`);
        } else {
            console.log('Header element not found!');
        }

        table.innerHTML = '';

        // Show top 10 rankings
        const rankings = currentTimepoint.rank || [];
        rankings.slice(0, 10).forEach(player => {
            const row = document.createElement('div');
            row.className = 'ranking-row';
            row.innerHTML = `
                <div class="rank-number">${player.rank}</div>
                <div class="player-name">${player.name}</div>
                <div class="player-points">${player.points > 0 ? player.points.toLocaleString() : '-'}</div>
            `;
            table.appendChild(row);
        });

        // If no rankings data, show message
        if (rankings.length === 0) {
            table.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">No ranking data available</div>';
        }
    }

    renderMomentum() {
        const summaryEl = document.getElementById('momentum-summary');
        const currentTimepoint = this.data[this.currentIndex];

        // Update summary
        const totalMomentum = currentTimepoint.total_momentum || 0;
        const topPerformers = currentTimepoint.top || [];
        summaryEl.innerHTML = `Total momentum: ${totalMomentum.toFixed(1)} across ${topPerformers.length} players`;

        // Render pie chart
        this.renderPieChart(topPerformers);
    }

    renderPieChart(topPerformers) {
        const svg = d3.select('#momentum-pie-chart');

        if (topPerformers.length === 0) {
            svg.selectAll('*').remove();
            svg.append('text')
                .attr('x', 450)
                .attr('y', 400)
                .attr('text-anchor', 'middle')
                .attr('fill', '#666')
                .style('font-size', '16px')
                .text('No momentum detected');
            return;
        }

        const width = 900;
        const height = 800;
        const radius = Math.min(width, height) / 2 - 160;
        const innerRadius = radius * 0.5;

        // Initialize SVG group if it doesn't exist
        let g = svg.select('g.pie-chart-group');
        if (g.empty()) {
            g = svg.append('g')
                .attr('class', 'pie-chart-group')
                .attr('transform', `translate(${width/2}, ${height/2})`);
        }

        // Prepare data - limit to top 8 players, group others as "Others"
        let chartData = [...topPerformers];
        if (chartData.length > 8) {
            const top7 = chartData.slice(0, 7);
            const others = chartData.slice(7);
            const othersTotal = others.reduce((sum, p) => sum + p.momentum_score, 0);
            if (othersTotal > 0) {
                chartData = [
                    ...top7,
                    {
                        player_name: `Others`,
                        momentum_score: othersTotal
                    }
                ];
            } else {
                chartData = top7;
            }
        }

        // Create consistent color mapping based on player names
        if (!this.playerColors) {
            this.playerColors = new Map();
            this.colorPalette = [
                '#FF6B35', '#F7931E', '#FFD23F', '#06D6A0',
                '#118AB2', '#073B4C', '#9D4EDD', '#F72585'
            ];
            this.colorIndex = 0;
        }

        // Assign consistent colors to players (excluding "Others")
        chartData.forEach(d => {
            if (d.player_name !== 'Others' && !this.playerColors.has(d.player_name)) {
                this.playerColors.set(d.player_name, this.colorPalette[this.colorIndex % this.colorPalette.length]);
                this.colorIndex++;
            }
        });

        // Always assign white color to "Others"
        this.playerColors.set('Others', '#FFFFFF');

        // Sort data by momentum score (largest first for clockwise arrangement)
        chartData.sort((a, b) => b.momentum_score - a.momentum_score);

        // Create pie layout
        const pie = d3.pie()
            .value(d => d.momentum_score)
            .sort((a, b) => b.momentum_score - a.momentum_score) // Sort by size, largest first
            .startAngle(-Math.PI / 2) // Start at 12 o'clock (top)
            .endAngle(3 * Math.PI / 2) // End at 12 o'clock (full circle)
            .padAngle(0.02);

        // Arc generators
        const arc = d3.arc()
            .innerRadius(d => d.data.player_name === 'Others' ? innerRadius * 1.25 : innerRadius)
            .outerRadius(d => d.data.player_name === 'Others' ? radius * 0.75 : radius) // Smaller radius for Others
            .cornerRadius(8); // Add rounded corners

        const outerArc = d3.arc()
            .innerRadius(radius * 1.2)
            .outerRadius(radius * 1.2);

        // Handle connecting lines FIRST so they appear behind everything else
        // (Render connecting lines for player cards only, not "Others")
        const linesData = pie(chartData).filter(d => d.data.player_name !== 'Others');
        const lines = g.selectAll('.pie-label-line')
            .data(linesData, d => d.data.player_name);

        lines.exit()
            .transition()
            .duration(750)
            .style('opacity', 0)
            .remove();

        const linesEnter = lines.enter()
            .append('polyline')
            .attr('class', 'pie-label-line')
            .style('opacity', 0);

        const linesUpdate = linesEnter.merge(lines);

        linesUpdate
            .transition()
            .duration(750)
            .style('opacity', 1)
            .attr('points', function(d) {
                const pos = outerArc.centroid(d);
                const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;
                // Line to player card photo
                pos[0] = radius * 1.4 * (isLeft ? 1 : -1);
                const cardPos = [...pos];
                cardPos[0] += isLeft ? -40 : -40; // Updated to match new image position
                cardPos[1] = pos[1] - 15;
                return [arc.centroid(d), outerArc.centroid(d), cardPos].join(' ');
            });

        // Bind data to pie slices with key function for object constancy
        const arcs = g.selectAll('.arc')
            .data(pie(chartData), d => d.data.player_name);

        // Remove exiting arcs
        arcs.exit()
            .transition()
            .duration(750)
            .style('opacity', 0)
            .remove();

        // Add new arcs
        const arcsEnter = arcs.enter()
            .append('g')
            .attr('class', 'arc');

        arcsEnter.append('path')
            .attr('class', 'pie-slice')
            .attr('fill', d => this.playerColors.get(d.data.player_name) || '#CCCCCC')
            .style('opacity', 0)
            .on('mouseover', function(event, d) {
                const tooltip = d3.select('body').append('div')
                    .attr('class', 'pie-tooltip')
                    .style('position', 'absolute')
                    .style('background', 'rgba(0,0,0,0.8)')
                    .style('color', 'white')
                    .style('padding', '8px')
                    .style('border-radius', '4px')
                    .style('font-size', '12px')
                    .style('pointer-events', 'none')
                    .style('z-index', '1000')
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 10) + 'px')
                    .html(`${d.data.player_name}<br/>Momentum: ${d.data.momentum_score.toFixed(1)}<br/>Titles: ${d.data.titles_count || 0} | Win Rate: ${(d.data.win_rate * 100).toFixed(1)}%`);
            })
            .on('mouseout', function() {
                d3.selectAll('.pie-tooltip').remove();
            });

        // Update all arcs (existing and new)
        const arcsUpdate = arcsEnter.merge(arcs);

        // IMMEDIATELY set colors without transition to prevent transparency
        arcsUpdate.select('.pie-slice')
            .attr('fill', d => this.playerColors.get(d.data.player_name) || '#CCCCCC')
            .style('opacity', 1);

        // Then apply the transition for shape changes only
        arcsUpdate.select('.pie-slice')
            .transition()
            .duration(750)
            .attrTween('d', function(d) {
                const interpolate = d3.interpolate(this._current || {startAngle: 0, endAngle: 0}, d);
                this._current = interpolate(0);
                return function(t) {
                    return arc(interpolate(t));
                };
            });

        // Handle player cards for individual players (not "Others")
        const playerCardsData = pie(chartData).filter(d => d.data.player_name !== 'Others');
        const playerCards = g.selectAll('.player-card')
            .data(playerCardsData, d => d.data.player_name);

        playerCards.exit()
            .transition()
            .duration(750)
            .style('opacity', 0)
            .remove();

        const cardsEnter = playerCards.enter()
            .append('g')
            .attr('class', 'player-card')
            .style('opacity', 0);

        // Add white semi-transparent background for new cards
        cardsEnter.append('rect')
            .attr('class', 'player-card-bg')
            .attr('fill', 'rgba(255, 255, 255, 0.85)')
            .attr('stroke', 'rgba(255, 255, 255, 0.9)')
            .attr('stroke-width', 1)
            .attr('rx', 12)
            .attr('ry', 12)
            .style('opacity', 0.9);

        const cardsUpdate = cardsEnter.merge(playerCards);

        cardsUpdate
            .transition()
            .duration(750)
            .style('opacity', 1)
            .attr('transform', function(d) {
                const pos = outerArc.centroid(d);
                const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;
                pos[0] = radius * 1.4 * (isLeft ? 1 : -1);
                return `translate(${pos})`;
            });

        // Update background rectangles for ALL cards - consistent layout
        cardsUpdate.selectAll('.player-card-bg')
            .transition()
            .duration(750)
            .attr('x', -80) // Always covers the consistent layout
            .attr('y', -60)
            .attr('width', 190) // Even wider to add 10px right padding
            .attr('height', 80);

        // Add player photo (circle background) - FIXED: only for new cards
        const photos = cardsEnter.selectAll('.player-photo')
            .data(d => [d]);

        photos.enter()
            .append('circle')
            .attr('class', 'player-photo')
            .attr('r', 25)
            .attr('fill', '#ddd')
            .attr('stroke', '#fff')
            .attr('stroke-width', 3);

        // Update positions for ALL photo circles - always on the left
        cardsUpdate.selectAll('.player-photo')
            .attr('cx', -30) // Always on the left
            .attr('cy', -15);

        // FIXED: Player photo images - only set href for NEW images
        const self = this; // Store reference to class instance
        const photoImages = cardsUpdate.selectAll('.player-photo-img')
            .data(d => [d], d => d.data.player_name); // Key function prevents recreation

        const newPhotoImages = photoImages.enter()
            .append('image')
            .attr('class', 'player-photo-img')
            .attr('width', 70)
            .attr('height', 70)
            .style('clip-path', 'circle(35px)')
            .each(function(d) {
                // Only set href for NEW images
                console.log(`🖼️ Creating photo for: ${d.data.player_name}`);
                const imgElement = d3.select(this);
                imgElement.attr('href', `./images/players/cropped/${d.data.player_name.toLowerCase().replace(/\s+/g, '-')}_cropped.png`);

                // Mark as loading to prevent premature error handling
                imgElement.attr('data-loading', 'true');
            })
            .on('load', function(event, d) {
                // Photo loaded successfully, remove loading flag
                d3.select(this).attr('data-loading', null);
                console.log(`✅ Photo loaded for: ${d.data.player_name}`);
                
                // Hide background circle when photo loads successfully
                const card = d3.select(this.parentNode);
                card.select('.player-photo').style('display', 'none');
                card.select('.player-initials').remove(); // Remove any leftover initials
            })
            .on('error', function(event, d) {
                // Only handle error if not still loading
                const imgElement = d3.select(this);
                if (imgElement.attr('data-loading') === 'true') {
                    imgElement.attr('data-loading', null);

                    console.log(`❌ Photo failed for: ${d.data.player_name}, showing initials`);
                    const card = d3.select(this.parentNode);
                    const initials = d.data.player_name.split(' ').map(n => n[0]).join('');
                    const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;

                    // Hide the broken image
                    imgElement.style('display', 'none');

                    // Update background circle color
                    card.select('.player-photo')
                        .attr('fill', self.playerColors?.get(d.data.player_name) || '#666')
                        .attr('stroke', '#fff')
                        .attr('stroke-width', 3);

                    // Add initials if not already present
                    if (card.select('.player-initials').empty()) {
                        card.append('text')
                            .attr('class', 'player-initials')
                            .attr('x', -30) // Always on the left
                            .attr('y', -10)
                            .attr('text-anchor', 'middle')
                            .attr('dominant-baseline', 'middle')
                            .attr('fill', 'white')
                            .attr('font-size', '18px')
                            .attr('font-weight', 'bold')
                            .attr('font-family', 'Arial, sans-serif')
                            .style('pointer-events', 'none')
                            .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.5)')
                            .text(initials);
                    }
                }
            });

        // Update positions for ALL photo images (existing + new) - always on the left
        photoImages.merge(newPhotoImages)
            .attr('x', -65) // Always on the left
            .attr('y', -50);

        // FIXED: Nationality flags - only set href for NEW images
        const flags = cardsUpdate.selectAll('.player-flag')
            .data(d => [d], d => d.data.player_name); // Key function prevents recreation

        const newFlags = flags.enter()
            .append('image')
            .attr('class', 'player-flag')
            .attr('width', 24)
            .attr('height', 16)
            .style('border-radius', '2px')
            .each(function(d) {
                // Only set href for NEW flags
                const countryCode = self.playerNationalities?.get(d.data.player_name);
                if (countryCode) {
                    console.log(`🏁 Creating flag for: ${d.data.player_name} (${countryCode})`);
                    d3.select(this).attr('href', `./images/flags/${countryCode.toLowerCase()}.png`);
                }
            })
            .on('error', function(event, d) {
                console.log(`❌ Flag failed for: ${d.data.player_name}`);
                // Hide broken flag
                d3.select(this).style('display', 'none');

                const card = d3.select(this.parentNode);
                const countryCode = self.playerNationalities?.get(d.data.player_name);

                // Create fallback country code badge
                if (countryCode && card.select('.flag-fallback').empty()) {
                    const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;
                    const playerColor = self.playerColors?.get(d.data.player_name) || '#666';

                    const flagFallback = card.append('g').attr('class', 'flag-fallback');

                    flagFallback.append('rect')
                        .attr('x', -75) // Always same position
                        .attr('y', 0)
                        .attr('width', 24)
                        .attr('height', 16)
                        .attr('rx', 2)
                        .attr('fill', playerColor)
                        .attr('stroke', 'white')
                        .attr('stroke-width', 1)
                        .style('opacity', 0.8);

                    flagFallback.append('text')
                        .attr('x', -63) // Always same position
                        .attr('y', 8)
                        .attr('text-anchor', 'middle')
                        .attr('dominant-baseline', 'middle')
                        .attr('font-size', '8px')
                        .attr('font-weight', 'bold')
                        .attr('font-family', 'Arial, sans-serif')
                        .attr('fill', 'white')
                        .style('text-shadow', '1px 1px 1px rgba(0,0,0,0.5)')
                        .text(countryCode);
                }
            });

        // Update positions for ALL flags (existing + new) - always on the left
        flags.merge(newFlags)
            .attr('x', -75) // Always on the left (bottom-left of photo)
            .attr('y', 0);

        // Add player name with wrapping for long names
        const names = cardsUpdate.selectAll('.player-name')
            .data(d => [d]);

        names.enter()
            .append('text')
            .attr('class', 'player-name')
            .attr('font-size', '13px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .merge(names)
            .attr('x', 15) // 10px more spacing from photo
            .attr('y', -25)
            .attr('text-anchor', 'start') // Always left-aligned text
            .text(d => d.data.player_name); // Single line name only

        // Add titles and win rate
        const stats = cardsUpdate.selectAll('.player-stats')
            .data(d => [d]);

        stats.enter()
            .append('text')
            .attr('class', 'player-stats')
            .attr('font-size', '10px')
            .attr('fill', '#888')
            .merge(stats)
            .attr('x', 15) // Match name position with 10px spacing
            .attr('y', -13) // Almost touching name
            .attr('text-anchor', 'start') // Always left-aligned text
            .text(d => {
                const titles = d.data.titles_count || 0;
                const winRate = d.data.win_rate ? (d.data.win_rate * 100).toFixed(1) : '0.0';
                return `${titles} titles • ${winRate}% wins`;
            });

        // Remove any existing "Others" labels
        g.selectAll('.pie-external-label').remove();

        // Add tennis ball image in the center (only once)
        if (g.select('.tennis-ball').empty()) {
            const ballSize = innerRadius * 1.8 * 1.1;

            g.append('image')
                .attr('class', 'tennis-ball')
                .attr('x', -ballSize / 2)
                .attr('y', -ballSize / 2)
                .attr('width', ballSize)
                .attr('height', ballSize)
                .attr('href', './images/tennis-ball.png')
                .style('clip-path', 'circle(50%)');
        }
    }

    renderLineCharts() {
        if (!this.mostMatchesData || !this.mostTitlesData || this.mostMatchesData.length === 0 || this.mostTitlesData.length === 0) {
            return;
        }

        this.renderMostMatchesChart();
        this.renderMostTitlesChart();
    }

    renderMostMatchesChart() {
        const currentTimepoint = this.mostMatchesData[this.currentIndex];
        if (!currentTimepoint) return;

        const svg = d3.select('#most-matches-chart');
        if (svg.empty()) return;

        svg.selectAll('*').remove();

        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        const width = 400 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Get top 10 players from current timepoint
        const players = currentTimepoint.top_players.slice(0, 10);
        
        // Create scales
        const xScale = d3.scaleLinear()
            .domain([0, d3.max(players, d => d.total_matches)])
            .range([0, width]);

        const yScale = d3.scaleBand()
            .domain(players.map((d, i) => i))
            .range([0, height])
            .padding(0.1);

        // Create bars
        g.selectAll('.bar')
            .data(players)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', 0)
            .attr('y', (d, i) => yScale(i))
            .attr('width', d => xScale(d.total_matches))
            .attr('height', yScale.bandwidth())
            .attr('fill', '#4a90e2')
            .attr('opacity', 0.8);

        // Add player names
        g.selectAll('.player-label')
            .data(players)
            .enter()
            .append('text')
            .attr('class', 'player-label')
            .attr('x', -5)
            .attr('y', (d, i) => yScale(i) + yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .text(d => d.player_name.split(' ').slice(-1)[0]); // Last name only

        // Add value labels
        g.selectAll('.value-label')
            .data(players)
            .enter()
            .append('text')
            .attr('class', 'value-label')
            .attr('x', d => xScale(d.total_matches) + 3)
            .attr('y', (d, i) => yScale(i) + yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('font-size', '9px')
            .attr('fill', '#666')
            .text(d => d.total_matches);

        // Add x-axis
        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(5));

        // Add title
        svg.append('text')
            .attr('x', width / 2 + margin.left)
            .attr('y', margin.top / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text('Most Career Matches');
    }

    renderMostTitlesChart() {
        const currentTimepoint = this.mostTitlesData[this.currentIndex];
        if (!currentTimepoint) return;

        const svg = d3.select('#most-titles-chart');
        if (svg.empty()) return;

        svg.selectAll('*').remove();

        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        const width = 400 - margin.left - margin.right;
        const height = 300 - margin.top - margin.bottom;

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Get top 10 players from current timepoint
        const players = currentTimepoint.top_players.slice(0, 10);
        
        // Create scales
        const xScale = d3.scaleLinear()
            .domain([0, d3.max(players, d => d.total_titles)])
            .range([0, width]);

        const yScale = d3.scaleBand()
            .domain(players.map((d, i) => i))
            .range([0, height])
            .padding(0.1);

        // Create bars
        g.selectAll('.bar')
            .data(players)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', 0)
            .attr('y', (d, i) => yScale(i))
            .attr('width', d => xScale(d.total_titles))
            .attr('height', yScale.bandwidth())
            .attr('fill', '#f39c12')
            .attr('opacity', 0.8);

        // Add player names
        g.selectAll('.player-label')
            .data(players)
            .enter()
            .append('text')
            .attr('class', 'player-label')
            .attr('x', -5)
            .attr('y', (d, i) => yScale(i) + yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'end')
            .attr('font-size', '10px')
            .attr('fill', '#333')
            .text(d => d.player_name.split(' ').slice(-1)[0]); // Last name only

        // Add value labels
        g.selectAll('.value-label')
            .data(players)
            .enter()
            .append('text')
            .attr('class', 'value-label')
            .attr('x', d => xScale(d.total_titles) + 3)
            .attr('y', (d, i) => yScale(i) + yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('font-size', '9px')
            .attr('fill', '#666')
            .text(d => d.total_titles);

        // Add x-axis
        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(5));

        // Add title
        svg.append('text')
            .attr('x', width / 2 + margin.left)
            .attr('y', margin.top / 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text('Most Career Titles');
    }

    updateDate() {
        const dateEl = document.getElementById('current-date');
        const currentTimepoint = this.data[this.currentIndex];

        // Format the date nicely - emphasize month since we're using monthly data
        const date = new Date(currentTimepoint.date);
        const formatted = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long'
        });

        // Show year-month if available for cleaner display
        if (currentTimepoint.year_month) {
            const [year, month] = currentTimepoint.year_month.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            dateEl.textContent = `${monthNames[parseInt(month)-1]} ${year}`;
        } else {
            dateEl.textContent = formatted;
        }
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
                    this.renderTables();
                    this.updateTimeline();

                    console.log(`Timepoint ${newIndex + 1}/${this.data.length}: ${this.data[newIndex].date}`);
                }
            });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.scroller.resize();
        });

        console.log('Scrollama setup complete');
    }

    createSampleData() {
        return [
            {
                date: "1973-08-27",
                rank: [
                    { rank: 1, name: "Ilie Nastase", points: 0 },
                    { rank: 2, name: "Manuel Orantes", points: 0 },
                    { rank: 3, name: "Stan Smith", points: 0 },
                    { rank: 4, name: "Arthur Ashe", points: 0 },
                    { rank: 5, name: "Rod Laver", points: 0 }
                ],
                top: [],
                total_period_titles: 0
            },
            {
                date: "2010-01-04",
                rank: [
                    { rank: 1, name: "Roger Federer", points: 10550 },
                    { rank: 2, name: "Rafael Nadal", points: 9205 },
                    { rank: 3, name: "Novak Djokovic", points: 8310 },
                    { rank: 4, name: "Andy Murray", points: 7030 },
                    { rank: 5, name: "Juan Martin del Potro", points: 6785 }
                ],
                top: [
                    { player_id: 103819, player_name: "Roger Federer", period_titles: 8 },
                    { player_id: 104745, player_name: "Rafael Nadal", period_titles: 6 },
                    { player_id: 104925, player_name: "Novak Djokovic", period_titles: 2 }
                ],
                total_period_titles: 28
            }
        ];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RankingTimeline();
});