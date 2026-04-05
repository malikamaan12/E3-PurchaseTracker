/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/auth/user/route";
exports.ids = ["app/api/auth/user/route"];
exports.modules = {

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "../app-render/after-task-async-storage.external":
/*!***********************************************************************************!*\
  !*** external "next/dist/server/app-render/after-task-async-storage.external.js" ***!
  \***********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/after-task-async-storage.external.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "buffer":
/*!*************************!*\
  !*** external "buffer" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("buffer");

/***/ }),

/***/ "crypto":
/*!*************************!*\
  !*** external "crypto" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),

/***/ "stream":
/*!*************************!*\
  !*** external "stream" ***!
  \*************************/
/***/ ((module) => {

"use strict";
module.exports = require("stream");

/***/ }),

/***/ "util":
/*!***********************!*\
  !*** external "util" ***!
  \***********************/
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fauth%2Fuser%2Froute&page=%2Fapi%2Fauth%2Fuser%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Fuser%2Froute.ts&appDir=B%3A%5CPurchaseTracker%5CPurchaseTracker%5Csrc%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=B%3A%5CPurchaseTracker%5CPurchaseTracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!*********************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fauth%2Fuser%2Froute&page=%2Fapi%2Fauth%2Fuser%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Fuser%2Froute.ts&appDir=B%3A%5CPurchaseTracker%5CPurchaseTracker%5Csrc%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=B%3A%5CPurchaseTracker%5CPurchaseTracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \*********************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var B_PurchaseTracker_PurchaseTracker_src_app_api_auth_user_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./src/app/api/auth/user/route.ts */ \"(rsc)/./src/app/api/auth/user/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/auth/user/route\",\n        pathname: \"/api/auth/user\",\n        filename: \"route\",\n        bundlePath: \"app/api/auth/user/route\"\n    },\n    resolvedPagePath: \"B:\\\\PurchaseTracker\\\\PurchaseTracker\\\\src\\\\app\\\\api\\\\auth\\\\user\\\\route.ts\",\n    nextConfigOutput,\n    userland: B_PurchaseTracker_PurchaseTracker_src_app_api_auth_user_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZhdXRoJTJGdXNlciUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGYXV0aCUyRnVzZXIlMkZyb3V0ZSZhcHBQYXRocz0mcGFnZVBhdGg9cHJpdmF0ZS1uZXh0LWFwcC1kaXIlMkZhcGklMkZhdXRoJTJGdXNlciUyRnJvdXRlLnRzJmFwcERpcj1CJTNBJTVDUHVyY2hhc2VUcmFja2VyJTVDUHVyY2hhc2VUcmFja2VyJTVDc3JjJTVDYXBwJnBhZ2VFeHRlbnNpb25zPXRzeCZwYWdlRXh0ZW5zaW9ucz10cyZwYWdlRXh0ZW5zaW9ucz1qc3gmcGFnZUV4dGVuc2lvbnM9anMmcm9vdERpcj1CJTNBJTVDUHVyY2hhc2VUcmFja2VyJTVDUHVyY2hhc2VUcmFja2VyJmlzRGV2PXRydWUmdHNjb25maWdQYXRoPXRzY29uZmlnLmpzb24mYmFzZVBhdGg9JmFzc2V0UHJlZml4PSZuZXh0Q29uZmlnT3V0cHV0PSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUErRjtBQUN2QztBQUNxQjtBQUN5QjtBQUN0RztBQUNBO0FBQ0E7QUFDQSx3QkFBd0IseUdBQW1CO0FBQzNDO0FBQ0EsY0FBYyxrRUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLHNEQUFzRDtBQUM5RDtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUMwRjs7QUFFMUYiLCJzb3VyY2VzIjpbIiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1raW5kXCI7XG5pbXBvcnQgeyBwYXRjaEZldGNoIGFzIF9wYXRjaEZldGNoIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvbGliL3BhdGNoLWZldGNoXCI7XG5pbXBvcnQgKiBhcyB1c2VybGFuZCBmcm9tIFwiQjpcXFxcUHVyY2hhc2VUcmFja2VyXFxcXFB1cmNoYXNlVHJhY2tlclxcXFxzcmNcXFxcYXBwXFxcXGFwaVxcXFxhdXRoXFxcXHVzZXJcXFxccm91dGUudHNcIjtcbi8vIFdlIGluamVjdCB0aGUgbmV4dENvbmZpZ091dHB1dCBoZXJlIHNvIHRoYXQgd2UgY2FuIHVzZSB0aGVtIGluIHRoZSByb3V0ZVxuLy8gbW9kdWxlLlxuY29uc3QgbmV4dENvbmZpZ091dHB1dCA9IFwiXCJcbmNvbnN0IHJvdXRlTW9kdWxlID0gbmV3IEFwcFJvdXRlUm91dGVNb2R1bGUoe1xuICAgIGRlZmluaXRpb246IHtcbiAgICAgICAga2luZDogUm91dGVLaW5kLkFQUF9ST1VURSxcbiAgICAgICAgcGFnZTogXCIvYXBpL2F1dGgvdXNlci9yb3V0ZVwiLFxuICAgICAgICBwYXRobmFtZTogXCIvYXBpL2F1dGgvdXNlclwiLFxuICAgICAgICBmaWxlbmFtZTogXCJyb3V0ZVwiLFxuICAgICAgICBidW5kbGVQYXRoOiBcImFwcC9hcGkvYXV0aC91c2VyL3JvdXRlXCJcbiAgICB9LFxuICAgIHJlc29sdmVkUGFnZVBhdGg6IFwiQjpcXFxcUHVyY2hhc2VUcmFja2VyXFxcXFB1cmNoYXNlVHJhY2tlclxcXFxzcmNcXFxcYXBwXFxcXGFwaVxcXFxhdXRoXFxcXHVzZXJcXFxccm91dGUudHNcIixcbiAgICBuZXh0Q29uZmlnT3V0cHV0LFxuICAgIHVzZXJsYW5kXG59KTtcbi8vIFB1bGwgb3V0IHRoZSBleHBvcnRzIHRoYXQgd2UgbmVlZCB0byBleHBvc2UgZnJvbSB0aGUgbW9kdWxlLiBUaGlzIHNob3VsZFxuLy8gYmUgZWxpbWluYXRlZCB3aGVuIHdlJ3ZlIG1vdmVkIHRoZSBvdGhlciByb3V0ZXMgdG8gdGhlIG5ldyBmb3JtYXQuIFRoZXNlXG4vLyBhcmUgdXNlZCB0byBob29rIGludG8gdGhlIHJvdXRlLlxuY29uc3QgeyB3b3JrQXN5bmNTdG9yYWdlLCB3b3JrVW5pdEFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MgfSA9IHJvdXRlTW9kdWxlO1xuZnVuY3Rpb24gcGF0Y2hGZXRjaCgpIHtcbiAgICByZXR1cm4gX3BhdGNoRmV0Y2goe1xuICAgICAgICB3b3JrQXN5bmNTdG9yYWdlLFxuICAgICAgICB3b3JrVW5pdEFzeW5jU3RvcmFnZVxuICAgIH0pO1xufVxuZXhwb3J0IHsgcm91dGVNb2R1bGUsIHdvcmtBc3luY1N0b3JhZ2UsIHdvcmtVbml0QXN5bmNTdG9yYWdlLCBzZXJ2ZXJIb29rcywgcGF0Y2hGZXRjaCwgIH07XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWFwcC1yb3V0ZS5qcy5tYXAiXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fauth%2Fuser%2Froute&page=%2Fapi%2Fauth%2Fuser%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Fuser%2Froute.ts&appDir=B%3A%5CPurchaseTracker%5CPurchaseTracker%5Csrc%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=B%3A%5CPurchaseTracker%5CPurchaseTracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(rsc)/./server/utils/config.ts":
/*!********************************!*\
  !*** ./server/utils/config.ts ***!
  \********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   IS_PRODUCTION: () => (/* binding */ IS_PRODUCTION),\n/* harmony export */   JWT_SECRET: () => (/* binding */ JWT_SECRET),\n/* harmony export */   TOKEN_COOKIE_NAME: () => (/* binding */ TOKEN_COOKIE_NAME)\n/* harmony export */ });\n/**\n * PurchaseTracker Centralized Configuration\n * This ensures that both the Native Next.js API routes and the Express bridge \n * use the exact same secrets and environment.\n */ // JWT Secret: Fallback is provided ONLY for development stability. \n// In production, the Vercel JWT_SECRET environment variable is MANDATORY.\nconst JWT_SECRET = process.env.JWT_SECRET || \"purchase-management-system-v1-secret-key\";\n// Authentication Cookie Name\nconst TOKEN_COOKIE_NAME = \"auth_token\";\n// Environment Check\nconst IS_PRODUCTION = \"development\" === 'production';\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zZXJ2ZXIvdXRpbHMvY29uZmlnLnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUFBOzs7O0NBSUMsR0FFRCxvRUFBb0U7QUFDcEUsMEVBQTBFO0FBQ25FLE1BQU1BLGFBQWFDLFFBQVFDLEdBQUcsQ0FBQ0YsVUFBVSxJQUFJLDJDQUEyQztBQUUvRiw2QkFBNkI7QUFDdEIsTUFBTUcsb0JBQW9CLGFBQWE7QUFFOUMsb0JBQW9CO0FBQ2IsTUFBTUMsZ0JBQWdCSCxrQkFBeUIsYUFBYSIsInNvdXJjZXMiOlsiQjpcXFB1cmNoYXNlVHJhY2tlclxcUHVyY2hhc2VUcmFja2VyXFxzZXJ2ZXJcXHV0aWxzXFxjb25maWcudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBQdXJjaGFzZVRyYWNrZXIgQ2VudHJhbGl6ZWQgQ29uZmlndXJhdGlvblxuICogVGhpcyBlbnN1cmVzIHRoYXQgYm90aCB0aGUgTmF0aXZlIE5leHQuanMgQVBJIHJvdXRlcyBhbmQgdGhlIEV4cHJlc3MgYnJpZGdlIFxuICogdXNlIHRoZSBleGFjdCBzYW1lIHNlY3JldHMgYW5kIGVudmlyb25tZW50LlxuICovXG5cbi8vIEpXVCBTZWNyZXQ6IEZhbGxiYWNrIGlzIHByb3ZpZGVkIE9OTFkgZm9yIGRldmVsb3BtZW50IHN0YWJpbGl0eS4gXG4vLyBJbiBwcm9kdWN0aW9uLCB0aGUgVmVyY2VsIEpXVF9TRUNSRVQgZW52aXJvbm1lbnQgdmFyaWFibGUgaXMgTUFOREFUT1JZLlxuZXhwb3J0IGNvbnN0IEpXVF9TRUNSRVQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUIHx8IFwicHVyY2hhc2UtbWFuYWdlbWVudC1zeXN0ZW0tdjEtc2VjcmV0LWtleVwiO1xuXG4vLyBBdXRoZW50aWNhdGlvbiBDb29raWUgTmFtZVxuZXhwb3J0IGNvbnN0IFRPS0VOX0NPT0tJRV9OQU1FID0gXCJhdXRoX3Rva2VuXCI7XG5cbi8vIEVudmlyb25tZW50IENoZWNrXG5leHBvcnQgY29uc3QgSVNfUFJPRFVDVElPTiA9IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbic7Il0sIm5hbWVzIjpbIkpXVF9TRUNSRVQiLCJwcm9jZXNzIiwiZW52IiwiVE9LRU5fQ09PS0lFX05BTUUiLCJJU19QUk9EVUNUSU9OIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./server/utils/config.ts\n");

/***/ }),

/***/ "(rsc)/./src/app/api/auth/user/route.ts":
/*!****************************************!*\
  !*** ./src/app/api/auth/user/route.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET),\n/* harmony export */   dynamic: () => (/* binding */ dynamic),\n/* harmony export */   fetchCache: () => (/* binding */ fetchCache)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jsonwebtoken */ \"(rsc)/./node_modules/jsonwebtoken/index.js\");\n/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(jsonwebtoken__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _server_utils_config__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/../server/utils/config */ \"(rsc)/./server/utils/config.ts\");\n\n\n\n/**\n * NATIVE SESSION VERIFICATION\n */ async function GET(req) {\n    const traceId = Math.random().toString(36).substring(7);\n    console.log(`[Auth][Native][${traceId}] Session Verification Start`);\n    try {\n        const token = req.cookies.get(_server_utils_config__WEBPACK_IMPORTED_MODULE_2__.TOKEN_COOKIE_NAME)?.value;\n        if (!token) {\n            console.warn(`[Auth][Native][${traceId}] No session token found.`);\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                message: \"Not authenticated\"\n            }, {\n                status: 401\n            });\n        }\n        const decoded = jsonwebtoken__WEBPACK_IMPORTED_MODULE_1___default().verify(token, _server_utils_config__WEBPACK_IMPORTED_MODULE_2__.JWT_SECRET);\n        console.log(`[Auth][Native][${traceId}] SUCCESS: ${decoded.username} | Role: ${decoded.role} | Dept: ${decoded.department}`);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(decoded);\n    } catch (error) {\n        console.error(`[Auth][Native][${traceId}] Session error:`, error.message);\n        const response = next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            message: \"Session expired\"\n        }, {\n            status: 401\n        });\n        response.cookies.delete(_server_utils_config__WEBPACK_IMPORTED_MODULE_2__.TOKEN_COOKIE_NAME);\n        return response;\n    }\n}\nconst dynamic = 'force-dynamic';\nconst fetchCache = 'force-no-store';\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvYXBwL2FwaS9hdXRoL3VzZXIvcm91dGUudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUF3RDtBQUN6QjtBQUMwQztBQUV6RTs7Q0FFQyxHQUNNLGVBQWVJLElBQUlDLEdBQWdCO0lBQ3hDLE1BQU1DLFVBQVVDLEtBQUtDLE1BQU0sR0FBR0MsUUFBUSxDQUFDLElBQUlDLFNBQVMsQ0FBQztJQUNyREMsUUFBUUMsR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFFTixRQUFRLDRCQUE0QixDQUFDO0lBRW5FLElBQUk7UUFDRixNQUFNTyxRQUFRUixJQUFJUyxPQUFPLENBQUNDLEdBQUcsQ0FBQ1osbUVBQWlCQSxHQUFHYTtRQUVsRCxJQUFJLENBQUNILE9BQU87WUFDVkYsUUFBUU0sSUFBSSxDQUFDLENBQUMsZUFBZSxFQUFFWCxRQUFRLHlCQUF5QixDQUFDO1lBQ2pFLE9BQU9OLHFEQUFZQSxDQUFDa0IsSUFBSSxDQUFDO2dCQUFFQyxTQUFTO1lBQW9CLEdBQUc7Z0JBQUVDLFFBQVE7WUFBSTtRQUMzRTtRQUVBLE1BQU1DLFVBQVVwQiwwREFBVSxDQUFDWSxPQUFPWCw0REFBVUE7UUFDNUNTLFFBQVFDLEdBQUcsQ0FBQyxDQUFDLGVBQWUsRUFBRU4sUUFBUSxXQUFXLEVBQUVlLFFBQVFFLFFBQVEsQ0FBQyxTQUFTLEVBQUVGLFFBQVFHLElBQUksQ0FBQyxTQUFTLEVBQUVILFFBQVFJLFVBQVUsRUFBRTtRQUMzSCxPQUFPekIscURBQVlBLENBQUNrQixJQUFJLENBQUNHO0lBRTNCLEVBQUUsT0FBT0ssT0FBWTtRQUNuQmYsUUFBUWUsS0FBSyxDQUFDLENBQUMsZUFBZSxFQUFFcEIsUUFBUSxnQkFBZ0IsQ0FBQyxFQUFFb0IsTUFBTVAsT0FBTztRQUN4RSxNQUFNUSxXQUFXM0IscURBQVlBLENBQUNrQixJQUFJLENBQUM7WUFBRUMsU0FBUztRQUFrQixHQUFHO1lBQUVDLFFBQVE7UUFBSTtRQUNqRk8sU0FBU2IsT0FBTyxDQUFDYyxNQUFNLENBQUN6QixtRUFBaUJBO1FBQ3pDLE9BQU93QjtJQUNUO0FBQ0Y7QUFFTyxNQUFNRSxVQUFVLGdCQUFnQjtBQUNoQyxNQUFNQyxhQUFhLGlCQUFpQiIsInNvdXJjZXMiOlsiQjpcXFB1cmNoYXNlVHJhY2tlclxcUHVyY2hhc2VUcmFja2VyXFxzcmNcXGFwcFxcYXBpXFxhdXRoXFx1c2VyXFxyb3V0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSBcIm5leHQvc2VydmVyXCI7XG5pbXBvcnQgand0IGZyb20gXCJqc29ud2VidG9rZW5cIjtcbmltcG9ydCB7IEpXVF9TRUNSRVQsIFRPS0VOX0NPT0tJRV9OQU1FIH0gZnJvbSBcIkAvLi4vc2VydmVyL3V0aWxzL2NvbmZpZ1wiO1xuXG4vKipcbiAqIE5BVElWRSBTRVNTSU9OIFZFUklGSUNBVElPTlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gR0VUKHJlcTogTmV4dFJlcXVlc3QpIHtcbiAgY29uc3QgdHJhY2VJZCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZyg3KTtcbiAgY29uc29sZS5sb2coYFtBdXRoXVtOYXRpdmVdWyR7dHJhY2VJZH1dIFNlc3Npb24gVmVyaWZpY2F0aW9uIFN0YXJ0YCk7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB0b2tlbiA9IHJlcS5jb29raWVzLmdldChUT0tFTl9DT09LSUVfTkFNRSk/LnZhbHVlO1xuICAgIFxuICAgIGlmICghdG9rZW4pIHtcbiAgICAgIGNvbnNvbGUud2FybihgW0F1dGhdW05hdGl2ZV1bJHt0cmFjZUlkfV0gTm8gc2Vzc2lvbiB0b2tlbiBmb3VuZC5gKTtcbiAgICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbih7IG1lc3NhZ2U6IFwiTm90IGF1dGhlbnRpY2F0ZWRcIiB9LCB7IHN0YXR1czogNDAxIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGRlY29kZWQgPSBqd3QudmVyaWZ5KHRva2VuLCBKV1RfU0VDUkVUKSBhcyBhbnk7XG4gICAgY29uc29sZS5sb2coYFtBdXRoXVtOYXRpdmVdWyR7dHJhY2VJZH1dIFNVQ0NFU1M6ICR7ZGVjb2RlZC51c2VybmFtZX0gfCBSb2xlOiAke2RlY29kZWQucm9sZX0gfCBEZXB0OiAke2RlY29kZWQuZGVwYXJ0bWVudH1gKTtcbiAgICByZXR1cm4gTmV4dFJlc3BvbnNlLmpzb24oZGVjb2RlZCk7XG5cbiAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgIGNvbnNvbGUuZXJyb3IoYFtBdXRoXVtOYXRpdmVdWyR7dHJhY2VJZH1dIFNlc3Npb24gZXJyb3I6YCwgZXJyb3IubWVzc2FnZSk7XG4gICAgY29uc3QgcmVzcG9uc2UgPSBOZXh0UmVzcG9uc2UuanNvbih7IG1lc3NhZ2U6IFwiU2Vzc2lvbiBleHBpcmVkXCIgfSwgeyBzdGF0dXM6IDQwMSB9KTtcbiAgICByZXNwb25zZS5jb29raWVzLmRlbGV0ZShUT0tFTl9DT09LSUVfTkFNRSk7XG4gICAgcmV0dXJuIHJlc3BvbnNlO1xuICB9XG59XG5cbmV4cG9ydCBjb25zdCBkeW5hbWljID0gJ2ZvcmNlLWR5bmFtaWMnO1xuZXhwb3J0IGNvbnN0IGZldGNoQ2FjaGUgPSAnZm9yY2Utbm8tc3RvcmUnO1xuIl0sIm5hbWVzIjpbIk5leHRSZXNwb25zZSIsImp3dCIsIkpXVF9TRUNSRVQiLCJUT0tFTl9DT09LSUVfTkFNRSIsIkdFVCIsInJlcSIsInRyYWNlSWQiLCJNYXRoIiwicmFuZG9tIiwidG9TdHJpbmciLCJzdWJzdHJpbmciLCJjb25zb2xlIiwibG9nIiwidG9rZW4iLCJjb29raWVzIiwiZ2V0IiwidmFsdWUiLCJ3YXJuIiwianNvbiIsIm1lc3NhZ2UiLCJzdGF0dXMiLCJkZWNvZGVkIiwidmVyaWZ5IiwidXNlcm5hbWUiLCJyb2xlIiwiZGVwYXJ0bWVudCIsImVycm9yIiwicmVzcG9uc2UiLCJkZWxldGUiLCJkeW5hbWljIiwiZmV0Y2hDYWNoZSJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./src/app/api/auth/user/route.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next","vendor-chunks/jsonwebtoken","vendor-chunks/lodash.includes","vendor-chunks/jws","vendor-chunks/lodash.once","vendor-chunks/jwa","vendor-chunks/lodash.isinteger","vendor-chunks/ecdsa-sig-formatter","vendor-chunks/lodash.isplainobject","vendor-chunks/ms","vendor-chunks/lodash.isstring","vendor-chunks/lodash.isnumber","vendor-chunks/lodash.isboolean","vendor-chunks/safe-buffer","vendor-chunks/buffer-equal-constant-time"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fauth%2Fuser%2Froute&page=%2Fapi%2Fauth%2Fuser%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fauth%2Fuser%2Froute.ts&appDir=B%3A%5CPurchaseTracker%5CPurchaseTracker%5Csrc%5Capp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=B%3A%5CPurchaseTracker%5CPurchaseTracker&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();