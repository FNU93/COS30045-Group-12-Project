const COS30045_width = 960, COS30045_height = 600;

const COS30045_svg = d3.select("#COS30045-map-container")
    .append("svg")
    .attr("width", COS30045_width)
    .attr("height", COS30045_height);

const COS30045_projection = d3.geoNaturalEarth1()
    .scale(160)
    .translate([COS30045_width / 2, COS30045_height / 2]);

const COS30045_path = d3.geoPath().projection(COS30045_projection);

const COS30045_colorScale = d3.scaleSequential(d3.interpolateRdBu).domain([2, -2]);

const COS30045_tooltip = d3.select("body").append("div")
    .attr("class", "COS30045-tooltip")
    .style("opacity", 0);

let COS30045_temperatureData;
let playInterval = null;

// Load map and temperature data
Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv("./assets/data/heatmap_data.csv", d => {
        d.Year = +d.Year;
        d.TemperatureChange = +d.TemperatureChange;
        return d;
    })
]).then(([world, data]) => {
    COS30045_temperatureData = data;

    // Draw map
    COS30045_svg.selectAll("path")
        .data(world.features)
        .join("path")
        .attr("d", COS30045_path)
        .attr("fill", d => {
            const temp = COS30045_getTemperature(d.properties.name, 1961);
            return temp != null && !isNaN(temp) ? COS30045_colorScale(temp) : "#ccc";
        })
        .attr("stroke", "#333")
        .on("mouseover", (event, d) => {
            const temp = COS30045_getTemperature(d.properties.name, +d3.select("#COS30045-slider").node().value);
            COS30045_tooltip.transition().duration(200).style("opacity", 1);
            COS30045_tooltip.html(`
                <strong>Country:</strong> ${d.properties.name}<br>
                <strong>Temp Change:</strong> ${temp != null && !isNaN(temp) ? temp.toFixed(3) + "°C" : "N/A"}
            `)
                .style("left", `${event.pageX + 15}px`)
                .style("top", `${event.pageY - 30}px`);
        })
        .on("mousemove", event => {
            COS30045_tooltip.style("left", `${event.pageX + 15}px`)
                .style("top", `${event.pageY - 30}px`);
        })
        .on("mouseout", () => {
            COS30045_tooltip.transition().duration(200).style("opacity", 0);
        });

    // Update map when slider changes
    d3.select("#COS30045-slider").on("input", function () {
        const year = +this.value;
        d3.select("#COS30045-year-label").text(year);
        COS30045_updateMap(year);
    });

    // Play button functionality
    d3.select("#COS30045-play-button").on("click", () => {
        if (playInterval) {
            clearInterval(playInterval);
            playInterval = null;
            d3.select("#COS30045-play-button").text("Play");
        } else {
            const slider = d3.select("#COS30045-slider").node();
            playInterval = setInterval(() => {
                let year = +slider.value;
                year = year < 2023 ? year + 1 : 1961; // Loop back to start
                slider.value = year;
                d3.select("#COS30045-year-label").text(year);
                COS30045_updateMap(year);
            }, 1000);
            d3.select("#COS30045-play-button").text("Pause");
        }
    });

    function COS30045_updateMap(year) {
        COS30045_svg.selectAll("path")
            .attr("fill", d => {
                const temp = COS30045_getTemperature(d.properties.name, year);
                return temp != null && !isNaN(temp) ? COS30045_colorScale(temp) : "#ccc";
            });
    }
});

// Helper function to get temperature by country and year
function COS30045_getTemperature(country, year) {
    const record = COS30045_temperatureData.find(d => d.Country === country && d.Year === year);
    return record ? record.TemperatureChange : null;
}
