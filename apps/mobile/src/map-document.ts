import {
  palette,
  type ThemeColors,
} from "../../../packages/design-tokens/src/index";
import type { Location } from "@qsale/contracts";

interface Point extends Location {
  label: string;
  midpoint?: boolean;
}

export function buildMapDocument(
  points: Point[],
  value: Location | null | undefined,
  editable: boolean,
  theme: ThemeColors = palette.light,
) {
  const serialized = JSON.stringify([
    ...points,
    ...(value ? [{ ...value, label: "Ubicación elegida" }] : []),
  ]).replaceAll("<", "\\u003c");
  return `<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0}body{background:${theme.background};color:${theme.ink};font-family:sans-serif;font-size:16px}#map-status{position:absolute;top:0;left:0;right:0;z-index:2000;background:${theme.surface};padding:12px;color:${theme.ink}}#map-status:empty{display:none}</style></head><body><div id="map-status" role="status"></div><div id="map"></div><script>
let mapFailed=false;
function failMap(){if(mapFailed)return;mapFailed=true;document.getElementById('map-status').textContent='No pudimos cargar el mapa. Revisa tu conexión o usa las coordenadas.';window.ReactNativeWebView?.postMessage(JSON.stringify({error:'map-load'}));}
const mapLoadTimer=setTimeout(failMap,12000);
</script><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" onerror="failMap()"></script><script>
if(typeof L!=='undefined'){
clearTimeout(mapLoadTimer);
const points=${serialized};
const map=L.map('map',{scrollWheelZoom:false,zoomAnimation:false}).setView([-12.115,-77.025],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',maxZoom:19}).on('tileerror',failMap).addTo(map);
points.forEach(p=>{const text=document.createElement('span');text.textContent=p.label;L.circleMarker([p.latitude,p.longitude],{radius:8,color:p.midpoint?'${theme.green}':'${theme.link}',fillOpacity:1}).bindPopup(text).addTo(map)});
if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.latitude,p.longitude])),{padding:[35,35],maxZoom:14,animate:false});
${editable ? "map.on('click',e=>window.ReactNativeWebView?.postMessage(JSON.stringify({latitude:e.latlng.lat,longitude:e.latlng.lng})))" : ""}
}
</script></body></html>`;
}
