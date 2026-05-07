var map, geojson;
var selected, features, layer_name, layerControl;
var content;
var popup = L.popup();
var heatLayer = null;



map = L.map('map', {
   
    crs: L.CRS.EPSG4326,
    center: [24.85, 67.05],
    zoom: 12,
    zoomControl: false
    //layers: [grayscale, cities]
});

var satellite = L.tileLayer('https://wi.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
   // maxZoom: 23,
	    attribution: 'Source: Esri, Maxar, Earthstar Geographics, CNES/Airbus DS, USDA FSA, USGS, Getmapping, Aerogrid, IGN, IGP, and the GIS User Community'
    }).addTo(map);
	
	var hillshade = L.tileLayer('https://whi.maptiles.arcgis.com/arcgis/rest/services/World_Hillshade/MapServer/tile/{z}/{y}/{x}', {
	//maxZoom: 19,
	attribution: 'Sources: Esri, Airbus DS, USGS, NGA, NASA, CGIAR, N Robinson, NCEAS, NLS, OS, NMA, Geodatastyrelsen, Rijkswaterstaat, GSA, Geoland, FEMA, Intermap, and the GIS user community',
});

/*var satellite = L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 23,
	
    attributions: ['Powered by Esri',
        'Source: Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
    ],
    id: 'mapbox/light-v9',
    //tileSize: 256,
    //zoomOffset: -1
}).addTo(map);*/
/*var OSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	
	attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);*/


/*var india_state = L.tileLayer.wms('http://localhost:8084/geoserver/india/wms?',{
layers: 'india:india_state',
 transparent: 'true',
    format: 'image/png'
}).addTo(map);
var india_district = L.tileLayer.wms('http://localhost:8084/geoserver/india/wms?',{
layers: 'india:india_district',
 transparent: 'true',
    format: 'image/png'
}).addTo(map);*/


var overlays = L.layerGroup();
//overlays.addLayer(india_state,'india_state');
//overlays.addLayer(india_district,'india_district');
var base = L.layerGroup();
base.addLayer(hillshade, 'hillshade');
base.addLayer(satellite, 'satellite');

layerControl = L.control.layers().addTo(map);

layerControl.addBaseLayer(hillshade, "hillshade");
layerControl.addBaseLayer(satellite, "satellite");

//layerControl.addOverlay(india_state,"india_state");
//layerControl.addOverlay(india_district,"india_district");


//layerControl.add(base);
//L.control.layers().addTo(map);
/*layerControl = L.control.layers().addTo(map);

//L.control.layers.addOverlay(india_state,"test").addTo(map);
layerControl.addBaseLayer(satellite,"satellite");
layerControl.addBaseLayer(OSM,"OSM");

layerControl.addOverlay(india_state,"india_state");
layerControl.addOverlay(india_district,"india_district");
*/

// Load GeoJSON files
var geojsonLayers = {};
var geojsonLoadCount = 0;
var geojsonTotalCount = 0;

function populateLayerDropdown() {
    var select = $('#layer');
    select.empty();
    select.append("<option selected>Select Layer</option>");
    for (var layerName in geojsonLayers) {
        select.append("<option class='ddindent' value='" + layerName + "'>" + layerName + "</option>");
    }
}

function populateBoundaryDropdown() {
    var select = $('#boundary_layer');
    select.empty();
    select.append("<option selected>Select Boundary Layer</option>");
    for (var layerName in geojsonLayers) {
        select.append("<option class='ddindent' value='" + layerName + "'>" + layerName + "</option>");
    }
}

function convertEsriGeometry(geometry, geometryType) {
    if (!geometry) {
        return null;
    }

    function convertPair(pair) {
        return [pair[0], pair[1]];
    }

    if (geometryType === 'esriGeometryPoint' || (geometry.x !== undefined && geometry.y !== undefined)) {
        return {
            type: 'Point',
            coordinates: [geometry.x, geometry.y]
        };
    }

    if (geometryType === 'esriGeometryMultipoint' || geometry.points) {
        return {
            type: 'MultiPoint',
            coordinates: geometry.points.map(convertPair)
        };
    }

    if (geometryType === 'esriGeometryPolyline' || geometry.paths) {
        var paths = geometry.paths || [];
        if (paths.length === 1) {
            return {
                type: 'LineString',
                coordinates: paths[0].map(convertPair)
            };
        }
        return {
            type: 'MultiLineString',
            coordinates: paths.map(function(path) {
                return path.map(convertPair);
            })
        };
    }

    if (geometryType === 'esriGeometryPolygon' || geometry.rings) {
        var rings = geometry.rings || [];
        if (rings.length === 1) {
            return {
                type: 'Polygon',
                coordinates: [rings[0].map(convertPair)]
            };
        }
        return {
            type: 'MultiPolygon',
            coordinates: rings.map(function(ring) {
                return [ring.map(convertPair)];
            })
        };
    }

    if (geometryType === 'esriGeometryEnvelope' || (geometry.xmin !== undefined && geometry.xmax !== undefined)) {
        return {
            type: 'Polygon',
            coordinates: [[
                [geometry.xmin, geometry.ymin],
                [geometry.xmin, geometry.ymax],
                [geometry.xmax, geometry.ymax],
                [geometry.xmax, geometry.ymin],
                [geometry.xmin, geometry.ymin]
            ]]
        };
    }

    return null;
}

function isEsriJson(data) {
    return data && data.features && Array.isArray(data.features) && data.geometryType;
}

function convertEsriJsonToGeoJson(esriData) {
    return {
        type: 'FeatureCollection',
        features: (esriData.features || []).map(function(feature) {
            return {
                type: 'Feature',
                properties: feature.attributes || {},
                geometry: convertEsriGeometry(feature.geometry, esriData.geometryType)
            };
        })
    };
}

var geojsonFiles = [];

function loadGeojsonFiles(files) {
    geojsonFiles = Array.isArray(files) ? files : [];
    if (geojsonFiles.length === 0) {
        geojsonFiles = [
            { name: 'Buildings', file: 'data/buildings.json', color: 'blue' },
            { name: 'Country Boundary', file: 'data/Country_Boundary.json', color: 'green' },
            { name: 'Roads', file: 'data/roads.json', color: 'orange' },
            { name: 'Traffic Points', file: 'data/Trafficpoint.json', color: 'red' }
        ];
    }

    geojsonLoadCount = 0;
    geojsonTotalCount = geojsonFiles.length;
    geojsonLayers = {};

    geojsonFiles.forEach(function(geoFile) {
        $.ajax({
            url: geoFile.file,
            dataType: 'json',
            success: function(data) {
                var geojsonData = data;
                if (!geojsonData || geojsonData.type !== 'FeatureCollection') {
                    if (isEsriJson(data)) {
                        geojsonData = convertEsriJsonToGeoJson(data);
                    }
                }

                geojsonLayers[geoFile.name] = L.geoJson(geojsonData, {
                    style: {
                        color: geoFile.color || 'blue',
                        weight: 2,
                        opacity: 0.7,
                        fillOpacity: 0.3
                    },
                    onEachFeature: function(feature, layer) {
                        if (feature.properties) {
                            var popupContent = '<div>';
                            for (var prop in feature.properties) {
                                popupContent += '<b>' + prop + ':</b> ' + feature.properties[prop] + '<br>';
                            }
                            popupContent += '</div>';
                            layer.bindPopup(popupContent);
                        }
                    }
                }).addTo(map);

                layerControl.addOverlay(geojsonLayers[geoFile.name], geoFile.name);
                geojsonLoadCount++;
                if (geojsonLoadCount === geojsonTotalCount) {
                    populateLayerDropdown();
                    populateBoundaryDropdown();
                }
            },
            error: function() {
                console.log('Error loading ' + geoFile.file);
                geojsonLoadCount++;
                if (geojsonLoadCount === geojsonTotalCount) {
                    populateLayerDropdown();
                    populateBoundaryDropdown();
                }
            }
        });
    });
}

// Load available GeoJSON/EsriJSON files from the local data folder.
// If you want to use a layers.json manifest, restore the getJSON call below.
loadGeojsonFiles([]);

/*
$.getJSON('data/layers.json', function(files) {
    loadGeojsonFiles(files);
}).fail(function() {
    loadGeojsonFiles([]);
});
*/

// Zoom bar
var zoom_bar = new L.Control.ZoomBar({
    position: 'topleft'
}).addTo(map);
//map.addControl(new L.Control.Zoomslider());

// mouse position
L.control.mousePosition({
    position: 'bottomleft',
    prefix: "lat : long",
}).addTo(map);

//scale
L.control.scale({
    position: 'bottomleft'
}).addTo(map);

//geocoder
L.Control.geocoder({
    position: 'topright'
}).addTo(map);

//line mesure
L.control.polylineMeasure({
    position: 'topleft',
    unit: 'kilometres',
    showBearings: true,
    clearMeasurementsOnStop: false,
    showClearControl: true,
    showUnitControl: true
}).addTo(map);
//area measure
var measureControl = new L.Control.Measure({
    position: 'topleft'
	
});
measureControl.addTo(map);

//search
map.addControl(L.control.search({
    position: 'topleft'
}));


//legend
function legend() {

    $('#legend').empty();
    var layers = overlays.getLayers();
    //console.log(no_layers[0].options.layers);
    //console.log(no_layers);
    //var no_layers = overlays.getLayers().get('length');

    var head = document.createElement("h8");

    var txt = document.createTextNode("Legend");

    head.appendChild(txt);
    var element = document.getElementById("legend");
    element.appendChild(head);
	overlays.eachLayer(function (layer) {
	
	var head = document.createElement("p");

        var txt = document.createTextNode(layer.options.layers);
        //alert(txt[i]);
        head.appendChild(txt);
        var element = document.getElementById("legend");
        element.appendChild(head);
	 var img = new Image();
	  img.src = "http://localhost:8084/geoserver/wms?REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=20&HEIGHT=20&LAYER=" +layer.options.layers;
	  var src = document.getElementById("legend");
        src.appendChild(img);
    
});
	
   
}

legend();


// layer dropdown query - Load GeoJSON layer names (called after GeoJSON files are loaded)
// This is populated by populateLayerDropdown() function after all files load


// attribute dropdown - Get from GeoJSON data
$(function() {
    $("#layer").change(function() {
        var attributes = document.getElementById("attributes");
        var length = attributes.options.length;
        for (i = length - 1; i >= 0; i--) {
            attributes.options[i] = null;
        }

        var layerName = $(this).val();
        attributes.options[0] = new Option('Select attributes', "");

        if (layerName && geojsonLayers[layerName]) {
            var layer = geojsonLayers[layerName];
            var attributeSet = new Set();
            
            // Get all unique attributes from GeoJSON features
            layer.eachLayer(function(feature) {
                if (feature.feature && feature.feature.properties) {
                    for (var prop in feature.feature.properties) {
                        attributeSet.add(prop);
                    }
                }
            });

            // Add attributes to dropdown
            var i = 1;
            attributeSet.forEach(function(attr) {
                attributes.options[i] = new Option(attr, attr);
                i++;
            });
        }
    });
});

function updateQueryMode() {
    var mode = $('#query_mode').val();
    $('#attribute_inputs').toggle(mode === 'attribute');
    $('#expression_block').toggle(mode === 'expression');
    $('#spatial_block').toggle(mode === 'spatial');
}

$(function() {
    $('#query_mode').change(updateQueryMode);
    updateQueryMode();
});

// operator combo - Determine based on attribute type
$(function() {
    $("#attributes").change(function() {
        var operator = document.getElementById("operator");
        var length = operator.options.length;
        for (i = length - 1; i >= 0; i--) {
            operator.options[i] = null;
        }

        var layerName = document.getElementById("layer").value;
        var attributeName = $(this).val();
        operator.options[0] = new Option('Select operator', "");

        // Get sample value to determine type
        var sampleValue = null;
        if (layerName && geojsonLayers[layerName]) {
            var layer = geojsonLayers[layerName];
            layer.eachLayer(function(feature) {
                if (!sampleValue && feature.feature && feature.feature.properties && feature.feature.properties.hasOwnProperty(attributeName)) {
                    sampleValue = feature.feature.properties[attributeName];
                }
            });
        }

        var isNumberType = isNumeric(sampleValue);
        if (isNumberType) {
            operator.options[1] = new Option('Greater than', '>');
            operator.options[2] = new Option('Less than', '<');
            operator.options[3] = new Option('Greater or equal', '>=');
            operator.options[4] = new Option('Less or equal', '<=');
            operator.options[5] = new Option('Equal to', '=');
            operator.options[6] = new Option('Not equal', '!=');
            operator.options[7] = new Option('Between', 'BETWEEN');
            operator.options[8] = new Option('In', 'IN');
            operator.options[9] = new Option('Not In', 'NOT IN');
            operator.options[10] = new Option('Is Null', 'IS NULL');
            operator.options[11] = new Option('Is Not Null', 'IS NOT NULL');
        } else {
            operator.options[1] = new Option('Contains', 'CONTAINS');
            operator.options[2] = new Option('Equals', '=');
            operator.options[3] = new Option('Not equal', '!=');
            operator.options[4] = new Option('Starts with', 'STARTSWITH');
            operator.options[5] = new Option('Like', 'LIKE');
            operator.options[6] = new Option('Not Like', 'NOT LIKE');
            operator.options[7] = new Option('In', 'IN');
            operator.options[8] = new Option('Not In', 'NOT IN');
            operator.options[9] = new Option('Is Null', 'IS NULL');
            operator.options[10] = new Option('Is Not Null', 'IS NOT NULL');
        }
    });
});

function isNumeric(value) {
    return value !== null && value !== undefined && value !== '' && !isNaN(parseFloat(value)) && isFinite(value);
}

function normalizeString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).toLowerCase();
}

function parseValue(rawValue) {
    if (rawValue === null || rawValue === undefined) {
        return '';
    }
    var value = String(rawValue).trim();
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        value = value.substring(1, value.length - 1);
    }
    return value;
}

function parseListValues(rawValue) {
    var values = parseValue(rawValue);
    if (values.startsWith('(') && values.endsWith(')')) {
        values = values.substring(1, values.length - 1);
    }
    return values.split(',').map(function(item) {
        return parseValue(item);
    }).filter(function(item) {
        return item !== '';
    });
}

function compareValues(propValue, operator, compareVal) {
    if (propValue === null || propValue === undefined) {
        return false;
    }

    var left = propValue;
    var right = compareVal;
    var leftNum = parseFloat(left);
    var rightNum = parseFloat(right);
    var bothNumeric = isNumeric(left) && isNumeric(right);

    if (bothNumeric) {
        left = leftNum;
        right = rightNum;
    } else {
        left = normalizeString(left);
        right = normalizeString(right);
    }

    switch (operator) {
        case '>':
            return left > right;
        case '<':
            return left < right;
        case '>=':
            return left >= right;
        case '<=':
            return left <= right;
        case '=':
            return left === right;
        case '!=':
            return left !== right;
        default:
            return false;
    }
}

function evaluateExpressionCondition(condition, props) {
    if (!condition || !props) {
        return false;
    }

    var operatorMatch = condition.match(/\b(IS NOT NULL|IS NULL|NOT IN|NOT LIKE|>=|<=|!=|=|>|<|IN|LIKE)\b/i);
    if (!operatorMatch) {
        return false;
    }

    var operator = operatorMatch[1].toUpperCase();
    var parts = condition.split(new RegExp('\\b' + operator.replace(/\s+/g, '\\s+') + '\\b', 'i'));
    var field = parts[0].trim();
    var rawValue = (parts[1] || '').trim();
    var propValue = props[field];

    if (operator === 'IS NULL') {
        return propValue === null || propValue === undefined || propValue === '';
    }
    if (operator === 'IS NOT NULL') {
        return !(propValue === null || propValue === undefined || propValue === '');
    }
    if (operator === 'IN' || operator === 'NOT IN') {
        var values = parseListValues(rawValue);
        var match = values.some(function(v) {
            return compareValues(propValue, '=', v);
        });
        return operator === 'IN' ? match : !match;
    }
    if (operator === 'LIKE') {
        return normalizeString(propValue).includes(normalizeString(parseValue(rawValue)));
    }
    if (operator === 'NOT LIKE') {
        return !normalizeString(propValue).includes(normalizeString(parseValue(rawValue)));
    }

    return compareValues(propValue, operator, parseValue(rawValue));
}

function evaluateExpression(feature, expression) {
    if (!expression || !expression.trim()) {
        return false;
    }

    var tokens = expression.split(/(\bAND\b|\bOR\b)/i).map(function(token) {
        return token.trim();
    }).filter(function(token) {
        return token !== '';
    });

    var result = null;
    var nextOp = null;

    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        if (/^AND$/i.test(token) || /^OR$/i.test(token)) {
            nextOp = token.toUpperCase();
            continue;
        }

        var condResult = evaluateExpressionCondition(token, feature.feature.properties);
        if (result === null) {
            result = condResult;
        } else if (nextOp === 'AND') {
            result = result && condResult;
        } else if (nextOp === 'OR') {
            result = result || condResult;
        }
        nextOp = null;
    }

    return result === null ? false : result;
}

// function for finding row in the table when feature selected on map
function findRowNumber(cn1, v1) {

    var table = document.querySelector('#table');
    var rows = table.querySelectorAll("tr");
    var msg = "No such row exist"
    for (i = 1; i < rows.length; i++) {
        var tableData = rows[i].querySelectorAll("td");
        if (tableData[cn1 - 1].textContent == v1) {
            msg = i;
            break;
        }
    }
    return msg;
}

// function for loading query
function query() {
    $('#table').empty();
    if (geojson) {
        map.removeLayer(geojson);
    }

    var layer = document.getElementById("layer");
    var value_layer = layer.options[layer.selectedIndex].value;
    var queryMode = document.getElementById("query_mode").value;

    if (!value_layer || !geojsonLayers[value_layer]) {
        alert('Please select a valid layer.');
        return;
    }

    var filteredFeatures = [];
    var layerObject = geojsonLayers[value_layer];

    if (queryMode === 'attribute') {
        var attribute = document.getElementById("attributes");
        var value_attribute = attribute.options[attribute.selectedIndex].text;
        var operator = document.getElementById("operator");
        var value_operator = operator.options[operator.selectedIndex].value;
        var value_txt = document.getElementById("value").value;

        if (!value_attribute || !value_operator) {
            alert('Please select Layer, Attribute and Operator.');
            return;
        }
        if ((value_operator !== 'IS NULL' && value_operator !== 'IS NOT NULL') && !value_txt) {
            alert('Please enter a value for the selected operator.');
            return;
        }

        layerObject.eachLayer(function(feature) {
            if (feature.feature && feature.feature.properties) {
                var propValue = feature.feature.properties[value_attribute];
                var matches = false;
                var valueText = value_txt;

                if (value_operator === '>') {
                    matches = compareValues(propValue, '>', valueText);
                } else if (value_operator === '<') {
                    matches = compareValues(propValue, '<', valueText);
                } else if (value_operator === '>=') {
                    matches = compareValues(propValue, '>=', valueText);
                } else if (value_operator === '<=') {
                    matches = compareValues(propValue, '<=', valueText);
                } else if (value_operator === '=') {
                    matches = compareValues(propValue, '=', valueText);
                } else if (value_operator === '!=') {
                    matches = compareValues(propValue, '!=', valueText);
                } else if (value_operator === 'CONTAINS') {
                    matches = normalizeString(propValue).includes(normalizeString(valueText));
                } else if (value_operator === 'STARTSWITH') {
                    matches = normalizeString(propValue).startsWith(normalizeString(valueText));
                } else if (value_operator === 'BETWEEN') {
                    var parts = valueText.split(',');
                    if (parts.length === 2) {
                        matches = compareValues(propValue, '>=', parts[0]) && compareValues(propValue, '<=', parts[1]);
                    }
                } else if (value_operator === 'IN' || value_operator === 'NOT IN') {
                    var listValues = parseListValues(valueText);
                    var listMatch = listValues.some(function(val) {
                        return compareValues(propValue, '=', val);
                    });
                    matches = value_operator === 'IN' ? listMatch : !listMatch;
                } else if (value_operator === 'LIKE') {
                    matches = normalizeString(propValue).includes(normalizeString(valueText));
                } else if (value_operator === 'NOT LIKE') {
                    matches = !normalizeString(propValue).includes(normalizeString(valueText));
                } else if (value_operator === 'IS NULL') {
                    matches = propValue === null || propValue === undefined || propValue === '';
                } else if (value_operator === 'IS NOT NULL') {
                    matches = !(propValue === null || propValue === undefined || propValue === '');
                }

                if (matches) {
                    filteredFeatures.push(feature.feature);
                }
            }
        });
    } else if (queryMode === 'expression') {
        var expression = document.getElementById('expression').value;
        if (!expression || !expression.trim()) {
            alert('Please enter a valid expression.');
            return;
        }

        layerObject.eachLayer(function(feature) {
            if (feature.feature && feature.feature.properties) {
                if (evaluateExpression(feature, expression)) {
                    filteredFeatures.push(feature.feature);
                }
            }
        });
    } else {
        alert('Please select Attribute or Expression query mode.');
        return;
    }

    renderQueryResults(filteredFeatures, value_layer);
}

function renderQueryResults(features, layerName) {
    var data = {
        type: 'FeatureCollection',
        features: features
    };

    geojson = L.geoJson(data, {
        style: {
            color: 'red',
            weight: 3,
            opacity: 0.8,
            fillOpacity: 0.5
        },
        onEachFeature: onEachFeature
    }).addTo(map);

    if (features.length > 0) {
        map.fitBounds(geojson.getBounds());
    }

    var col = ['id'];
    features.forEach(function(feature) {
        for (var key in feature.properties) {
            if (col.indexOf(key) === -1) {
                col.push(key);
            }
        }
    });

    var table = document.createElement('table');
    table.setAttribute('class', 'table table-hover table-striped');
    table.setAttribute('id', 'table');

    var caption = document.createElement('caption');
    caption.setAttribute('id', 'caption');
    caption.style.captionSide = 'top';
    caption.innerHTML = layerName + ' (Number of Features : ' + features.length + ' )';
    table.appendChild(caption);

    var tr = table.insertRow(-1);
    col.forEach(function(column) {
        var th = document.createElement('th');
        th.innerHTML = column;
        tr.appendChild(th);
    });

    features.forEach(function(feature) {
        tr = table.insertRow(-1);
        col.forEach(function(column, index) {
            var tabCell = tr.insertCell(-1);
            if (index === 0) {
                tabCell.innerHTML = feature.id || '';
            } else {
                tabCell.innerHTML = feature.properties[column];
            }
        });
    });

    var divContainer = document.getElementById('table_data');
    divContainer.innerHTML = '';
    divContainer.appendChild(table);

    addRowHandlers();
    document.getElementById('map').style.height = '71%';
    document.getElementById('table_data').style.height = '29%';
    map.invalidateSize();
}

function getFeatureBBox(feature) {
    var coords = [];

    function collectCoordinates(geometry) {
        if (!geometry) {
            return;
        }
        if (geometry.type === 'Point') {
            coords.push(geometry.coordinates);
        } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
            geometry.coordinates.forEach(function(c) {
                coords.push(c);
            });
        } else if (geometry.type === 'Polygon' || geometry.type === 'MultiLineString') {
            geometry.coordinates.forEach(function(ring) {
                ring.forEach(function(c) {
                    if (Array.isArray(c[0])) {
                        c.forEach(function(cc) {
                            coords.push(cc);
                        });
                    } else {
                        coords.push(c);
                    }
                });
            });
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(function(polygon) {
                polygon.forEach(function(ring) {
                    ring.forEach(function(c) {
                        coords.push(c);
                    });
                });
            });
        }
    }

    collectCoordinates(feature.geometry);
    if (coords.length === 0) {
        return null;
    }

    var minX = coords[0][0];
    var minY = coords[0][1];
    var maxX = coords[0][0];
    var maxY = coords[0][1];

    coords.forEach(function(coord) {
        if (coord[0] < minX) minX = coord[0];
        if (coord[1] < minY) minY = coord[1];
        if (coord[0] > maxX) maxX = coord[0];
        if (coord[1] > maxY) maxY = coord[1];
    });

    return [minX, minY, maxX, maxY];
}

function bboxIntersects(a, b) {
    return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

function bboxWithin(a, b) {
    return a[0] >= b[0] && a[2] <= b[2] && a[1] >= b[1] && a[3] <= b[3];
}

function bboxContains(a, b) {
    return b[0] >= a[0] && b[2] <= a[2] && b[1] >= a[1] && b[3] <= a[3];
}

function spatialRelationMatches(featureBbox, viewBbox, relation) {
    if (!featureBbox || !viewBbox) {
        return false;
    }
    if (relation === 'INTERSECTS') {
        return bboxIntersects(featureBbox, viewBbox);
    }
    if (relation === 'WITHIN') {
        return bboxWithin(featureBbox, viewBbox);
    }
    if (relation === 'CONTAINS') {
        return bboxContains(featureBbox, viewBbox);
    }
    return false;
}

function spatialQuery() {
    $('#table').empty();
    if (geojson) {
        map.removeLayer(geojson);
    }
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }

    var layer = document.getElementById('layer');
    var value_layer = layer.options[layer.selectedIndex].value;
    var boundary_layer = document.getElementById('boundary_layer').value;
    var relation = document.getElementById('spatial_relation').value;

    if (!value_layer || !geojsonLayers[value_layer]) {
        alert('Please select a valid layer for spatial query.');
        return;
    }
    if (!boundary_layer || !geojsonLayers[boundary_layer]) {
        alert('Please select a valid boundary layer.');
        return;
    }

    var filteredFeatures = [];
    var boundaryFeatures = [];
    geojsonLayers[boundary_layer].eachLayer(function(feature) {
        if (feature.feature) {
            boundaryFeatures.push(feature.feature);
        }
    });
    // Assume single polygon, take first
    var boundary = boundaryFeatures[0];
    if (!boundary || boundary.geometry.type !== 'Polygon' && boundary.geometry.type !== 'MultiPolygon') {
        alert('Selected boundary layer must contain polygon features.');
        return;
    }

    geojsonLayers[value_layer].eachLayer(function(feature) {
        if (feature.feature && feature.feature.geometry.type === 'Point') {
            var point = feature.feature;
            var isMatch = false;
            if (relation === 'WITHIN') {
                isMatch = turf.booleanPointInPolygon(point, boundary);
            } else if (relation === 'INTERSECTS') {
                // For points, intersects is same as within for polygons
                isMatch = turf.booleanPointInPolygon(point, boundary);
            }
            if (isMatch) {
                filteredFeatures.push(point);
            }
        }
    });

    renderQueryResults(filteredFeatures, value_layer + ' (' + relation + ' ' + boundary_layer + ')');

    // Create heatmap
    var heatPoints = filteredFeatures.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]]);
    heatLayer = L.heatLayer(heatPoints, {radius: 25}).addTo(map);
}

// highlight the feature on map and table on map click
function onEachFeature(feature, layer) {

    layer.on('click', function(e) {
        // e = event

        // Reset selected to default style
        if (selected) {
            // Reset selected to default style
            geojson.resetStyle(selected);
        }

        selected = e.target;

        selected.setStyle({
            'color': 'red'
        });

        if (feature) {

            console.log(feature);
            $(function() {
                $("#table td").each(function() {
                    $(this).parent("tr").css("background-color", "white");
                });
            });


        }

        var table = document.getElementById('table');
        var cells = table.getElementsByTagName('td');
        var rows = document.getElementById("table").rows;
        var heads = table.getElementsByTagName('th');
        var col_no;
        for (var i = 0; i < heads.length; i++) {
            // Take each cell
            var head = heads[i];
            //alert(head.innerHTML);
            if (head.innerHTML == 'id') {
                col_no = i + 1;
                //alert(col_no);
            }

        }
        var row_no = findRowNumber(col_no, feature.id);
        //alert(row_no);

        var rows = document.querySelectorAll('#table tr');

        rows[row_no].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });

        $(document).ready(function() {
            $("#table td:nth-child(" + col_no + ")").each(function() {

                if ($(this).text() == feature.id) {
                    $(this).parent("tr").css("background-color", "grey");

                }
            });
        });
    });




};

// highlight the feature on map and table on row select in table
function addRowHandlers() {
    var rows = document.getElementById("table").rows;
    var heads = table.getElementsByTagName('th');
    var col_no;
    for (var i = 0; i < heads.length; i++) {
        // Take each cell
        var head = heads[i];
        //alert(head.innerHTML);
        if (head.innerHTML == 'id') {
            col_no = i + 1;
            //alert(col_no);
        }

    }
    for (i = 0; i < rows.length; i++) {



        rows[i].onclick = function() {
            return function() {
                //featureOverlay.getSource().clear();
                if (geojson) {
                    geojson.resetStyle();
                }
                $(function() {
                    $("#table td").each(function() {
                        $(this).parent("tr").css("background-color", "white");
                    });
                });
                var cell = this.cells[col_no - 1];
                var id = cell.innerHTML;


                $(document).ready(function() {
                    $("#table td:nth-child(" + col_no + ")").each(function() {
                        if ($(this).text() == id) {
                            $(this).parent("tr").css("background-color", "grey");
                        }
                    });
                });

                features = geojson.getLayers();

                for (i = 0; i < features.length; i++) {



                    if (features[i].feature.id == id) {
                        //alert(features[i].feature.id);
                        //featureOverlay.getSource().addFeature(features[i]);
                        selected = features[i];
                        selected.setStyle({
                            'color': 'red'
                        });
                        map.fitBounds(selected.getBounds());
                        console.log(selected.getBounds());
                    }
                }

                //alert("id:" + id);
            };
        }(rows[i]);
    }
}

//list of wms_layers_ in window on click of button

function wms_layers() {

   
     
  $("#wms_layers_window").modal({backdrop: false});
  //$("#wms_layers_window").draggable();
  $("#wms_layers_window").modal('show');
 
    

    $(document).ready(function() {
        $.ajax({
            type: "GET",
            url: "http://localhost:8084/geoserver/wms?request=getCapabilities",
            dataType: "xml",
            success: function(xml) {
                $('#table_wms_layers').empty();
                // console.log("here");
                $('<tr></tr>').html('<th>Name</th><th>Title</th><th>Abstract</th>').appendTo('#table_wms_layers');
                $(xml).find('Layer').find('Layer').each(function() {
                    var name = $(this).children('Name').text();
                    // alert(name);
                    //var name1 = name.find('Name').text();
                    //alert(name);
                    var title = $(this).children('Title').text();

                    var abst = $(this).children('Abstract').text();
                    //   alert(abst);


                    //   alert('test');
                    $('<tr></tr>').html('<td>' + name + '</td><td>' + title + '</td><td>' + abst + '</td>').appendTo('#table_wms_layers');
                    //document.getElementById("table_wms_layers").setAttribute("class", "table-success");

                });
                addRowHandlers1();
            }
        });
    });




    function addRowHandlers1() {
        //alert('knd');
        var rows = document.getElementById("table_wms_layers").rows;
        var table = document.getElementById('table_wms_layers');
        var heads = table.getElementsByTagName('th');
        var col_no;
        for (var i = 0; i < heads.length; i++) {
            // Take each cell
            var head = heads[i];
            //alert(head.innerHTML);
            if (head.innerHTML == 'Name') {
                col_no = i + 1;
                //alert(col_no);
            }

        }
        for (i = 0; i < rows.length; i++) {

            rows[i].onclick = function() {
                return function() {

                    $(function() {
                        $("#table_wms_layers td").each(function() {
                            $(this).parent("tr").css("background-color", "white");
                        });
                    });
                    var cell = this.cells[col_no - 1];
                    layer_name = cell.innerHTML;
                    // alert(layer_name);

                    $(document).ready(function() {
                        $("#table_wms_layers td:nth-child(" + col_no + ")").each(function() {
                            if ($(this).text() == layer_name) {
                                $(this).parent("tr").css("background-color", "grey");



                            }
                        });
                    });

                    //alert("id:" + id);
                };
            }(rows[i]);
        }

    }

}
// add wms layer to map on click of button
function add_layer() {
    //	alert("jd"); 

    //alert(layer_name);
    //map.removeControl(layerSwitcher);

    var name = layer_name.split(":");
    //alert(layer_name);
    var layer_wms = L.tileLayer.wms('http://localhost:8084/geoserver/wms?', {
        layers: layer_name,
        transparent: 'true',
        format: 'image/png'
		
    }).addTo(map);
    //layerControl.addOverlay(india_district,"india_district");

    layerControl.addOverlay(layer_wms, layer_name);
    overlays.addLayer(layer_wms, layer_name);


    $(document).ready(function() {
        $.ajax({
            type: "GET",
            url: "http://localhost:8084/geoserver/wms?request=getCapabilities",
            dataType: "xml",
            success: function(xml) {


                $(xml).find('Layer').find('Layer').each(function() {
                    var name = $(this).children('Name').text();
                    // alert(name);
                    if (name == layer_name) {
                        // use this for getting the lat long of the extent
                        var bbox1 = $(this).children('EX_GeographicBoundingBox').children('southBoundLatitude').text();
                        var bbox2 = $(this).children('EX_GeographicBoundingBox').children('westBoundLongitude').text();
                        var bbox3 = $(this).children('EX_GeographicBoundingBox').children('northBoundLatitude').text();
                        var bbox4 = $(this).children('EX_GeographicBoundingBox').children('eastBoundLongitude').text();
                        var southWest = L.latLng(bbox1, bbox2);
                        var northEast = L.latLng(bbox3, bbox4);
                        var bounds = L.latLngBounds(southWest, northEast);
                        map.fitBounds(bounds);

                        // use below code for getting the extent in the projection defined in geoserver

                        /* $(this).find('BoundingBox').each(function(){
                         if ($(this).attr('CRS') != "CRS:84" ){
                         var bbox1 = $(this).attr('minx');
                         var bbox2 = $(this).attr('miny');
                         var bbox3 = $(this).attr('maxx');
                         var bbox4 = $(this).attr('maxy');
                         var southWest = L.latLng(bbox1, bbox2);
                         var northEast = L.latLng(bbox3, bbox4);
                         var bounds = L.latLngBounds(southWest, northEast);
                          map.fitBounds(bounds);
                         }
                         });*/

                        //  alert($(this).children('EX_GeographicBoundingBox').text());
                      if (bounds != undefined){alert(layer_name+" added to the map");}
                    }



                });

            }
        });
    });


    legend();

}

function close_wms_window(){
layer_name = undefined;
}

// function on click of getinfo
function info() {
    if (document.getElementById("info_btn").innerHTML == "☰ Activate GetInfo") {

        document.getElementById("info_btn").innerHTML = "☰ De-Activate GetInfo";
        document.getElementById("info_btn").setAttribute("class", "btn btn-danger btn-sm");
        map.on('click', getinfo);
    } else {

        map.off('click', getinfo);
        document.getElementById("info_btn").innerHTML = "☰ Activate GetInfo";
        document.getElementById("info_btn").setAttribute("class", "btn btn-success btn-sm");

    }
}

// getinfo function
function getinfo(e) {


    //var url1 = test.getFeatureInfoUrl(e.latlng);
    //console.log(url1);
    
    var point = map.latLngToContainerPoint(e.latlng, map.getZoom());
    
    var bbox = map.getBounds().toBBoxString();
    var size = map.getSize();
    var height = size.y;
    var width = size.x;
    var x = point.x;
    var y = point.y;
    

   
   
    if (content) {
        content = '';
    }
	
	overlays.eachLayer(function (layer) {
	   var url = 'http://localhost:8084/geoserver/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetFeatureInfo&FORMAT=image%2Fpng&TRANSPARENT=true&QUERY_LAYERS=' + layer.options.layers + '&LAYERS=' + layer.options.layers + '&INFO_FORMAT=text%2Fhtml&X=' + x + '&Y=' + y + '&CRS=EPSG%3A4326&STYLES=&WIDTH=' + width + '&HEIGHT=' + height + '&BBOX=' + bbox;
console.log(url);   
	   $.get(url, function(data) {
            //content.push(data);

            content += data;
            //console.log(content);

            popup.setContent(content);
            popup.setLatLng(e.latlng);
            map.openPopup(popup);


        });
	});
	
    

}


// clear function
function clear_all() {
    document.getElementById('map').style.height = '100%';
    document.getElementById('table_data').style.height = '0%';
    map.invalidateSize();
    $('#table').empty();
	 $('#legend').empty();
    //$('#table1').empty();
    if (geojson) {
        map.removeLayer(geojson);
    }
    if (heatLayer) {
        map.removeLayer(heatLayer);
        heatLayer = null;
    }
    map.flyTo([23.00, 82.00], 4);

    document.getElementById("query_panel_btn").innerHTML = "☰ Open Query Panel";
	document.getElementById("query_panel_btn").setAttribute("class", "btn btn-success btn-sm");

    document.getElementById("query_tab").style.width = "0%";
    document.getElementById("map").style.width = "100%";
    document.getElementById("map").style.left = "0%";
    document.getElementById("query_tab").style.visibility = "hidden";
    document.getElementById('table_data').style.left = '0%';

    document.getElementById("legend_btn").innerHTML = "☰ Show Legend";
    document.getElementById("legend").style.width = "0%";
    document.getElementById("legend").style.visibility = "hidden";
    document.getElementById('legend').style.height = '0%';

    map.off('click', getinfo);
    document.getElementById("info_btn").innerHTML = "☰ Activate GetInfo";
    document.getElementById("info_btn").setAttribute("class", "btn btn-success btn-sm");
	
	overlays.eachLayer(function (layer) {
	map.removeLayer(layer);
	layerControl.removeLayer(layer);
	overlays.removeLayer(layer);
	
	});
	overlays.clearLayers();
	
		
    map.invalidateSize();

}

function show_hide_querypanel() {

    if (document.getElementById("query_tab").style.visibility == "hidden") {

	document.getElementById("query_panel_btn").innerHTML = "☰ Hide Query Panel";
        document.getElementById("query_panel_btn").setAttribute("class", "btn btn-danger btn-sm");
		document.getElementById("query_tab").style.visibility = "visible";
        document.getElementById("query_tab").style.width = "20%";
        document.getElementById("map").style.width = "79%";
        document.getElementById("map").style.left = "20%";
        
        document.getElementById('table_data').style.left = '20%';
        map.invalidateSize();
    } else {
        document.getElementById("query_panel_btn").innerHTML = "☰ Open Query Panel";
        document.getElementById("query_panel_btn").setAttribute("class", "btn btn-success btn-sm");
        document.getElementById("query_tab").style.width = "0%";
        document.getElementById("map").style.width = "100%";
        document.getElementById("map").style.left = "0%";
        document.getElementById("query_tab").style.visibility = "hidden";
        document.getElementById('table_data').style.left = '0%';

        map.invalidateSize();
    }
}

function show_hide_legend() {

    if (document.getElementById("legend").style.visibility == "hidden") {

        document.getElementById("legend_btn").innerHTML = "☰ Hide Legend";
		 document.getElementById("legend").style.visibility = "visible";
        document.getElementById("legend").style.width = "15%";
       
        document.getElementById('legend').style.height = '38%';
        map.invalidateSize();
    } else {
        document.getElementById("legend_btn").innerHTML = "☰ Show Legend";
        document.getElementById("legend").style.width = "0%";
        document.getElementById("legend").style.visibility = "hidden";
        document.getElementById('legend').style.height = '0%';

        map.invalidateSize();
    }
}