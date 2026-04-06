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

/***/ "(rsc)/./src/app/api/auth/user/route.ts":
/*!****************************************!*\
  !*** ./src/app/api/auth/user/route.ts ***!
  \****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   GET: () => (/* binding */ GET),\n/* harmony export */   dynamic: () => (/* binding */ dynamic),\n/* harmony export */   fetchCache: () => (/* binding */ fetchCache)\n/* harmony export */ });\n/* harmony import */ var next_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/server */ \"(rsc)/./node_modules/next/dist/api/server.js\");\n/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! jsonwebtoken */ \"(rsc)/./node_modules/jsonwebtoken/index.js\");\n/* harmony import */ var jsonwebtoken__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(jsonwebtoken__WEBPACK_IMPORTED_MODULE_1__);\n/* harmony import */ var _lib_utils_config__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @/lib/utils/config */ \"(rsc)/./src/lib/utils/config.ts\");\n\n\n\n/**\n * NATIVE SESSION VERIFICATION\n */ async function GET(req) {\n    const traceId = Math.random().toString(36).substring(7);\n    console.log(`[Auth][Native][${traceId}] Session Verification Start`);\n    try {\n        const token = req.cookies.get(_lib_utils_config__WEBPACK_IMPORTED_MODULE_2__.TOKEN_COOKIE_NAME)?.value;\n        if (!token) {\n            console.warn(`[Auth][Native][${traceId}] No session token found.`);\n            return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n                message: \"Not authenticated\"\n            }, {\n                status: 401\n            });\n        }\n        const decoded = jsonwebtoken__WEBPACK_IMPORTED_MODULE_1___default().verify(token, _lib_utils_config__WEBPACK_IMPORTED_MODULE_2__.JWT_SECRET);\n        console.log(`[Auth][Native][${traceId}] SUCCESS: ${decoded.username} | Role: ${decoded.role} | Dept: ${decoded.department}`);\n        return next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json(decoded);\n    } catch (error) {\n        console.error(`[Auth][Native][${traceId}] Session error:`, error.message);\n        const response = next_server__WEBPACK_IMPORTED_MODULE_0__.NextResponse.json({\n            message: \"Session expired\"\n        }, {\n            status: 401\n        });\n        response.cookies.delete(_lib_utils_config__WEBPACK_IMPORTED_MODULE_2__.TOKEN_COOKIE_NAME);\n        return response;\n    }\n}\nconst dynamic = 'force-dynamic';\nconst fetchCache = 'force-no-store';\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvYXBwL2FwaS9hdXRoL3VzZXIvcm91dGUudHMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQUF3RDtBQUV6QjtBQUNvQztBQUVuRTs7Q0FFQyxHQUNNLGVBQWVJLElBQUlDLEdBQWdCO0lBQ3hDLE1BQU1DLFVBQVVDLEtBQUtDLE1BQU0sR0FBR0MsUUFBUSxDQUFDLElBQUlDLFNBQVMsQ0FBQztJQUNyREMsUUFBUUMsR0FBRyxDQUFDLENBQUMsZUFBZSxFQUFFTixRQUFRLDRCQUE0QixDQUFDO0lBRW5FLElBQUk7UUFDRixNQUFNTyxRQUFRUixJQUFJUyxPQUFPLENBQUNDLEdBQUcsQ0FBQ1osZ0VBQWlCQSxHQUFHYTtRQUVsRCxJQUFJLENBQUNILE9BQU87WUFDVkYsUUFBUU0sSUFBSSxDQUFDLENBQUMsZUFBZSxFQUFFWCxRQUFRLHlCQUF5QixDQUFDO1lBQ2pFLE9BQU9OLHFEQUFZQSxDQUFDa0IsSUFBSSxDQUFDO2dCQUFFQyxTQUFTO1lBQW9CLEdBQUc7Z0JBQUVDLFFBQVE7WUFBSTtRQUMzRTtRQUVBLE1BQU1DLFVBQVVwQiwwREFBVSxDQUFDWSxPQUFPWCx5REFBVUE7UUFDNUNTLFFBQVFDLEdBQUcsQ0FBQyxDQUFDLGVBQWUsRUFBRU4sUUFBUSxXQUFXLEVBQUVlLFFBQVFFLFFBQVEsQ0FBQyxTQUFTLEVBQUVGLFFBQVFHLElBQUksQ0FBQyxTQUFTLEVBQUVILFFBQVFJLFVBQVUsRUFBRTtRQUMzSCxPQUFPekIscURBQVlBLENBQUNrQixJQUFJLENBQUNHO0lBRTNCLEVBQUUsT0FBT0ssT0FBWTtRQUNuQmYsUUFBUWUsS0FBSyxDQUFDLENBQUMsZUFBZSxFQUFFcEIsUUFBUSxnQkFBZ0IsQ0FBQyxFQUFFb0IsTUFBTVAsT0FBTztRQUN4RSxNQUFNUSxXQUFXM0IscURBQVlBLENBQUNrQixJQUFJLENBQUM7WUFBRUMsU0FBUztRQUFrQixHQUFHO1lBQUVDLFFBQVE7UUFBSTtRQUNqRk8sU0FBU2IsT0FBTyxDQUFDYyxNQUFNLENBQUN6QixnRUFBaUJBO1FBQ3pDLE9BQU93QjtJQUNUO0FBQ0Y7QUFFTyxNQUFNRSxVQUFVLGdCQUFnQjtBQUNoQyxNQUFNQyxhQUFhLGlCQUFpQiIsInNvdXJjZXMiOlsiQjpcXFB1cmNoYXNlVHJhY2tlclxcUHVyY2hhc2VUcmFja2VyXFxzcmNcXGFwcFxcYXBpXFxhdXRoXFx1c2VyXFxyb3V0ZS50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBOZXh0UmVxdWVzdCwgTmV4dFJlc3BvbnNlIH0gZnJvbSBcIm5leHQvc2VydmVyXCI7XG5pbXBvcnQgeyBBcHBFcnJvciB9IGZyb20gXCJAL2xpYi91dGlscy9lcnJvcnNcIjtcbmltcG9ydCBqd3QgZnJvbSBcImpzb253ZWJ0b2tlblwiO1xuaW1wb3J0IHsgSldUX1NFQ1JFVCwgVE9LRU5fQ09PS0lFX05BTUUgfSBmcm9tIFwiQC9saWIvdXRpbHMvY29uZmlnXCI7XG5cbi8qKlxuICogTkFUSVZFIFNFU1NJT04gVkVSSUZJQ0FUSU9OXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBHRVQocmVxOiBOZXh0UmVxdWVzdCkge1xuICBjb25zdCB0cmFjZUlkID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc3Vic3RyaW5nKDcpO1xuICBjb25zb2xlLmxvZyhgW0F1dGhdW05hdGl2ZV1bJHt0cmFjZUlkfV0gU2Vzc2lvbiBWZXJpZmljYXRpb24gU3RhcnRgKTtcblxuICB0cnkge1xuICAgIGNvbnN0IHRva2VuID0gcmVxLmNvb2tpZXMuZ2V0KFRPS0VOX0NPT0tJRV9OQU1FKT8udmFsdWU7XG4gICAgXG4gICAgaWYgKCF0b2tlbikge1xuICAgICAgY29uc29sZS53YXJuKGBbQXV0aF1bTmF0aXZlXVske3RyYWNlSWR9XSBObyBzZXNzaW9uIHRva2VuIGZvdW5kLmApO1xuICAgICAgcmV0dXJuIE5leHRSZXNwb25zZS5qc29uKHsgbWVzc2FnZTogXCJOb3QgYXV0aGVudGljYXRlZFwiIH0sIHsgc3RhdHVzOiA0MDEgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgZGVjb2RlZCA9IGp3dC52ZXJpZnkodG9rZW4sIEpXVF9TRUNSRVQpIGFzIGFueTtcbiAgICBjb25zb2xlLmxvZyhgW0F1dGhdW05hdGl2ZV1bJHt0cmFjZUlkfV0gU1VDQ0VTUzogJHtkZWNvZGVkLnVzZXJuYW1lfSB8IFJvbGU6ICR7ZGVjb2RlZC5yb2xlfSB8IERlcHQ6ICR7ZGVjb2RlZC5kZXBhcnRtZW50fWApO1xuICAgIHJldHVybiBOZXh0UmVzcG9uc2UuanNvbihkZWNvZGVkKTtcblxuICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgY29uc29sZS5lcnJvcihgW0F1dGhdW05hdGl2ZV1bJHt0cmFjZUlkfV0gU2Vzc2lvbiBlcnJvcjpgLCBlcnJvci5tZXNzYWdlKTtcbiAgICBjb25zdCByZXNwb25zZSA9IE5leHRSZXNwb25zZS5qc29uKHsgbWVzc2FnZTogXCJTZXNzaW9uIGV4cGlyZWRcIiB9LCB7IHN0YXR1czogNDAxIH0pO1xuICAgIHJlc3BvbnNlLmNvb2tpZXMuZGVsZXRlKFRPS0VOX0NPT0tJRV9OQU1FKTtcbiAgICByZXR1cm4gcmVzcG9uc2U7XG4gIH1cbn1cblxuZXhwb3J0IGNvbnN0IGR5bmFtaWMgPSAnZm9yY2UtZHluYW1pYyc7XG5leHBvcnQgY29uc3QgZmV0Y2hDYWNoZSA9ICdmb3JjZS1uby1zdG9yZSc7XG4iXSwibmFtZXMiOlsiTmV4dFJlc3BvbnNlIiwiand0IiwiSldUX1NFQ1JFVCIsIlRPS0VOX0NPT0tJRV9OQU1FIiwiR0VUIiwicmVxIiwidHJhY2VJZCIsIk1hdGgiLCJyYW5kb20iLCJ0b1N0cmluZyIsInN1YnN0cmluZyIsImNvbnNvbGUiLCJsb2ciLCJ0b2tlbiIsImNvb2tpZXMiLCJnZXQiLCJ2YWx1ZSIsIndhcm4iLCJqc29uIiwibWVzc2FnZSIsInN0YXR1cyIsImRlY29kZWQiLCJ2ZXJpZnkiLCJ1c2VybmFtZSIsInJvbGUiLCJkZXBhcnRtZW50IiwiZXJyb3IiLCJyZXNwb25zZSIsImRlbGV0ZSIsImR5bmFtaWMiLCJmZXRjaENhY2hlIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./src/app/api/auth/user/route.ts\n");

/***/ }),

/***/ "(rsc)/./src/lib/utils/config.ts":
/*!*********************************!*\
  !*** ./src/lib/utils/config.ts ***!
  \*********************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   COOKIE_OPTIONS: () => (/* binding */ COOKIE_OPTIONS),\n/* harmony export */   IS_PRODUCTION: () => (/* binding */ IS_PRODUCTION),\n/* harmony export */   JWT_SECRET: () => (/* binding */ JWT_SECRET),\n/* harmony export */   TOKEN_COOKIE_NAME: () => (/* binding */ TOKEN_COOKIE_NAME)\n/* harmony export */ });\nconst JWT_SECRET = process.env.JWT_SECRET || \"E3purchase2026\";\nconst TOKEN_COOKIE_NAME = \"auth_token\";\nconst IS_PRODUCTION = \"development\" === \"production\";\nconst COOKIE_OPTIONS = {\n    httpOnly: true,\n    secure: IS_PRODUCTION,\n    sameSite: \"lax\",\n    path: \"/\",\n    maxAge: 60 * 60 * 24 * 7\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9zcmMvbGliL3V0aWxzL2NvbmZpZy50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQU8sTUFBTUEsYUFBYUMsUUFBUUMsR0FBRyxDQUFDRixVQUFVLElBQUksaUJBQWlCO0FBQzlELE1BQU1HLG9CQUFvQixhQUFhO0FBQ3ZDLE1BQU1DLGdCQUFnQkgsa0JBQXlCLGFBQWE7QUFDNUQsTUFBTUksaUJBQWlCO0lBQzVCQyxVQUFVO0lBQ1ZDLFFBQVFIO0lBQ1JJLFVBQVU7SUFDVkMsTUFBTTtJQUNOQyxRQUFRLEtBQUssS0FBSyxLQUFLO0FBQ3pCLEVBQUUiLCJzb3VyY2VzIjpbIkI6XFxQdXJjaGFzZVRyYWNrZXJcXFB1cmNoYXNlVHJhY2tlclxcc3JjXFxsaWJcXHV0aWxzXFxjb25maWcudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IEpXVF9TRUNSRVQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUIHx8IFwiRTNwdXJjaGFzZTIwMjZcIjtcbmV4cG9ydCBjb25zdCBUT0tFTl9DT09LSUVfTkFNRSA9IFwiYXV0aF90b2tlblwiO1xuZXhwb3J0IGNvbnN0IElTX1BST0RVQ1RJT04gPSBwcm9jZXNzLmVudi5OT0RFX0VOViA9PT0gXCJwcm9kdWN0aW9uXCI7XG5leHBvcnQgY29uc3QgQ09PS0lFX09QVElPTlMgPSB7XG4gIGh0dHBPbmx5OiB0cnVlLFxuICBzZWN1cmU6IElTX1BST0RVQ1RJT04sXG4gIHNhbWVTaXRlOiBcImxheFwiIGFzIGNvbnN0LFxuICBwYXRoOiBcIi9cIixcbiAgbWF4QWdlOiA2MCAqIDYwICogMjQgKiA3LCAvLyA3IGRheXNcbn07XG4iXSwibmFtZXMiOlsiSldUX1NFQ1JFVCIsInByb2Nlc3MiLCJlbnYiLCJUT0tFTl9DT09LSUVfTkFNRSIsIklTX1BST0RVQ1RJT04iLCJDT09LSUVfT1BUSU9OUyIsImh0dHBPbmx5Iiwic2VjdXJlIiwic2FtZVNpdGUiLCJwYXRoIiwibWF4QWdlIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./src/lib/utils/config.ts\n");

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