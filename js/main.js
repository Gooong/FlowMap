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

const highlightStye = {
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
let traLayer = new L.FeatureGroup();
layerControls.addOverlay(traLayer, 'Trajectory');
lmap.addLayer(traLayer);

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
            geojson['properties']['time_stamps'] = timestamps;
        }


        if (geojson['properties']['time_stamps']) {
            let timestamps = geojson['properties']['time_stamps'];
            let intervals = []
            for (let i = 1; i < timestamps.length; i++) {
                intervals.push(timestamps[i] - timestamps[i - 1]);
            }
            let sum = intervals.reduce((a, b) => a + b, 0);
            intervals = intervals.map(function (interval) {
                return interval*10000/sum;
            });

            let coors = geojson['geometry']['coordinates'];
            let latlngs = coors.map(L.GeoJSON.coordsToLatLng);
            let movingMarker = L.Marker.movingMarker(latlngs, intervals, {loop: true});
            moving(movingMarker);
            traLayer.addLayer(movingMarker)
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

// let myMovingMarker = L.Marker.movingMarker([[39, 116], [22, 113]],
//     [20000], {
//         autostart: true,
//         loop: true,
//     });
// traLayer.addLayer(myMovingMarker);


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

function buildNetworkLayer(geoJsonFeatureCollection) {
    lmap.removeLayer(networkLayer);
    layerControls.removeLayer(networkLayer);

    networkLayer = L.canvasFlowmapLayer(geoJsonFeatureCollection, networkLayerOption);
    lmap.addLayer(networkLayer);
    layerControls.addOverlay(networkLayer, 'Network');

    let infoPopup = L.popup(popupOption);
    networkLayer.on('mouseover', function (e) {
        console.log(e);
        let outDegree = e.sharedOriginFeatures.length;
        let inDegree = e.sharedDestinationFeatures.length;
        if (outDegree) {
            networkLayer.selectFeaturesForPathDisplay(e.sharedOriginFeatures, 'SELECTION_NEW');
        }
        if (inDegree) {
            networkLayer.selectFeaturesForPathDisplay(e.sharedDestinationFeatures, 'SELECTION_NEW');
        }
        infoPopup.setLatLng(e.latlng).setContent(propertiesToTable({
            'In Degree': inDegree,
            'Out Degree': outDegree,
        })).openOn(lmap);
    });
    networkLayer.on('mouseout', function (e) {
        networkLayer.clearAllPathSelections();
        infoPopup.remove();
    });
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
        content += '<tr><th>' + skey + '</th>';
        content += '<td>' + properties[skey] + '</td></tr>';
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
        layer.setStyle(highlightStye);
    });
    layer.on('popupclose', function () {
        layer.setStyle(featureStyle);
    })

    filterTra(layer);
});

// import and export

// import from url
let urlInput = $('#url-address')[0]
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

function importFile(selectedFile) {
    let reader = new FileReader();

    if (selectedFile.name.endsWith('json')) {
        reader.readAsText(selectedFile);
        reader.onload = function (e) {
            var json = JSON.parse(e.target.result);
            JSONLayer.addData(json);
            if (JSONLayer.getBounds().isValid()) {
                lmap.fitBounds(JSONLayer.getBounds());
            }
        };
    }
    else if (selectedFile.name.endsWith('zip')) {
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
    else if (selectedFile.name.endsWith('csv')) {
        reader.readAsText(selectedFile);
        reader.onload = function (e) {
            addNetwork(e.target.result);
        }
    }
    else if (selectedFile.name.endsWith('gpx')) {
        reader.readAsText(selectedFile);
        reader.onload = function (e) {
            let data = e.target.result;
            let gpx = $.parseXML(data);
            let geojson = toGeoJSON.gpx(gpx);
            console.log(geojson);
            JSONLayer.addData(geojson);
            if (JSONLayer.getBounds().isValid()) {
                lmap.fitBounds(JSONLayer.getBounds());
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
$('#lmap').on("dragover", function (event) {
    event.preventDefault();
    event.stopPropagation();
    $(this).addClass('dragging');
});

$('#lmap').on("dragleave", function (event) {
    event.preventDefault();
    event.stopPropagation();
    $(this).removeClass('dragging');
});

$('#lmap').on("drop", function (ev) {
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