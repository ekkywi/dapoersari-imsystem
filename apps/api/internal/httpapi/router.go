package httpapi

import (
	"net/http"
	"time"

	"dapoersari-imsystem/apps/api/internal/activity"
	"dapoersari-imsystem/apps/api/internal/auth"
	"dapoersari-imsystem/apps/api/internal/dashboard"
	"dapoersari-imsystem/apps/api/internal/history"
	"dapoersari-imsystem/apps/api/internal/httpapi/middleware"
	"dapoersari-imsystem/apps/api/internal/httpapi/respond"
	"dapoersari-imsystem/apps/api/internal/kitchen"
	"dapoersari-imsystem/apps/api/internal/opname"
	"dapoersari-imsystem/apps/api/internal/transfer"
	"dapoersari-imsystem/apps/api/internal/warehouse"
)

// NewRouter builds the HTTP mux for the API.
func NewRouter(
	corsOrigin string,
	authHandler *auth.Handler,
	authSvc *auth.Service,
	warehouseHandler *warehouse.Handler,
	kitchenHandler *kitchen.Handler,
	transferHandler *transfer.Handler,
	opnameHandler *opname.Handler,
	historyHandler *history.Handler,
	activityHandler *activity.Handler,
	dashboardHandler *dashboard.Handler,
) http.Handler {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		respond.JSON(w, http.StatusOK, map[string]any{
			"status":    "ok",
			"service":   "dapoersari-api",
			"time":      time.Now().UTC().Format(time.RFC3339),
			"apiPrefix": "/api/v1",
		})
	})

	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		respond.JSON(w, http.StatusOK, map[string]string{
			"status": "ok",
		})
	})

	authOnly := func(h http.HandlerFunc) http.Handler {
		return middleware.Auth(authSvc)(h)
	}
	superAdminOnly := func(h http.HandlerFunc) http.Handler {
		return middleware.Auth(authSvc)(
			middleware.RequireRole(auth.RoleSuperAdmin)(h),
		)
	}
	warehouseWrite := func(h http.HandlerFunc) http.Handler {
		return middleware.Auth(authSvc)(
			middleware.RequireRole(auth.RoleSuperAdmin, auth.RoleAdminGudang)(h),
		)
	}
	kitchenWrite := func(h http.HandlerFunc) http.Handler {
		return middleware.Auth(authSvc)(
			middleware.RequireRole(auth.RoleSuperAdmin, auth.RoleAdminKitchen)(h),
		)
	}

	// Auth — login rate-limited (IP + email, in-memory)
	loginLimit := middleware.LoginRateLimit(middleware.NewLoginRateLimiter())
	mux.Handle("POST /api/v1/auth/login", loginLimit(http.HandlerFunc(authHandler.Login)))
	mux.Handle("GET /api/v1/auth/me", authOnly(authHandler.Me))

	// Admin — Super Admin only (soft deactivate; no hard delete)
	mux.Handle("GET /api/v1/admin/users", superAdminOnly(authHandler.ListUsers))
	mux.Handle("POST /api/v1/admin/users", superAdminOnly(authHandler.CreateUser))
	mux.Handle("PATCH /api/v1/admin/users/{userID}", superAdminOnly(authHandler.PatchUser))
	mux.Handle("POST /api/v1/admin/users/{userID}/reset-password", superAdminOnly(authHandler.ResetPassword))

	// Warehouse
	mux.Handle("GET /api/v1/warehouse/units", authOnly(warehouseHandler.ListUnits))
	mux.Handle("POST /api/v1/warehouse/units", warehouseWrite(warehouseHandler.CreateUnit))
	mux.Handle("PATCH /api/v1/warehouse/units/{unitID}", warehouseWrite(warehouseHandler.PatchUnit))
	mux.Handle("GET /api/v1/warehouse/categories", authOnly(warehouseHandler.ListCategories))
	mux.Handle("POST /api/v1/warehouse/categories", warehouseWrite(warehouseHandler.CreateCategory))
	mux.Handle("PATCH /api/v1/warehouse/categories/{categoryID}", warehouseWrite(warehouseHandler.PatchCategory))
	mux.Handle("GET /api/v1/warehouse/suppliers", authOnly(warehouseHandler.ListSuppliers))
	mux.Handle("POST /api/v1/warehouse/suppliers", warehouseWrite(warehouseHandler.CreateSupplier))
	mux.Handle("PATCH /api/v1/warehouse/suppliers/{supplierID}", warehouseWrite(warehouseHandler.PatchSupplier))
	mux.Handle("GET /api/v1/warehouse/items", authOnly(warehouseHandler.ListItems))
	mux.Handle("POST /api/v1/warehouse/items", warehouseWrite(warehouseHandler.CreateItem))
	mux.Handle("PATCH /api/v1/warehouse/items/{itemID}", warehouseWrite(warehouseHandler.PatchItem))
	mux.Handle("GET /api/v1/warehouse/stocks", authOnly(warehouseHandler.ListWarehouseStocks))
	mux.Handle("GET /api/v1/warehouse/stocks/{itemID}", authOnly(warehouseHandler.GetWarehouseStock))
	mux.Handle("GET /api/v1/warehouse/stock-ins", authOnly(warehouseHandler.ListStockIns))
	mux.Handle("GET /api/v1/warehouse/stock-ins/{stockInID}", authOnly(warehouseHandler.GetStockIn))
	mux.Handle("POST /api/v1/warehouse/stock-ins", warehouseWrite(warehouseHandler.CreateStockIn))

	// Kitchen — recipes + kitchen stock + closing
	mux.Handle("GET /api/v1/kitchen/menus", authOnly(kitchenHandler.ListMenus))
	mux.Handle("GET /api/v1/kitchen/menus/{menuID}", authOnly(kitchenHandler.GetMenu))
	mux.Handle("POST /api/v1/kitchen/menus", kitchenWrite(kitchenHandler.CreateMenu))
	mux.Handle("PATCH /api/v1/kitchen/menus/{menuID}", kitchenWrite(kitchenHandler.PatchMenu))
	mux.Handle("PUT /api/v1/kitchen/menus/{menuID}/recipe", kitchenWrite(kitchenHandler.ReplaceRecipe))
	mux.Handle("GET /api/v1/kitchen/stocks", authOnly(kitchenHandler.ListKitchenStocks))
	mux.Handle("GET /api/v1/kitchen/closings", authOnly(kitchenHandler.ListClosings))
	mux.Handle("GET /api/v1/kitchen/closings/{closingID}", authOnly(kitchenHandler.GetClosing))
	mux.Handle("POST /api/v1/kitchen/closings", kitchenWrite(kitchenHandler.CreateClosing))

	// Transfer / stock requests
	mux.Handle("GET /api/v1/stock-requests", authOnly(transferHandler.List))
	mux.Handle("GET /api/v1/stock-requests/{requestID}", authOnly(transferHandler.Get))
	mux.Handle("POST /api/v1/stock-requests", kitchenWrite(transferHandler.Create))
	mux.Handle("POST /api/v1/stock-requests/{requestID}/approve", warehouseWrite(transferHandler.Approve))
	mux.Handle("POST /api/v1/stock-requests/{requestID}/reject", warehouseWrite(transferHandler.Reject))
	mux.Handle("POST /api/v1/stock-requests/{requestID}/transfer", warehouseWrite(transferHandler.Transfer))
	mux.Handle("POST /api/v1/stock-requests/{requestID}/receive", kitchenWrite(transferHandler.Receive))
	mux.Handle("POST /api/v1/stock-requests/{requestID}/cancel", kitchenWrite(transferHandler.Cancel))

	// Opname — role vs location enforced in service
	mux.Handle("GET /api/v1/opnames", authOnly(opnameHandler.List))
	mux.Handle("GET /api/v1/opnames/{opnameID}", authOnly(opnameHandler.Get))
	mux.Handle("POST /api/v1/opnames", authOnly(opnameHandler.Create))
	mux.Handle("POST /api/v1/opnames/{opnameID}/confirm", authOnly(opnameHandler.Confirm))

	// History / activity
	mux.Handle("GET /api/v1/history/stock", authOnly(historyHandler.ListStock))
	mux.Handle("GET /api/v1/history/activity", authOnly(activityHandler.List))

	// Dashboard / alerts (rules-based)
	mux.Handle("GET /api/v1/dashboard/summary", authOnly(dashboardHandler.Summary))
	mux.Handle("GET /api/v1/alerts/low-stock", authOnly(dashboardHandler.LowStock))

	return middleware.CORS(corsOrigin)(mux)
}
