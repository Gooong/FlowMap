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
baseLayers.Street.addTo(lmap);
let layerControls = L.control.layers(baseLayers).setPosition('bottomright').addTo(lmap);

// trajectory layer
let traLayer = new L.FeatureGroup();
layerControls.addOverlay(traLayer, 'Trajectory');
lmap.addLayer(traLayer);

function moving(marker){
    marker.start();
    marker.bindPopup('Click me to pause!').openPopup();
    marker.on('click',function(e){
            console.log(e);
            if(marker.isPaused()==true)
            {
                marker.start();
                marker.bindPopup('Click me to pause!').openPopup();
            }
            else{
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

    networkLayer.on('mouseover', function (e) {
        if (e.sharedOriginFeatures.length) {
            networkLayer.selectFeaturesForPathDisplay(e.sharedOriginFeatures, 'SELECTION_NEW');
        }
        if (e.sharedDestinationFeatures.length) {
            networkLayer.selectFeaturesForPathDisplay(e.sharedDestinationFeatures, 'SELECTION_NEW');
        }
    });
    networkLayer.on('mouseout', function (e) {
        networkLayer.clearAllPathSelections();
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


function layerToTable(layer) {
    let content = '<table class="table table-bordered table-striped view-geometry-property-table"><tbody>';

    if (layer && layer.properties) {
        for (let key in layer.properties) {
            content += '<tr><th>' + key + '</th>';
            content += '<td>' + layer.properties[key] + '</td></tr>';
        }
    }
    content += '</tbody></table>';
    return content;
}

JSONLayer.on('layeradd', function (e) {
    let layer = e.layer;
    layer.bindPopup(function (target) {
        return layerToTable(target.feature);
    }, popupOption);
    layer.on('popupopen', function () {
        layer.setStyle(highlightStye);
    });
    layer.on('popupclose', function () {
        layer.setStyle(featureStyle);
    })
});

// import and export
var fileBtn = $("#open-file-dialog")[0];
$('#open-file').click(function () {
    fileBtn.click();
});

fileBtn.addEventListener('change', function () {
    if (fileBtn.files && fileBtn.files[0]) {
        let selectedFile = fileBtn.files[0];
        let reader = new FileReader();

        if (selectedFile.name.endsWith('zip')) {
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
        else if (selectedFile.name.endsWith('txt')) {
            reader.readAsText(selectedFile);
            reader.onload = function (e) {
                var obj = JSON.parse(e.target.result);
                var latlngs = [];
                for (var i = 0; i < obj.length; i++) {
                    latlngs[i] = [];
                    for (var j = 0; j < 2; j++) {
                        latlngs[i][j] = 1;
                    }
                }
                for (var i = 0; i < obj.length; i++) {
                    latlngs[i][0] = obj[i].lat;
                    latlngs[i][1] = obj[i].lng;
                }

                var marker = new L.Marker.MovingMarker(latlngs, [50000,4000,5656,3232]);
                traLayer.addLayer(marker);

                let p = new L.polyline(latlngs, {color: 'red', weight: 3});
                JSONLayer.addLayer(p);
                moving(marker);
            }
        }
        else {
            reader.readAsText(selectedFile);
            reader.onload = function (e) {
                var json = JSON.parse(e.target.result);
                JSONLayer.addData(json);
                if (JSONLayer.getBounds().isValid()) {
                    lmap.fitBounds(JSONLayer.getBounds());
                }
            };
        }

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