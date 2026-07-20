// Reanimated 4 requiere el plugin de worklets y DEBE ir último en `plugins`. Sin él, los
// worklets (gestos + animaciones del panel de vidrio) corren en el hilo JS y el drag tironea —
// exactamente lo que el spike de F2 va a medir en el SM-A217M.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
