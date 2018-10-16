// map option
const popupOption = {
    closeButton: false,
    minWidth: 260,
    maxWidth: 300,
    maxHeight: 300,
};

const featureStyle = {
    color: 'red',
};

const highlightStye = {
    color: '#3388ff',
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
layerControls.addOverlay(traLayer, 'Trajectories');

let myMovingMarker = L.Marker.movingMarker([[39, 116], [22, 113]],
    [20000], {
        autostart: true,
        loop: true,
    });
traLayer.addLayer(myMovingMarker);


// flow layer
let canvasRenderer = L.canvas();
Papa.parse('data/Flowmap_Cities_one_to_many.csv', {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function (results) {
        var geoJsonFeatureCollection = {
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
        var oneToManyFlowmapLayer = L.canvasFlowmapLayer(geoJsonFeatureCollection, {
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
            style: function (geoJsonFeature) {
                // since the GeoJSON feature properties are modified by the layer,
                // developers can rely on the "isOrigin" property to set different
                // symbols for origin vs destination CircleMarker stylings
                if (geoJsonFeature.properties.isOrigin) {
                    return {
                        renderer: canvasRenderer, // recommended to use your own L.canvas()
                        radius: 10,
                        weight: 1,
                        color: 'rgb(195, 255, 62)',
                        fillColor: 'rgba(195, 255, 62, 0.6)',
                        fillOpacity: 0.6
                    };
                } else {
                    return {
                        renderer: canvasRenderer,
                        radius: 5,
                        weight: 0.25,
                        color: 'rgb(17, 142, 170)',
                        fillColor: 'rgb(17, 142, 170)',
                        fillOpacity: 0.7
                    };
                }
            },
            pathDisplayMode: 'selection',
            animationStarted: true,
            animationEasingFamily: 'Cubic',
            animationEasingType: 'In',
            animationDuration: 2000
        }).addTo(lmap);

        // since this demo is using the optional "pathDisplayMode" as "selection",
        // it is up to the developer to wire up a click or mouseover listener
        // and then call the "selectFeaturesForPathDisplay()" method to inform the layer
        // which Bezier paths need to be drawn
        oneToManyFlowmapLayer.on('mouseover', function (e) {
            if (e.sharedOriginFeatures.length) {
                oneToManyFlowmapLayer.selectFeaturesForPathDisplay(e.sharedOriginFeatures, 'SELECTION_NEW');
            }
            if (e.sharedDestinationFeatures.length) {
                oneToManyFlowmapLayer.selectFeaturesForPathDisplay(e.sharedDestinationFeatures, 'SELECTION_NEW');
            }
        });
        oneToManyFlowmapLayer.on('mouseout', function (e) {
            oneToManyFlowmapLayer.clearAllPathSelections();
        });
        layerControls.addOverlay(oneToManyFlowmapLayer, 'Flow Layer');

    }
});


// geometry layer

// edit map
let JSONLayer = new L.GeoJSON([], {
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng);
    }
}).addTo(lmap);
layerControls.addOverlay(JSONLayer, 'Geometries');

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
        circle: false,
    },
});
lmap.addControl(drawControl);

lmap.on(L.Draw.Event.CREATED, function (event) {
    let layer = event.layer;
    //console.log(layer);
    JSONLayer.addLayer(layer);
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
        layer.setStyle(featureStyle);
    });
    layer.on('popupclose', function () {
        layer.setStyle(highlightStye);
    })
});

// import and export
var fileBtn = $("#open-file-dialog")[0];
$('#open-file').click(function () {
    fileBtn.click();
});

fileBtn.addEventListener('change', function () {
    if (fileBtn.files && fileBtn.files[0]) {
        var selectedFile = fileBtn.files[0];
        var reader = new FileReader();

        if (selectedFile.name.endsWith('zip')) {
            reader.readAsArrayBuffer(selectedFile);
            reader.onload = function (e) {
                shp(e.target.result).then(function (geojson) {
                    JSONLayer.addData(geojson);
                })
            }
        }
        else {
            reader.readAsText(selectedFile);
            reader.onload = function (e) {
                var json = JSON.parse(e.target.result);
                JSONLayer.addData(json)
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