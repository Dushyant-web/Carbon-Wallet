package app.carbonwallet.dukaan

import kotlinx.serialization.Serializable

/** GET /api/merchant/dashboard */
@Serializable
data class Dashboard(
    val shop: Shop? = null,
    val kpis: ShopKpis = ShopKpis(),
    val byMonth: List<MonthSales> = emptyList(),
    val topProducts: List<TopProduct> = emptyList(),
    val recent: List<RecentSale> = emptyList(),
)

@Serializable
data class Shop(val name: String = "", val city: String = "", val sells: String = "APPLIANCES")

@Serializable
data class ShopKpis(
    val itemsThisMonth: Int = 0,
    val itemsTotal: Int = 0,
    val customers: Int = 0,
    val scansThisMonth: Int = 0,
    val efficientPct: Int = 0,
    val rejected: Int = 0,
    val schemesExplained: Int = 0,
    val schemesApplied: Int = 0,
    val catalogueItems: Int = 0,
    val revenueInr: Double = 0.0,
)

@Serializable
data class MonthSales(val month: String = "", val items: Int = 0, val efficient: Int = 0)

@Serializable
data class TopProduct(val title: String = "", val sold: Int = 0)

@Serializable
data class RecentSale(val id: String, val summary: String = "", val status: String = "", val at: String = "", val carbonId: String? = null)

/** GET /api/merchant/catalogue */
@Serializable
data class CatalogueResponse(val items: List<CatalogueItem> = emptyList())

@Serializable
data class CatalogueItem(
    val id: String,
    val sku: String? = null,
    val kind: String = "APPLIANCE",
    val type: String = "",
    val brand: String = "",
    val model: String = "",
    val title: String = "",
    val description: String? = null,
    val priceInr: Double? = null,
    val stars: Int? = null,
    val inverter: Boolean = false,
    val capacityTon: Double? = null,
    val fuel: String? = null,
    val kmPerUnit: Double? = null,
    val warrantyYears: Int? = null,
    val active: Boolean = true,
    val imageUrl: String? = null,
    val sold: Int = 0,
    val facts: CatalogueFacts? = null,
)

@Serializable
data class CatalogueFacts(
    val yearlyKwh: Double? = null,
    val yearlyRupees: Double? = null,
    val yearlyKg: Double? = null,
    val efficiency: String? = null,
    val benefitInr: Double? = null,
    val benefitNote: String? = null,
)

/** GET /api/merchant/sales */
@Serializable
data class SalesResponse(val sales: List<Sale> = emptyList())

@Serializable
data class Sale(
    val id: String,
    val kind: String = "",
    val summary: String = "",
    val invoiceRef: String? = null,
    val status: String = "",
    val carbonId: String? = null,
    val createdAt: String = "",
    val closedAt: String? = null,
)

/** POST /api/merchant/scan: a 15-minute ticket for one customer's home */
@Serializable
data class ScanResult(
    val ticket: String,
    val expiresAt: String = "",
    val customer: Customer = Customer(),
    val advice: Advice = Advice(),
)

@Serializable
data class Customer(val carbonId: String? = null, val name: String = "", val city: String = "", val state: String = "")

@Serializable
data class Advice(val status: CounterStatus? = null, val benefits: List<Benefit> = emptyList())

@Serializable
data class CounterStatus(val colour: String = "", val sentence: String = "")

@Serializable
data class Benefit(
    val slug: String,
    val name: String = "",
    val benefit: String = "",
    val link: String? = null,
    val helpline: String? = null,
    val status: String = "",
    val matched: Boolean = false,
    val why: String? = null,
)

/** POST /api/merchant/sales */
@Serializable
data class SaleCreated(val sale: SaleSummary, val item: SaleItem? = null)

@Serializable
data class SaleSummary(val id: String, val kind: String = "", val summary: String = "")

@Serializable
data class SaleItem(val id: String, val name: String = "")
