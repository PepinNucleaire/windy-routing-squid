const options = {
  // key: "SKj6NGUH7pGeDFEz9WFARxfyOeOdL9cX", // REPLACE WITH YOUR KEY !!!
  key: "1I6lLiqgpo5krbQMdhnTmLX3zJtKzMGT",
  lat: 45,
  lon: -1,
  zoom: 5,
};
var track = [];
var mapWindy;
function fileChange(e) {
  const fileList = e.target.files;
  // console.log(fileList);
  return (output = readFile(fileList[0]));
}
function readFile() {
  const file = upload.files;
  const reader = new FileReader();
  reader.onload = (e) => {
    var rawText = e.target.result;
    var result = parseSquidRouting(rawText);
    // console.log(JSON.stringify(result));
    document.getElementById("dataUploaded").value = JSON.stringify(result);
    importTrackIntoWindy();
  };
  reader.readAsText(file[0]);
}

function parseSquidRouting(text) {
  var x2js = new X2JS();
  var parsedFile = x2js.xml_str2json(text);

  // console.log(parsedFile);
  const rawRoute = parsedFile.kml.Document.Folder[0];
  const rawRouting = parsedFile.kml.Document.Folder[1];

  var route = {
    name: rawRoute.name,
    tracks: rawRoute.Placemark.map((x) => [
      parseFloat(x.Point.coordinates.split(",")[1]),
      parseFloat(x.Point.coordinates.split(",")[0]),
    ]),
  };
  var routing = {
    name: rawRouting.name,
    tracks: rawRouting.Placemark.map((x) => [
      parseFloat(x.Point.coordinates.split(",")[1]),
      parseFloat(x.Point.coordinates.split(",")[0]),
      new Date(x.TimeStamp.when).getTime(),
    ]),
  };

  // const layer = L.polyline(route.track).addTo(map);
  return { route: route, routing: routing };
}

windyInit(options, (windyAPI) => {
  const { map, picker, utils, broadcast, store, overlays } = windyAPI;

  store.on("pickerLocation", ({ lat, lon }) => {
    const { values, overlay } = picker.getParams();
    console.log(picker.getParams());
    // console.log(values, overlay);
    console.log(overlays.wind);
    console.log(utils.wind2obj(values));
  });
  console.log(store.getAllowed("product"));
  store.set("isolines", "pressure");
  store.set("latlon", true);
  store.on("timestamp", (ts) => {
    importTrackIntoWindy();
  });
  broadcast.on("redrawFinished", (params) => {
    // console.log("Map was rendered:", params);
  });
  // Handle some events. We need to update the rotation of icons ideally each time
  // leaflet re-renders. them.
  map.on("click", function (ev) {
    // console.log(ev); // ev is an event object (MouseEvent in this case)
    picker.open({ lat: ev.latlng.lat, lon: ev.latlng.lng });
  });
});

function importTrackIntoWindy() {
  if (document.getElementById("dataUploaded").value == "") {
    return;
  }
  var routing = JSON.parse(document.getElementById("dataUploaded").value);
  var allTrack = routing.routing.tracks;
  var timestamp = W.store.get("timestamp");

  var trackWTs = allTrack.filter((point) => {
    return point[2] < timestamp;
  });
  var track = trackWTs.map((x) => [x[0], x[1]]);
  drawOnWindy(trackWTs);
}

var layerMarkers = [];
var lines = [];

function drawOnWindy(trackWTs) {
  var track = trackWTs.map((x) => [x[0], x[1]]);

  if (track.length == 0) {
    return;
  }
  const trackLine = L.polyline(track, {
    color: `red`,
    weight: 2,
    name: "track1",
  }).addTo(W.map.map);
  if (lines.length > 0) {
    lines[lines.length - 1].remove(W.map.map);
  }
  lines.push(trackLine);

  const MARKER =
    encodeURIComponent(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
        <svg width="100%" height="100%" viewBox="0 0 14 14" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:1.41421;">
        <path d="M4.784,13.635c0,0 -0.106,-2.924 0.006,-4.379c0.115,-1.502 0.318,-3.151 0.686,-4.632c0.163,-0.654 0.45,-1.623 0.755,-2.44c0.202,-0.54 0.407,-1.021 0.554,-1.352c0.038,-0.085 0.122,-0.139 0.215,-0.139c0.092,0 0.176,0.054 0.214,0.139c0.151,0.342 0.361,0.835 0.555,1.352c0.305,0.817 0.592,1.786 0.755,2.44c0.368,1.481 0.571,3.13 0.686,4.632c0.112,1.455 0.006,4.379 0.006,4.379l-4.432,0Z" style="fill:rgb(0,46,252);"/><path d="M5.481,12.731c0,0 -0.073,-3.048 0.003,-4.22c0.06,-0.909 0.886,-3.522 1.293,-4.764c0.03,-0.098 0.121,-0.165 0.223,-0.165c0.103,0 0.193,0.067 0.224,0.164c0.406,1.243 1.232,3.856 1.292,4.765c0.076,1.172 0.003,4.22 0.003,4.22l-3.038,0Z" style="fill:rgb(255,255,255);fill-opacity:0.846008;"/>
    </svg>`);
  const MARKER_ICON_URL = `data:image/svg+xml;utf8,${MARKER}`;
  const BoatIcon = L.icon({
    iconUrl: MARKER_ICON_URL,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, 0],
  });
  if (layerMarkers.length > 0) {
    layerMarkers[layerMarkers.length - 1].remove(W.map.map);
  }

  const marker = L.marker(track[track.length - 1], {
    icon: BoatIcon,
  });
  layerMarkers.push(marker);

  marker.addTo(W.map.map);

  var navInfoDirect = getNavInfo(
    trackWTs[trackWTs.length - 1],
    trackWTs[trackWTs.length - 2]
  );

  var navTotal = getNavInfo(trackWTs[trackWTs.length - 1], trackWTs[0]);
  console.log(navTotal);
  console.log(navInfoDirect);

  // console.log(heading);
  const icon = marker._icon;
  icon.style.transform = `${icon.style.transform} rotateZ(${navInfoDirect.heading}deg)`;
  icon.style.transformOrigin = "center";
}

function radians(n) {
  return n * (Math.PI / 180);
}
function degrees(n) {
  return n * (180 / Math.PI);
}

function getNavInfo(lastPoint, firstPoint) {
  var distance = getDistance(lastPoint, firstPoint);

  var speed = getSpeed(distance, lastPoint, firstPoint);

  var heading = getBearing(lastPoint, firstPoint);

  return { distance: distance, speed: speed, heading: heading };
}
function getSpeed(distance, lastPoint, firstPoint) {
  return distance / ((lastPoint[2] - firstPoint[2]) / 1000 / 60 / 60);
}
function getDistance(lastPoint, firstPoint) {
  var lat2 = lastPoint[0];
  var lon2 = lastPoint[1];
  var lat1 = firstPoint[0];
  var lon1 = firstPoint[1];

  var R = 6371; // km
  //has a problem with the .toRad() method below.
  var x1 = lat2 - lat1;
  var dLat = radians(x1);
  var x2 = lon2 - lon1;
  var dLon = radians(x2);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = (R * c) / 1.852;

  return d;
}

function getBearing(end, start) {
  if (!end && !start) {
    return 0;
  }
  startLat = radians(start[0]);
  startLong = radians(start[1]);
  endLat = radians(end[0]);
  endLong = radians(end[1]);

  var dLong = endLong - startLong;

  var dPhi = Math.log(
    Math.tan(endLat / 2.0 + Math.PI / 4.0) /
      Math.tan(startLat / 2.0 + Math.PI / 4.0)
  );
  if (Math.abs(dLong) > Math.PI) {
    if (dLong > 0.0) dLong = -(2.0 * Math.PI - dLong);
    else dLong = 2.0 * Math.PI + dLong;
  }

  return (degrees(Math.atan2(dLong, dPhi)) + 360.0) % 360.0;
}
