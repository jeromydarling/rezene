// FreeSewing ships JavaScript with JSDoc, not TypeScript declarations, so give
// the packages we use ambient module shims. The design classes are constructed
// with a settings object and expose .use()/.draft()/.render(); we treat them
// loosely here and narrow at the call site (src/app/lib/patterns.ts).
declare module "@freesewing/core";
declare module "@freesewing/plugin-theme";
declare module "@freesewing/teagan";
declare module "@freesewing/titan";
declare module "@freesewing/penelope";
declare module "@freesewing/sven";
declare module "@freesewing/sophie";
