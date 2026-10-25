module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // NOTE: react-native-reanimated/plugin is NOT needed for Reanimated v4+
    // It uses the new Worklets architecture automatically via babel-preset-expo
  };
};
