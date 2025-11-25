// Legacy compatibility shim to provide the in-memory router when imported directly.
import createProductsRouter from "./products.js";

export default createProductsRouter({ useMemoryStore: true });
