// map option
const popupOption = {
    closeButton: false,
    minWidth: 260,
    maxWidth: 300,
    maxHeight: 300,
};

const featureStyle = {
    color: '#3388ff',
};

const highlightStyle = {
    color: 'red',
};

const traStyle = {
    weight: 2,
    color: 'gray',
};

const traHighlightStyle = {
    weight: 2,
    color: 'red',
};

// init map
let lmap = L.map('lmap', {
    preferCanvas: true,
}).setView([39, 116], 5);
lmap.zoomControl.setPosition('topright');

let baseLayers = {
    'Empty': L.tileLayer(''),
    'Street': L.tileLayer.provider('OpenStreetMap.Mapnik'),
    'Topography': L.tileLayer.provider('OpenTopoMap'),
    'Gray Style': L.tileLayer.provider('CartoDB.Positron'),
    'Light Color': L.tileLayer.provider('CartoDB.Voyager'),
    'Dark Matter': L.tileLayer.provider('CartoDB.DarkMatter'),
};
baseLayers['Street'].addTo(lmap);
let layerControls = L.control.layers(baseLayers).setPosition('bottomright').addTo(lmap);

// trajectory layer
let traLayer = new L.GeoJSON([],{
    style: traStyle,
});
//traLayer.setStyle(traStyle);
layerControls.addOverlay(traLayer, 'Trajectory');
lmap.addLayer(traLayer);


traLayer.on('layeradd', function (e) {
    let layer = e.layer;
    layer.bindPopup(function (target) {
        if (target.feature && target.feature.properties) {
            return propertiesToTable(target.feature.properties);
        } else {
            return 'No property';
        }
    }, popupOption);
    layer.on('popupopen', function () {
        layer.setStyle(traHighlightStyle);
    });
    layer.on('popupclose', function () {
        layer.setStyle(traStyle);
    });

    filterTra(layer);
});

// create trajectory if the layer is instance of Polyline and contains 'timestamp' property
function filterTra(layer) {
    let geojson = layer.toGeoJSON();
    if (geojson['geometry']['type'] === 'LineString') {
        if (geojson['properties']['coordTimes']) {
            let dates = geojson['properties']['coordTimes'];
            let timestamps = dates.map(function (date) {
                let d = new Date(date);
                return d.getTime();
            });
            geojson['properties']['start_time'] = dates[0];
            geojson['properties']['end_time'] = dates[dates.length - 1];
            geojson['properties']['time_stamps'] = timestamps;
        }


        if (geojson['properties']['time_stamps']) {
            let timestamps = geojson['properties']['time_stamps'];
            let intervals = [];
            for (let i = 1; i < timestamps.length; i++) {
                intervals.push(timestamps[i] - timestamps[i - 1]);
            }
            let sum = intervals.reduce((a, b) => a + b, 0);
            intervals = intervals.map(function (interval) {
                return interval * 100000 / sum;
            });

            let coors = geojson['geometry']['coordinates'];
            let latlngs = coors.map(L.GeoJSON.coordsToLatLng);
            let movingMarker = L.Marker.movingMarker(latlngs, intervals, {loop: true});
            moving(movingMarker);
            traLayer.addLayer(movingMarker);
        }
    }
}

function moving(marker) {
    marker.start();
    marker.bindPopup('Click me to pause!').openPopup();
    marker.on('click', function (e) {
            if (marker.isPaused()) {
                marker.start();
                marker.bindPopup('Click me to pause!').openPopup();
            }
            else {
                marker.pause();
                marker.bindPopup('Click me to start!').openPopup();
            }
        }
    )
}


// network layer
const canvas = L.canvas();
const originCityStyle = {
    renderer: canvas, // recommended to use your own L.canvas()
    radius: 6,
    weight: 1,
    color: 'rgb(195, 255, 62)',
    fillColor: 'rgba(195, 255, 62, 0.6)',
    fillOpacity: 0.6
};

const destinationCityStyle = {
    renderer: canvas,
    radius: 3,
    weight: 0.25,
    color: 'rgb(17, 142, 170)',
    fillColor: 'rgb(17, 142, 170)',
    fillOpacity: 0.7
};

const networkLayerOption = {
    originAndDestinationFieldIds: {
        originUniqueIdField: 's_city_id',
        originGeometry: {
            x: 's_lon',
            y: 's_lat'
        },
        destinationUniqueIdField: 'e_city_id',
        destinationGeometry: {
            x: 'e_lon',
            y: 'e_lat'
        }
    },
    style: geoJsonFeature => geoJsonFeature.properties.isOrigin ? originCityStyle : destinationCityStyle,
    pathDisplayMode: 'select',
    animationStarted: true,
    animationEasingFamily: 'Linear',
    animationEasingType: 'None',
    animationDuration: 2000
};

let networkLayer = L.geoJSON();
lmap.addLayer(networkLayer);
layerControls.addOverlay(networkLayer, 'Network');

let networkInfo = {};

function buildNetworkLayer(geoJsonFeatureCollection) {
    lmap.removeLayer(networkLayer);
    layerControls.removeLayer(networkLayer);

    networkLayer = L.canvasFlowmapLayer(geoJsonFeatureCollection, networkLayerOption);
    lmap.addLayer(networkLayer);
    layerControls.addOverlay(networkLayer, 'Network');

    let infoPopup = L.popup(popupOption);
    networkLayer.on('click', function (e) {
        networkLayer.clearAllPathSelections();
        infoPopup.remove();

        //console.log(e);
        let outDegree = e.sharedOriginFeatures.length;
        let inDegree = e.sharedDestinationFeatures.length;

        let ecity = null;
        if (outDegree) {
            networkLayer.selectFeaturesForPathDisplay(e.sharedOriginFeatures, 'SELECTION_NEW');
            ecity = e.sharedOriginFeatures[0].properties['s_city'];
        }
        if (inDegree) {
            networkLayer.selectFeaturesForPathDisplay(e.sharedDestinationFeatures, 'SELECTION_NEW');
            ecity = e.sharedDestinationFeatures[0].properties['s_city'];
        }

        // betweennessCentrality

        let btw_of_e = networkInfo["btw"]._stringValues[ecity];
        // eigenvectorCentrality
        // let eig_of_e = tmp["eig"]._stringValues[ecity];
        // clustering
        let clu_of_e = networkInfo["clu"]._stringValues[ecity];
        // transitivity of flows
        // let tra_of_e = tmp["tra"]._stringValues[ecity];

        infoPopup.setLatLng(e.latlng).setContent(propertiesToTable({
            'In Degree': inDegree,
            'Out Degree': outDegree,
            'Betweenness Centrality': btw_of_e,
            // 'Eigenvector Centrality': eig_of_e,
            'Clustering coefficient': clu_of_e,
            // 'Transitivity': tra_of_e,
        })).openOn(lmap);
    });
    // networkLayer.on('mouseout', function (e) {
    //     networkLayer.clearAllPathSelections();
    //     infoPopup.remove();
    // });
    return networkLayer;
}

function addNetwork(csvstring) {
    Papa.parse(csvstring, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function (results) {
            let geoJsonFeatureCollection = {
                type: 'FeatureCollection',
                features: results.data.map(function (datum) {
                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [datum.s_lon, datum.s_lat]
                        },
                        properties: datum
                    }
                })
            };
            buildNetworkLayer(geoJsonFeatureCollection);

            let G = new jsnx.Graph();
            let edges = results.data.map(function (datam) {
                return [datam.s_city, datam.e_City]
            });
            // graph creating
            G.addEdgesFrom(edges);
            let btw = jsnx.betweennessCentrality(G);
            // let eig = jsnx.eigenvectorCentrality(G);
            let clu = jsnx.clustering(G);
            // let tra = jsnx.transitivity(G);
            networkInfo["btw"] = btw;
            // tmp["eig"] = eig;
            networkInfo["clu"] = clu;
            // tmp["tra"] = tra;
        }
    });
}


// geometry layer
// edit map
let JSONLayer = new L.GeoJSON([], {
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng);
    }
}).addTo(lmap);
layerControls.addOverlay(JSONLayer, 'Geometry');

let drawControl = new L.Control.Draw({
    position: 'topright',
    edit: {
        featureGroup: JSONLayer,
        selectedPathOptions: {
            maintainColor: true,
            moveMarkers: true
        }
    },
    draw: {
        marker: false,
        circlemarker: true,
        circle: false,
    },
});
lmap.addControl(drawControl);

lmap.on(L.Draw.Event.CREATED, function (event) {
    let layer = event.layer;
    //console.log(layer);
    JSONLayer.addData(layer.toGeoJSON());
});

function propertiesToTable(properties) {
    let content = '<table class="table table-bordered table-striped view-geometry-property-table"><tbody>';
    for (let skey in properties) {
        content += '<tr><th title="' + skey + '">' + skey + '</th>';
        content += '<td title="' + properties[skey] + '">' + properties[skey] + '</td></tr>';
    }
    content += '</tbody></table>';
    return content;
}

JSONLayer.on('layeradd', function (e) {
    let layer = e.layer;
    layer.bindPopup(function (target) {
        if (target.feature && target.feature.properties) {
            return propertiesToTable(target.feature.properties);
        } else {
            return 'No property';
        }
    }, popupOption);
    layer.on('popupopen', function () {
        layer.setStyle(highlightStyle);
    });
    layer.on('popupclose', function () {
        layer.setStyle(featureStyle);
    })

    filterTra(layer);
});

// import and export

// import from url
let urlInput = $('#url-address')[0];
$('#btn-import-from-url').click(function () {
    let url = urlInput.value;
    $.get(url)
        .done(function (data) {
            if (url.endsWith('json')) {
                JSONLayer.addData(data);
                if (JSONLayer.getBounds().isValid()) {
                    lmap.fitBounds(JSONLayer.getBounds());
                }
            }
        })
        .fail(function () {
            alert('Import Fail');
        });
});

// import from file
var fileBtn = $("#open-file-dialog")[0];
$('#open-geometry-file').click(function () {
    fileBtn.click();
});
$('#open-network-file').click(function () {
    fileBtn.click();
});
$('#open-trajectory-file').click(function () {
    fileBtn.click();
});

function importFile(selectedFile) {
    let reader = new FileReader();
    let lower_name = selectedFile.name.toLowerCase();
    if (lower_name.endsWith('json')) {
        reader.readAsText(selectedFile);
        reader.onload = function (e) {
            var json = JSON.parse(e.target.result);
            JSONLayer.addData(json);
            if (JSONLayer.getBounds().isValid()) {
                lmap.fitBounds(JSONLayer.getBounds());
            }
        };
    }
    else if (lower_name.endsWith('zip')) {
        reader.readAsArrayBuffer(selectedFile);
        reader.onload = function (e) {
            shp(e.target.result).then(function (geojson) {
                JSONLayer.addData(geojson);
                if (JSONLayer.getBounds().isValid()) {
                    lmap.fitBounds(JSONLayer.getBounds());
                }
            })
        }
    }
    else if (lower_name.endsWith('csv')) {
        reader.readAsText(selectedFile);
        reader.onload = function (e) {
            addNetwork(e.target.result);
        }
    }
    else if (lower_name.endsWith('gpx')) {
        reader.readAsText(selectedFile);
        reader.onload = function (e) {
            let data = e.target.result;
            let gpx = $.parseXML(data);
            let geojson = toGeoJSON.gpx(gpx);
            //console.log(geojson);
            traLayer.addData(geojson);
            if (traLayer.getBounds().isValid()) {
                lmap.fitBounds(traLayer.getBounds());
                stayPointBtn.removeClass('disabled');
            } else {
                stayPointBtn.addClass('disabled');
            }
        }
    }
}

fileBtn.addEventListener('change', function () {
    if (fileBtn.files && fileBtn.files[0]) {
        let selectedFile = fileBtn.files[0];
        importFile(selectedFile)
    }
});


// drag file
let dragControl = $('#lmap');
dragControl.on("dragover", function (event) {
    event.preventDefault();
    event.stopPropagation();
    $(this).addClass('dragging');
});

dragControl.on("dragleave", function (event) {
    event.preventDefault();
    event.stopPropagation();
    $(this).removeClass('dragging');
});

dragControl.on("drop", function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    if (ev.originalEvent.dataTransfer && ev.originalEvent.dataTransfer.files.length) {
        ev.preventDefault();
        ev.stopPropagation();
        importFile(ev.originalEvent.dataTransfer.files[0]);
    }
});


var btnSaveGeoJSON = $("#btn-save-geojson");
btnSaveGeoJSON.click(function () {
    var data = JSONLayer.toGeoJSON();
    saveGeoJSON(data);
});

var btnSaveShp = $("#btn-save-shp");
btnSaveShp.click(function () {
    var data = JSONLayer.toGeoJSON();
    saveShp(data);
});

var btnSaveImage = $("#btn-save-image");
btnSaveImage.click(function () {
    leafletImage(lmap, function (err, canvas) {
        /// create an "off-screen" anchor tag
        var lnk = document.createElement('a');

        /// the key here is to set the download attribute of the a tag
        lnk.download = 'flowMap';

        /// convert canvas content to data-uri for link. When download
        /// attribute is set the content pointed to by link will be
        /// pushed as "download" in HTML5 capable browsers
        lnk.href = canvas.toDataURL("image/png;base64");

        /// create a "fake" click-event to trigger the download
        if (document.createEvent) {
            e = document.createEvent("MouseEvents");
            e.initMouseEvent("click", true, true, window,
                0, 0, 0, 0, 0, false, false, false,
                false, 0, null);

            lnk.dispatchEvent(e);
        } else if (lnk.fireEvent) {
            lnk.fireEvent("onclick");
        }
    });
});

function saveGeoJSON(data) {
    function saveToFile(content, filename) {
        var file = filename + '.geojson';
        saveAs(new File([JSON.stringify(content)], file, {
            type: "text/plain; charset=UTF-8"
        }), file);
    }

    saveToFile(data, 'export');
}


function saveShp(data) {
    var options = {
        folder: 'shapefiles',
        types: {
            point: 'points',
            polygon: 'polygons',
            polyline: 'polyline',
        }
    };
    shpwrite.download(data, options);
}

// Analyze
let stayPointBtn = $('#btn-stay-point');
stayPointBtn.on("click", function () {
    traLayer.eachLayer(function (layer) {
        let geojson = layer.toGeoJSON();
        if (geojson['geometry']['type'] === 'LineString') {
            //console.log(layer);
            let time_stamps = geojson['properties']['time_stamps'];
            let coors = geojson['geometry']['coordinates'];
            let latlngs = coors.map(L.GeoJSON.coordsToLatLng);
            let i = 0;
            let j = 0;
            let cells = [];
            for (i = 0; i < latlngs.length; i++) {
                for (j = i + 1; j < latlngs.length; j++) {
                    if (L.CRS.EPSG4326.distance(latlngs[i], latlngs[j]) > 50) {
                        if (time_stamps[j] - time_stamps[i] > 1200 * 1000 && j - i >= 4) {
                            cells.push([i, j]);
                        }
                        i = j;
                        break;
                    }
                }

            }
            console.log(cells);

            cells.map(function (cell) {
                lats = [];
                lngs = [];
                for (i = cell[0]; i < cell[1]; i++) {
                    lats.push(latlngs[i].lat);
                    lngs.push(latlngs[i].lng);
                }
                lat = lats.reduce(function (a, b) {
                    return a + b;
                }, 0) / lats.length;
                lng = lngs.reduce(function (a, b) {
                    return a + b;
                }, 0) / lngs.length;
                let staytime = time_stamps[cell[1] - 1] - time_stamps[cell[0]];

                let arrival = new Date(time_stamps[cell[0]]);
                let leave = new Date(time_stamps[cell[1] - 1]);

                let point = {
                    "type": "Feature",
                    "properties": {
                        "stay time(min)": Math.round(staytime / 60000),
                        "arrival time": arrival.getMonth() + "/" + arrival.getDay() + "/" + arrival.getHours() + ":" + arrival.getMinutes(),
                        "leave time": leave.getMonth() + "/" + leave.getDay() + "/" + leave.getHours() + ":" + leave.getMinutes()

                    },
                    "geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat]
                    }
                };
                JSONLayer.addData(point);
            });

        }
    })
});

