// Single source of truth for thresholds referenced by both the frontend
// (src/pages/Reports.jsx, src/pages/WarehouseInventory.jsx) and the backend
// (api/cron-alerts.mjs). Plain constants, not yet user-configurable settings.
export const LOW_STOCK_THRESHOLD = 5
export const OVERDUE_REPAIR_DAYS = 14
