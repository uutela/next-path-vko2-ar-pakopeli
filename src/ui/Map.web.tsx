import { setWorkerUrl } from 'maplibre-gl';
import MapGL, { Marker } from 'react-map-gl/maplibre';
// Without this the map loads its tiles and paints nothing: the canvas is
// created at full size and the screen stays white. See map-view.md AC10.
import 'maplibre-gl/dist/maplibre-gl.css';

// maplibre-gl 6 resolves its worker against import.meta.url, which Metro does
// not rewrite, so the request landed on the dev server's HTML fallback and the
// worker died on creation. Without its worker MapLibre processes no tiles at
// all. postinstall copies the file into public/. See map-view.md AC11.
setWorkerUrl('/maplibre-gl-worker.mjs');
import { StyleSheet, Text, View } from 'react-native';
import { MAP_ATTRIBUTION, MAP_STYLE_URL, MAP_ZOOM, initialCentre } from '../config/map';
import type { MapProps } from './Map';

/**
 * Web map. Same props and same constants as the native one; only the library
 * differs.
 */
export function Map({ points, player }: MapProps) {
  return (
    <View style={styles.container}>
      <View style={styles.mapArea}>
        <MapGL
          // See the comment in Map.tsx: initialViewState is read once, so the
          // key is what lets a position arriving later open the map there.
          key={player ? 'player' : 'points'}
          mapStyle={MAP_STYLE_URL}
          attributionControl={false}
          initialViewState={{
            longitude: initialCentre(points, player)[0],
            latitude: initialCentre(points, player)[1],
            zoom: MAP_ZOOM,
          }}
          // Explicit rather than `flex: 1`: react-map-gl renders a plain DOM
          // div, where a flex value inside react-native-web's layout means
          // nothing. This did not by itself make the map draw its data — see
          // the open item in INBOX.md.
          style={{ width: '100%', height: '100%' }}
        >
          {points.map((point) => (
            <Marker
              key={point.id}
              longitude={point.coordinates.longitude}
              latitude={point.coordinates.latitude}
            />
          ))}
        </MapGL>
      </View>
      <Text style={styles.attribution}>{MAP_ATTRIBUTION}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapArea: { flex: 1 },
  attribution: {
    fontSize: 11,
    opacity: 0.8,
    color: '#1a1a1a',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
