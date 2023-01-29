const options = {
  key: "SKj6NGUH7pGeDFEz9WFARxfyOeOdL9cX", // REPLACE WITH YOUR KEY !!!
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
  };
  reader.readAsText(file[0]);
}

function parseSquidRouting(text) {
  var x2js = new X2JS();
  var parsedFile = x2js.xml_str2json(text);

  // console.log(parsedFile);
  const rawRoute = parsedFile.kml.Document.Folder[0];
  const rawRouting = parsedFile.kml.Document.Folder[1];
  console.log(rawRouting);
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
  console.log(routing);
  // const layer = L.polyline(route.track).addTo(map);
  return { route: route, routing: routing };
}

windyInit(options, (windyAPI) => {
  const { map, store } = windyAPI;

  store.on("timestamp", (ts) => {
    importTrackIntoWindy();
  });

  // Handle some events. We need to update the rotation of icons ideally each time
  // leaflet re-renders. them.
  map.on("zoom", updateIconStyle);
  map.on("zoomend", updateIconStyle);
  map.on("viewreset", updateIconStyle);
});

function importTrackIntoWindy() {
  var routing = JSON.parse(document.getElementById("dataUploaded").value);
  var allTrack = routing.routing.tracks;
  var timestamp = W.store.get("timestamp");

  var trackWTs = allTrack.filter((point) => {
    return point[2] < timestamp;
  });
  var track = trackWTs.map((x) => [x[0], x[1]]);
  drawOnWindy(track);
}
var layerMarkers = [];
function drawOnWindy(track) {
  L.polyline(track, {
    color: `red`,
    weight: 4,
  }).addTo(W.map.map);

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

  marker = L.marker(track[track.length - 1], {
    icon: BoatIcon,
  });

  marker.addTo(W.map.map);
  var heading = getBearing(track[track.length - 1], track[track.length - 4]);

  console.log(heading);
  const icon = marker._icon;
  icon.style.transform = `${icon.style.transform} rotateZ(${heading}deg)`;
  icon.style.transformOrigin = "center";
  layerMarkers.push(marker);
}

function radians(n) {
  return n * (Math.PI / 180);
}
function degrees(n) {
  return n * (180 / Math.PI);
}

function getBearing(end, start) {
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
