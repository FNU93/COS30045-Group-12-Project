// Toggle Drawer Navigation
document.getElementById('drawer-button').addEventListener('click', function () {
    const drawer = document.getElementById('drawer');
    if (drawer.style.right === '0px') {
        drawer.style.right = `-${drawer.offsetWidth}px`;
    } else {
        drawer.style.right = '0px';
    }
});

document.addEventListener('click', function (event) {
    const drawer = document.getElementById('drawer');
    const drawerButton = document.getElementById('drawer-button');
    if (!drawer.contains(event.target) && !drawerButton.contains(event.target)) {
        if (drawer.style.right === '0px') {
            drawer.style.right = `-${drawer.offsetWidth}px`;
        }
    }
});



const datasets = [
    { id: "climate_awareness", file: "./assets/data/climate_awareness.csv" },
    { id: "climate_happening", file: "./assets/data/climate_happening.csv" },
    { id: "climate_beliefs", file: "./assets/data/climate_beliefs.csv" },
    { id: "climate_worry", file: "./assets/data/climate_worry.csv" },
    { id: "harm_future_gen", file: "./assets/data/harm_future_gen.csv" },
    { id: "gov_priority", file: "./assets/data/gov_priority.csv" },
];

datasets.forEach(dataset => {
    d3.csv(dataset.file).then(data => renderChart(dataset.id, data));
});

function renderChart(id, data) {
    const chartContainer = d3.select(`#${id} .chart-container`);
    const responses = data.columns.slice(1); // Exclude 'Country'
    const countries = data.map(d => d.Country);

    // Update the response filter options
    const responseFilter = d3.select(`#${id} .controls select[id^="response-filter"]`);
    responses.forEach(r => responseFilter.append("option").text(r).attr("value", r));

    const sortOrder = d3.select(`#${id} .controls select[id^="sort-order"]`);

    // Zoom and Pan Controls
    const zoomSlider = d3.select(`#zoom-slider-${id}`);
    const panSlider = d3.select(`#pan-slider-${id}`);

    const svgWidth = chartContainer.node().clientWidth;
    const svgHeight = 600; // Increased height
    const margin = { top: 40, right: 200, bottom: 80, left: 200 }; // Adjusted margins
    const chartWidth = svgWidth - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    const svg = chartContainer
        .append("svg")
        .attr("width", "100%")
        .attr("height", svgHeight)
        .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const chartGroup = svg
        .append("g")
        .attr("class", "chart-group")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    let xScale = d3.scaleLinear().range([0, chartWidth]).domain([0, 100]);
    let yScale = d3
        .scaleBand()
        .domain(countries)
        .range([0, chartHeight])
        .padding(0.1);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(responses);

    const tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);

    // Variables to keep track of current zoom and pan
    let currentZoom = 1;
    let currentPan = 0;

    function updateChart(filteredResponse = "All", sortOrderValue = "default") {
        let filteredData = data.map(d => ({ ...d })); // Deep copy

        // Filter
        if (filteredResponse !== "All") {
            filteredData.forEach(d => {
                responses.forEach(r => {
                    if (r !== filteredResponse) d[r] = 0;
                });
            });
        }

        // Sort
        if (sortOrderValue === "ascending") {
            filteredData.sort((a, b) => {
                const aSum = d3.sum(responses, r => +a[r]);
                const bSum = d3.sum(responses, r => +b[r]);
                return aSum - bSum;
            });
        } else if (sortOrderValue === "descending") {
            filteredData.sort((a, b) => {
                const aSum = d3.sum(responses, r => +a[r]);
                const bSum = d3.sum(responses, r => +b[r]);
                return bSum - aSum;
            });
        }

        yScale.domain(filteredData.map(d => d.Country));

        // Data Stacking
        const stackGen = d3.stack().keys(responses);
        const stackedData = stackGen(filteredData);

        // Bars
        const groups = chartGroup.selectAll(".bar-group")
            .data(stackedData)
            .join("g")
            .attr("class", "bar-group")
            .attr("fill", d => colorScale(d.key));

        const bars = groups.selectAll("rect")
            .data(d => d.map(e => ({ ...e, key: d.key })))
            .join("rect")
            .attr("y", d => yScale(d.data.Country))
            .attr("x", d => xScale(d[0]))
            .attr("width", d => xScale(d[1]) - xScale(d[0]))
            .attr("height", yScale.bandwidth())
            .on("mouseover", (event, d) => {
                tooltip.transition().duration(200).style("opacity", 1);
                tooltip
                    .html(
                        `<strong>Country:</strong> ${d.data.Country}<br>
                        <strong>Response:</strong> ${d.key}<br>
                        <strong>Percentage:</strong> ${(+d.data[d.key]).toFixed(1)}%`
                    )
                    .style("left", `${event.pageX + 10}px`)
                    .style("top", `${event.pageY - 20}px`);
            })
            .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));

        // Remove x-axis
        chartGroup.select(".x-axis").remove();

        // Y-axis
        chartGroup.select(".y-axis").remove();
        const yAxis = d3.axisLeft(yScale).tickSize(0);
        chartGroup.append("g").attr("class", "y-axis").call(yAxis)
            .selectAll("text")
            .style("font-size", "12px");

        // Legend
        svg.selectAll(".legend").remove();
        const legend = svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${svgWidth - margin.right + 20}, ${margin.top})`);

        const legendItems = legend.selectAll(".legend-item")
            .data(responses)
            .enter()
            .append("g")
            .attr("class", "legend-item")
            .attr("transform", (d, i) => `translate(0, ${i * 20})`);

        legendItems.append("rect")
            .attr("class", "legend-color")
            .attr("width", 15)
            .attr("height", 15)
            .attr("fill", d => colorScale(d));

        legendItems.append("text")
            .attr("x", 20)
            .attr("y", 12)
            .text(d => d)
            .attr("font-size", "12px");

        // Smooth transitions
        groups.transition().duration(750).attr("fill", d => colorScale(d.key));
        bars.transition().duration(750)
            .attr("y", d => yScale(d.data.Country))
            .attr("x", d => xScale(d[0]))
            .attr("width", d => xScale(d[1]) - xScale(d[0]))
            .attr("height", yScale.bandwidth());
    }

    // Event Listeners
    responseFilter.on("change", () => {
        updateChart(responseFilter.property("value"), sortOrder.property("value"));
    });

    sortOrder.on("change", () => {
        updateChart(responseFilter.property("value"), sortOrder.property("value"));
    });

    // Zoom and Pan Controls
    zoomSlider.on("input", () => {
        currentZoom = +zoomSlider.property("value");
        applyZoom(currentZoom);
    });

    panSlider.on("input", () => {
        const panLevel = +panSlider.property("value");
        applyPan(panLevel);
    });

    function applyZoom(zoomLevel) {
        const newChartHeight = chartHeight * zoomLevel;
        yScale.range([0, newChartHeight]);

        chartGroup.selectAll(".bar-group").selectAll("rect")
            .attr("y", d => yScale(d.data.Country))
            .attr("height", yScale.bandwidth());

        chartGroup.select(".y-axis").call(d3.axisLeft(yScale).tickSize(0))
            .selectAll("text")
            .style("font-size", "12px");

        // Adjust the pan slider max value based on zoom level
        panSlider.attr("max", Math.max(0, zoomLevel - 1));
        // Reset pan to avoid blank space
        panSlider.property("value", 0);
        currentPan = 0;
        chartGroup.attr("transform", `translate(${margin.left}, ${margin.top})`);
    }

    function applyPan(panLevel) {
        currentPan = panLevel;
        const zoomLevel = +zoomSlider.property("value");
        const maxPan = chartHeight * (zoomLevel - 1);
        const panOffset = -maxPan * panLevel;
        chartGroup.attr("transform", `translate(${margin.left}, ${margin.top + panOffset})`);
    }

    // Drag Behavior
    const dragBehavior = d3.drag()
        .on("drag", (event) => {
            const dy = event.dy;
            const zoomLevel = +zoomSlider.property("value");
            const maxPan = chartHeight * (zoomLevel - 1);
            let panOffset = -maxPan * currentPan + dy;

            // Limit panOffset to allowed range
            panOffset = Math.min(0, Math.max(-maxPan, panOffset));

            // Update currentPan based on panOffset
            currentPan = -panOffset / maxPan;

            // Update the pan slider
            panSlider.property("value", currentPan);

            // Apply the pan
            chartGroup.attr("transform", `translate(${margin.left}, ${margin.top + panOffset})`);
        });

    // Apply drag behavior to the chart group
    svg.call(dragBehavior);

    updateChart();
}

// Add event listeners to 'Next' buttons
document.querySelectorAll('.next-button').forEach((button, index) => {
    button.addEventListener('click', () => {
        const nextSection = document.querySelectorAll('.visualization')[index + 1];
        if (nextSection) {
            nextSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
});
