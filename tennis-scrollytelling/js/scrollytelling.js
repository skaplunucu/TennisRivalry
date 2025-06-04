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

        // Continue setup after data is loaded
        this.createScrollSections();
        this.createTimeline();
        this.renderTables();
        this.updateTimeline(); // Initialize timeline highlighting for first date
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
        svg.selectAll('*').remove(); // Clear previous chart

        if (topPerformers.length === 0) {
            svg.append('text')
                .attr('x', 225)
                .attr('y', 200)
                .attr('text-anchor', 'middle')
                .attr('fill', '#666')
                .style('font-size', '16px')
                .text('No momentum detected');
            return;
        }

        const width = 450;
        const height = 400;
        const radius = Math.min(width, height) / 2 - 80; // More margin for external labels
        const innerRadius = radius * 0.5; // Hollow center

        const g = svg.append('g')
            .attr('transform', `translate(${width/2}, ${height/2})`);

        // Prepare data - limit to top 8 players, group others as "Others"
        let chartData = [...topPerformers];
        if (chartData.length > 8) {
            const top7 = chartData.slice(0, 7);
            const others = chartData.slice(7);
            const othersTotal = others.reduce((sum, p) => sum + p.period_titles, 0);
            if (othersTotal > 0) {
                chartData = [
                    ...top7,
                    {
                        player_name: `Others`,
                        period_titles: othersTotal
                    }
                ];
            } else {
                chartData = top7;
            }
        }

        // Color scale with more distinct colors
        const colors = d3.scaleOrdinal()
            .domain(chartData.map(d => d.player_name))
            .range([
                '#FF6B35', '#F7931E', '#FFD23F', '#06D6A0', 
                '#118AB2', '#073B4C', '#9D4EDD', '#F72585'
            ]);

        // Create pie layout
        const pie = d3.pie()
            .value(d => d.momentum_score)
            .sort(null)
            .padAngle(0.02); // Small gap between slices

        // Arc generators
        const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(radius);

        const outerArc = d3.arc()
            .innerRadius(radius * 1.2)
            .outerRadius(radius * 1.2);

        // Draw pie slices
        const arcs = g.selectAll('.pie-slice')
            .data(pie(chartData))
            .enter().append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('class', 'pie-slice')
            .attr('d', arc)
            .attr('fill', d => colors(d.data.player_name))
            .on('mouseover', function(event, d) {
                // Show tooltip
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
                    .html(`${d.data.player_name}<br/>Momentum: ${d.data.momentum_score}<br/>Titles: ${d.data.titles_count || 0} | Win Rate: ${(d.data.win_rate * 100).toFixed(1)}%`);
            })
            .on('mouseout', function() {
                d3.selectAll('.pie-tooltip').remove();
            });

        // Add external labels with connecting lines
        const text = g.selectAll('.pie-external-label')
            .data(pie(chartData))
            .enter().append('text')
            .attr('class', 'pie-external-label')
            .attr('dy', '.35em')
            .style('text-anchor', function(d) {
                // if slice is on the left side of chart, text should be right-aligned
                return (d.endAngle + d.startAngle)/2 < Math.PI ? 'start' : 'end';
            })
            .attr('transform', function(d) {
                const pos = outerArc.centroid(d);
                pos[0] = radius * 1.3 * ((d.endAngle + d.startAngle)/2 < Math.PI ? 1 : -1);
                return `translate(${pos})`;
            })
            .text(function(d) {
                return `${d.data.player_name} (${d.data.momentum_score.toFixed(1)})`;
            });

        // Add connecting lines
        const polyline = g.selectAll('.pie-label-line')
            .data(pie(chartData))
            .enter().append('polyline')
            .attr('class', 'pie-label-line')
            .attr('points', function(d) {
                const pos = outerArc.centroid(d);
                pos[0] = radius * 1.3 * ((d.endAngle + d.startAngle)/2 < Math.PI ? 1 : -1);
                return [arc.centroid(d), outerArc.centroid(d), pos].join(' ');
            });

        // Add center momentum score
        const totalMomentum = d3.sum(chartData, d => d.momentum_score);
        g.append('text')
            .attr('class', 'pie-title-count')
            .attr('y', -10)
            .text(totalMomentum.toFixed(1));

        g.append('text')
            .attr('class', 'pie-external-label')
            .attr('y', 15)
            .style('font-size', '14px')
            .style('fill', '#666')
            .text('momentum');
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