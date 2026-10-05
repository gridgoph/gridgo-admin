// Metro compiles global.css through the NativeWind/react-native-css pipeline.
// Jest has no CSS transform, so a module that imports the stylesheet for its
// side effect gets this empty stand-in instead.
module.exports = {};
