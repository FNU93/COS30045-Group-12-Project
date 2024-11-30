d3.csv("./assets/data/ghg.csv").then(data => {
    const svgWidth = 1000;
    const svgHeight = 600;

    // Set up SVG container for the map
    const svg = d3.select("#map-svg")
        .append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight);

    const projection = d3.geoMercator()
        .scale(150)
        .translate([svgWidth / 2, svgHeight / 1.5]);

    const path = d3.geoPath().projection(projection);

    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    const g = svg.append("g");

    // Zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Zoom buttons
    d3.select("#zoom-in").on("click", () => {
        svg.transition().call(zoom.scaleBy, 1.5);
    });

    d3.select("#zoom-out").on("click", () => {
        svg.transition().call(zoom.scaleBy, 0.75);
    });

    const years = [...new Set(data.map(d => +d.Year))].sort();
    const pollutants = [...new Set(data.map(d => d.Pollutant))];
    const countries = [...new Set(data.map(d => d.Country))];

    const yearSlider = d3.select("#year-slider")
        .attr("min", Math.min(...years))
        .attr("max", Math.max(...years))
        .attr("value", Math.max(...years));

    const yearLabel = d3.select("#year-label").text(Math.max(...years));

    const pollutantFilter = d3.select("#pollutant-filter");
    pollutants.forEach(p => pollutantFilter.append("option").text(p).attr("value", p));

    const countryFilter = d3.select("#country-filter");
    countries.forEach(c => countryFilter.append("option").text(c).attr("value", c));

    d3.json("./assets/data/worldGeo.json").then(geoData => {
        function updateVisualization() {
            const selectedYear = +yearSlider.property("value");
            const selectedPollutant = pollutantFilter.property("value") || pollutants[0];
            const selectedCountry = countryFilter.property("value");

            yearLabel.text(selectedYear);

            const filteredData = data.filter(d =>
                (!selectedCountry || d.Country === selectedCountry) &&
                d.Pollutant === selectedPollutant &&
                +d.Year === selectedYear
            );

            const dataMap = {};
            filteredData.forEach(d => {
                dataMap[d.Country] = +d.Value;
            });

            // Define color scale
            const maxValue = d3.max(Object.values(dataMap)) || 0;
            const colorScale = d3.scaleSequential(d3.interpolateReds)
                .domain([0, maxValue]);

            // Draw the map
            g.selectAll("path")
                .data(geoData.features)
                .join("path")
                .attr("d", path)
                .attr("fill", d => {
                    const value = dataMap[d.properties.name];
                    return value ? colorScale(value) : "#ccc";
                })
                .attr("stroke", "#333")
                .attr("stroke-width", 0.5)
                .on("mouseover", (event, d) => {
                    const value = dataMap[d.properties.name];
                    tooltip.style("opacity", 1)
                        .html(`<strong>Country:</strong> ${d.properties.name}<br>
                               <strong>Emissions:</strong> ${value ? value.toLocaleString() : "N/A"} Tonnes CO₂e`)
                        .style("left", (event.pageX + 10) + "px")
                        .style("top", (event.pageY - 28) + "px");
                })
                .on("mouseout", () => {
                    tooltip.style("opacity", 0);
                })
                .on("click", (event, d) => {
                    if (d.properties.name) {
                        countryFilter.property("value", d.properties.name);
                        updateVisualization();
                    }
                });

            // Update color legend
            updateLegend(colorScale);

            // Display or hide the side window based on country and pollutant selection
            if (selectedCountry && selectedPollutant && selectedPollutant !== 'Greenhouse gases') {
                displayLineChart(selectedCountry, selectedPollutant);
                d3.select("#side-window").classed("open", true);
            } else {
                d3.select("#side-window").classed("open", false);
            }

            // Zoom into the selected country if any
            if (selectedCountry) {
                const countryFeature = geoData.features.find(f => f.properties.name === selectedCountry);
                if (countryFeature) zoomToFeature(countryFeature);
            } else {
                resetZoom();
            }
        }

        function zoomToFeature(feature) {
            const [[x0, y0], [x1, y1]] = path.bounds(feature);
            const dx = x1 - x0;
            const dy = y1 - y0;
            const x = (x0 + x1) / 2;
            const y = (y0 + y1) / 2;
            const scale = Math.max(1, Math.min(8, 0.9 / Math.max(dx / svgWidth, dy / svgHeight)));
            const translate = [svgWidth / 2 - scale * x, svgHeight / 2 - scale * y];

            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
        }

        function resetZoom() {
            svg.transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        }

        function displayLineChart(country, pollutant) {
            const countryData = data.filter(d => d.Country === country && d.Pollutant === pollutant);

            if (countryData.length === 0) {
                // Handle case where there is no data
                d3.select("#chart-svg").selectAll("*").remove();
                d3.select("#chart-svg").append("text")
                    .attr("x", 10)
                    .attr("y", 20)
                    .text("No data available for the selected country and pollutant.");
                return;
            }

            const chartSvg = d3.select("#chart-svg");
            const margin = { top: 20, right: 20, bottom: 50, left: 60 };
            const width = 350 - margin.left - margin.right;
            const height = 300 - margin.top - margin.bottom;

            chartSvg.attr("width", 350).attr("height", 300);

            chartSvg.selectAll("*").remove();

            const g = chartSvg.append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            const xScale = d3.scaleLinear()
                .domain(d3.extent(countryData, d => +d.Year))
                .range([0, width]);

            const yScale = d3.scaleLinear()
                .domain([0, d3.max(countryData, d => +d.Value)])
                .nice()
                .range([height, 0]);

            const xAxis = g.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

            const yAxis = g.append("g")
                .call(d3.axisLeft(yScale));

            // Line generator
            const line = d3.line()
                .x(d => xScale(+d.Year))
                .y(d => yScale(+d.Value));

            // Add line path
            const path = g.append("path")
                .datum(countryData)
                .attr("fill", "none")
                .attr("stroke", "#007BFF")
                .attr("stroke-width", 2)
                .attr("d", line);

            // Animation for line drawing
            const totalLength = path.node().getTotalLength();

            path.attr("stroke-dasharray", `${totalLength} ${totalLength}`)
                .attr("stroke-dashoffset", totalLength)
                .transition()
                .duration(2000)
                .ease(d3.easeLinear)
                .attr("stroke-dashoffset", 0);

            // Add data points
            const points = g.selectAll("circle")
                .data(countryData)
                .enter()
                .append("circle")
                .attr("cx", d => xScale(+d.Year))
                .attr("cy", d => yScale(+d.Value))
                .attr("r", 4)
                .attr("fill", "#007BFF")
                .on("mouseover", (event, d) => {
                    tooltip.style("opacity", 1)
                        .html(`<strong>Year:</strong> ${d.Year}<br>
                               <strong>Emissions:</strong> ${d.Value} Tonnes CO₂e`)
                        .style("left", `${event.pageX + 15}px`)
                        .style("top", `${event.pageY - 50}px`);
                })
                .on("mouseout", () => {
                    tooltip.style("opacity", 0);
                });

            // Zoom and Pan
            const zoomChart = d3.zoom()
                .scaleExtent([1, 5])
                .translateExtent([[0, 0], [width, height]])
                .extent([[0, 0], [width, height]])
                .on("zoom", (event) => {
                    const newXScale = event.transform.rescaleX(xScale);
                    const newYScale = event.transform.rescaleY(yScale);
                    xAxis.call(d3.axisBottom(newXScale).tickFormat(d3.format("d")));
                    yAxis.call(d3.axisLeft(newYScale));
                    path.attr("d", line.x(d => newXScale(+d.Year)).y(d => newYScale(+d.Value)));
                    points.attr("cx", d => newXScale(+d.Year))
                        .attr("cy", d => newYScale(+d.Value));
                });

            chartSvg.call(zoomChart);
        }

        function updateLegend(colorScale) {
            const legendContainer = d3.select("#legend-container");
            legendContainer.selectAll("*").remove();

            const legendWidth = 160;
            const legendHeight = 10;

            // Title
            legendContainer.append("div")
                .attr("class", "legend-title")
                .text("Emissions (Tonnes CO₂e)");

            // Canvas for color scale
            const canvas = legendContainer.append("canvas")
                .attr("class", "legend-scale")
                .attr("width", legendWidth)
                .attr("height", legendHeight);

            const ctx = canvas.node().getContext("2d");

            const legendScale = d3.scaleLinear()
                .domain(colorScale.domain())
                .range([0, legendWidth]);

            const image = ctx.createImageData(legendWidth, 1);

            for (let i = 0; i < legendWidth; ++i) {
                const color = d3.rgb(colorScale(legendScale.invert(i)));
                image.data[i * 4] = color.r;
                image.data[i * 4 + 1] = color.g;
                image.data[i * 4 + 2] = color.b;
                image.data[i * 4 + 3] = 255;
            }

            ctx.putImageData(image, 0, 0);

            // Labels
            const legendAxisScale = d3.scaleLinear()
                .domain(colorScale.domain())
                .range([0, legendWidth]);

            const legendAxis = d3.axisBottom(legendAxisScale)
                .ticks(5)
                .tickFormat(d3.format(".2s"))
                .tickSize(0);

            const svg = legendContainer.append("svg")
                .attr("width", legendWidth)
                .attr("height", 20);

            svg.append("g")
                .attr("transform", `translate(0,0)`)
                .call(legendAxis)
                .select(".domain").remove();

            // Units
            legendContainer.append("div")
                .attr("class", "legend-unit")
                .text("Tonnes of CO₂ Equivalent");
        }

        updateVisualization();

        yearSlider.on("input", updateVisualization);
        pollutantFilter.on("change", updateVisualization);
        countryFilter.on("change", updateVisualization);
    });
});
