// map option
const popupOption = {
    closeButton: false,
    minWidth: 260,
    maxWidth: 300,
    maxHeight: 300,
};

const featureStyle = {
  color:'red',
};

const highlightStye = {
 color: '#3388ff',
};

// init map
let lmap = L.map('lmap',{
    preferCanvas: true,
}).setView([39, 116], 5);
lmap.zoomControl.setPosition('topright');

let traLayer = new L.FeatureGroup();
let flowLayer = new L.GeoJSON();
let JSONLayer = new L.GeoJSON([], {
    pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng);
    }
});

lmap.addLayer(traLayer);
lmap.addLayer(flowLayer);
lmap.addLayer(JSONLayer);


let overlayLayers = {
    'Trajectories': traLayer,
    'Flow Layer': flowLayer,
    'Geometries': JSONLayer,
};

let baseLayers = {
    'Empty': L.tileLayer(''),
    'Street': L.tileLayer.provider('OpenStreetMap.Mapnik'),
    'Topography': L.tileLayer.provider('OpenTopoMap'),
    'Gray Style': L.tileLayer.provider('CartoDB.Positron'),
    'Light Color': L.tileLayer.provider('CartoDB.Voyager'),
    'Dark Matter': L.tileLayer.provider('CartoDB.DarkMatter'),
};
baseLayers.Street.addTo(lmap);
L.control.layers(baseLayers, overlayLayers).setPosition('bottomright').addTo(lmap);

// trajectory layer

let myMovingMarker = L.Marker.movingMarker([[39, 116],[22, 113]],
    [20000],{
        autostart: true,
        loop: true,
    });
traLayer.addLayer(myMovingMarker);


// edit map
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
        marker:false,
        circle: false,
    },
});
lmap.addControl(drawControl);

lmap.on(L.Draw.Event.CREATED, function (event) {
    let layer = event.layer;
    //console.log(layer);
    JSONLayer.addLayer(layer);
});

// geometry properties and select geometry
function layerToTable(layer) {
    let content = '<table class="table table-bordered table-striped view-geometry-property-table"><tbody>';

    if(layer && layer.properties){
        for (let key in layer.properties){
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