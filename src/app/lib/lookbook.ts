/**
 * Client entry point for the lookbook print composer. The implementation lives
 * in shared/ so the worker's render pipeline can produce the same document; the
 * client passes its CollateralBrand, which is structurally a LookbookBrand.
 */
export { buildLookbookDoc } from "../../shared/lookbook-doc";
