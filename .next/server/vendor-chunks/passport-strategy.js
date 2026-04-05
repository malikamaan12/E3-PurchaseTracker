/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/passport-strategy";
exports.ids = ["vendor-chunks/passport-strategy"];
exports.modules = {

/***/ "(rsc)/./node_modules/passport-strategy/lib/index.js":
/*!*****************************************************!*\
  !*** ./node_modules/passport-strategy/lib/index.js ***!
  \*****************************************************/
/***/ ((module, exports, __webpack_require__) => {

eval("/**\n * Module dependencies.\n */\nvar Strategy = __webpack_require__(/*! ./strategy */ \"(rsc)/./node_modules/passport-strategy/lib/strategy.js\");\n\n\n/**\n * Expose `Strategy` directly from package.\n */\nexports = module.exports = Strategy;\n\n/**\n * Export constructors.\n */\nexports.Strategy = Strategy;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvcGFzc3BvcnQtc3RyYXRlZ3kvbGliL2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBLGVBQWUsbUJBQU8sQ0FBQywwRUFBWTs7O0FBR25DO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQiIsInNvdXJjZXMiOlsiQjpcXFB1cmNoYXNlVHJhY2tlclxcUHVyY2hhc2VUcmFja2VyXFxub2RlX21vZHVsZXNcXHBhc3Nwb3J0LXN0cmF0ZWd5XFxsaWJcXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTW9kdWxlIGRlcGVuZGVuY2llcy5cbiAqL1xudmFyIFN0cmF0ZWd5ID0gcmVxdWlyZSgnLi9zdHJhdGVneScpO1xuXG5cbi8qKlxuICogRXhwb3NlIGBTdHJhdGVneWAgZGlyZWN0bHkgZnJvbSBwYWNrYWdlLlxuICovXG5leHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBTdHJhdGVneTtcblxuLyoqXG4gKiBFeHBvcnQgY29uc3RydWN0b3JzLlxuICovXG5leHBvcnRzLlN0cmF0ZWd5ID0gU3RyYXRlZ3k7XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/passport-strategy/lib/index.js\n");

/***/ }),

/***/ "(rsc)/./node_modules/passport-strategy/lib/strategy.js":
/*!********************************************************!*\
  !*** ./node_modules/passport-strategy/lib/strategy.js ***!
  \********************************************************/
/***/ ((module) => {

eval("/**\n * Creates an instance of `Strategy`.\n *\n * @constructor\n * @api public\n */\nfunction Strategy() {\n}\n\n/**\n * Authenticate request.\n *\n * This function must be overridden by subclasses.  In abstract form, it always\n * throws an exception.\n *\n * @param {Object} req The request to authenticate.\n * @param {Object} [options] Strategy-specific options.\n * @api public\n */\nStrategy.prototype.authenticate = function(req, options) {\n  throw new Error('Strategy#authenticate must be overridden by subclass');\n};\n\n\n/**\n * Expose `Strategy`.\n */\nmodule.exports = Strategy;\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvcGFzc3BvcnQtc3RyYXRlZ3kvbGliL3N0cmF0ZWd5LmpzIiwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBVyxRQUFRO0FBQ25CLFdBQVcsUUFBUTtBQUNuQjtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUFHQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsiQjpcXFB1cmNoYXNlVHJhY2tlclxcUHVyY2hhc2VUcmFja2VyXFxub2RlX21vZHVsZXNcXHBhc3Nwb3J0LXN0cmF0ZWd5XFxsaWJcXHN0cmF0ZWd5LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQ3JlYXRlcyBhbiBpbnN0YW5jZSBvZiBgU3RyYXRlZ3lgLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQGFwaSBwdWJsaWNcbiAqL1xuZnVuY3Rpb24gU3RyYXRlZ3koKSB7XG59XG5cbi8qKlxuICogQXV0aGVudGljYXRlIHJlcXVlc3QuXG4gKlxuICogVGhpcyBmdW5jdGlvbiBtdXN0IGJlIG92ZXJyaWRkZW4gYnkgc3ViY2xhc3Nlcy4gIEluIGFic3RyYWN0IGZvcm0sIGl0IGFsd2F5c1xuICogdGhyb3dzIGFuIGV4Y2VwdGlvbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gcmVxIFRoZSByZXF1ZXN0IHRvIGF1dGhlbnRpY2F0ZS5cbiAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gU3RyYXRlZ3ktc3BlY2lmaWMgb3B0aW9ucy5cbiAqIEBhcGkgcHVibGljXG4gKi9cblN0cmF0ZWd5LnByb3RvdHlwZS5hdXRoZW50aWNhdGUgPSBmdW5jdGlvbihyZXEsIG9wdGlvbnMpIHtcbiAgdGhyb3cgbmV3IEVycm9yKCdTdHJhdGVneSNhdXRoZW50aWNhdGUgbXVzdCBiZSBvdmVycmlkZGVuIGJ5IHN1YmNsYXNzJyk7XG59O1xuXG5cbi8qKlxuICogRXhwb3NlIGBTdHJhdGVneWAuXG4gKi9cbm1vZHVsZS5leHBvcnRzID0gU3RyYXRlZ3k7XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/passport-strategy/lib/strategy.js\n");

/***/ })

};
;