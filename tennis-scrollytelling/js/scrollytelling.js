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
        
        // Continue setup after data is loaded
        this.createScrollSections();
        this.createTimeline();
        this.renderTables();
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

    // getCountryFlag(countryCode) {
    //     const flagMap = {
    //         'USA': '\uD83C\uDDFA\uD83C\uDDF8', // 🇺🇸
    //         'ESP': '\uD83C\uDDEA\uD83C\uDDF8', // 🇪🇸
    //         'SUI': '\uD83C\uDDE8\uD83C\uDDED', // 🇨🇭
    //         'SRB': '\uD83C\uDDF7\uD83C\uDDF8', // 🇷🇸
    //         'ARG': '\uD83C\uDDE6\uD83C\uDDF7', // 🇦🇷
    //         'RUS': '\uD83C\uDDF7\uD83C\uDDFA', // 🇷🇺
    //         'AUT': '\uD83C\uDDE6\uD83C\uDDF9', // 🇦🇹
    //         'GBR': '\uD83C\uDDEC\uD83C\uDDE7', // 🇬🇧
    //         'GER': '\uD83C\uDDE9\uD83C\uDDEA', // 🇩🇪
    //         'FRA': '\uD83C\uDDEB\uD83C\uDDF7', // 🇫🇷
    //         // Add more as needed...
    //     };
    //     return flagMap[countryCode] || '\uD83C\uDFF3\uFE0F'; // 🏳️
    // }

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
    }

    renderRankings() {
        const table = document.getElementById('ranking-table');
        const currentTimepoint = this.data[this.currentIndex];

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

        // Assign consistent colors to players
        chartData.forEach(d => {
            if (!this.playerColors.has(d.player_name)) {
                this.playerColors.set(d.player_name, this.colorPalette[this.colorIndex % this.colorPalette.length]);
                this.colorIndex++;
            }
        });

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
            .attr('fill', d => this.playerColors.get(d.data.player_name))
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
        
        arcsUpdate.select('.pie-slice')
            .transition()
            .duration(750)
            .style('opacity', 1)
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

        // Add player photo (circle background)
        const photos = cardsUpdate.selectAll('.player-photo')
            .data(d => [d]);

        photos.enter()
            .append('circle')
            .attr('class', 'player-photo')
            .merge(photos)
            .attr('cx', function(d) {
                const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;
                return isLeft ? -30 : 30;
            })
            .attr('cy', -15)
            .attr('r', 25)
            .attr('fill', '#ddd')
            .attr('stroke', '#fff')
            .attr('stroke-width', 3);

        // Add player photo image
        const photoImages = cardsUpdate.selectAll('.player-photo-img')
            .data(d => [d]);

        photoImages.enter()
            .append('image')
            .attr('class', 'player-photo-img')
            .merge(photoImages)
            .attr('x', function(d) {
                const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;
                return isLeft ? -75 : -15;
            })
            .attr('y', -50)
            .attr('width', 70)
            .attr('height', 70)
            .attr('href', d => `./images/players/cropped/${d.data.player_name.toLowerCase().replace(/\s+/g, '-')}_cropped.png`)
            .style('clip-path', 'circle(35px)')
            .on('error', function(event, d) {
                // If photo doesn't exist, show colored circle with initials
                const card = d3.select(this.parentNode);
                const initials = d.data.player_name.split(' ').map(n => n[0]).join('');
                const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;

                // Hide the broken image completely and immediately
                d3.select(this)
                    .style('display', 'none')
                    .attr('width', 0)
                    .attr('height', 0);

                // Make sure the background circle is visible and properly colored
                card.select('.player-photo')
                    .attr('fill', this.playerColors.get(d.data.player_name) || '#ddd')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', 3)
                    .style('display', 'block')
                    .style('opacity', 1);

                // Add initials text centered in the enlarged circle
                if (card.select('.player-initials').empty()) {
                    card.append('text')
                        .attr('class', 'player-initials')
                        .attr('x', isLeft ? -40 : -40) // Center of enlarged 70px photo
                        .attr('y', -10) // Vertically centered
                        .attr('text-anchor', 'middle')
                        .attr('fill', 'white')
                        .attr('font-size', '20px') // Even larger font for better visibility
                        .attr('font-weight', 'bold')
                        .style('pointer-events', 'none')
                        .text(initials);
                }
            }.bind(this));

        // Add nationality flag images
        const flags = cardsUpdate.selectAll('.player-flag')
            .data(d => [d]);

        flags.enter()
            .append('image')
            .attr('class', 'player-flag')
            .merge(flags)
            .attr('x', function(d) {
                const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;
                return isLeft ? -75 : -35;
            })
            .attr('y', 0)
            .attr('width', 24)
            .attr('height', 16)
            .attr('href', function(d) {
                const countryCode = this.playerNationalities?.get(d.data.player_name);
                const flagPath = countryCode ? `./images/flags/${countryCode.toLowerCase()}.png` : './images/flags/unknown.png';
                console.log(`Flag for ${d.data.player_name}: ${countryCode} -> ${flagPath}`);
                return flagPath;
            }.bind(this))
            .on('error', function(event, d) {
                console.log(`Flag image failed to load: ${this.href.baseVal}`);
                // Try multiple alternative paths
                const filename = this.href.baseVal.split('/').pop();
                const currentAttempt = this.dataset.attempt || '0';
                const attempts = [
                    `../images/flags/${filename}`,
                    `../../images/flags/${filename}`,
                    `./flags/${filename}`,
                    `../flags/${filename}`
                ];
                
                const attemptNum = parseInt(currentAttempt);
                if (attemptNum < attempts.length) {
                    const nextPath = attempts[attemptNum];
                    console.log(`Trying alternative path ${attemptNum + 1}: ${nextPath}`);
                    d3.select(this)
                        .attr('href', nextPath)
                        .attr('data-attempt', attemptNum + 1);
                } else {
                    console.log(`All flag paths failed for ${filename}, hiding flag`);
                    d3.select(this).style('display', 'none');
                }
            });

        // Add player name
        const names = cardsUpdate.selectAll('.player-name')
            .data(d => [d]);

        names.enter()
            .append('text')
            .attr('class', 'player-name')
            .merge(names)
            .attr('x', function(d) {
                const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;
                return isLeft ? 5 : -5;
            })
            .attr('y', -20)
            .attr('text-anchor', function(d) {
                return (d.endAngle + d.startAngle)/2 < Math.PI ? 'start' : 'end';
            })
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .attr('fill', '#333')
            .text(d => d.data.player_name);

        // Add titles and win rate
        const stats = cardsUpdate.selectAll('.player-stats')
            .data(d => [d]);

        stats.enter()
            .append('text')
            .attr('class', 'player-stats')
            .merge(stats)
            .attr('x', function(d) {
                const isLeft = (d.endAngle + d.startAngle)/2 < Math.PI;
                return isLeft ? 5 : -5;
            })
            .attr('y', -5)
            .attr('text-anchor', function(d) {
                return (d.endAngle + d.startAngle)/2 < Math.PI ? 'start' : 'end';
            })
            .attr('font-size', '11px')
            .attr('fill', '#888')
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