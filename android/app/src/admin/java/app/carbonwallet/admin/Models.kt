package app.carbonwallet.admin

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** GET /api/admin/overview?users=N */
@Serializable
data class AdminOverview(
    val stats: Stats = Stats(),
    val deletions: Deletions = Deletions(),
    val users: List<AdminUser> = emptyList(),
    val audit: List<AuditEntry> = emptyList(),
)

@Serializable
data class Stats(
    val users: Int = 0,
    val usersWithLogin: Int = 0,
    val admins: Int = 0,
    val merchants: Int = 0,
    val merchantsPending: Int = 0,
    val households: Int = 0,
    val activities: Int = 0,
)

@Serializable
data class Deletions(val pending: List<PendingDeletion> = emptyList())

@Serializable
data class PendingDeletion(val kind: String = "", val name: String = "", val requestedAt: String? = null, val eraseOn: String? = null)

@Serializable
data class AdminUser(
    val id: String,
    val name: String = "",
    val email: String = "",
    val platformRole: String = "USER",
    val status: String = "ACTIVE",
    val lastLoginAt: String? = null,
    val createdAt: String = "",
    val households: Int = 0,
)

@Serializable
data class AuditEntry(val id: String, val at: String = "", val action: String = "", val details: String? = null, val user: String = "", val household: String = "")

/** GET /api/admin/merchants */
@Serializable
data class MerchantsResponse(val merchants: List<AdminMerchant> = emptyList())

@Serializable
data class AdminMerchant(
    val id: String,
    val businessName: String = "",
    val gstin: String? = null,
    val city: String = "",
    val state: String = "",
    val sells: String = "",
    val status: String = "PENDING",
    val contact: MerchantContact? = null,
    val createdAt: String = "",
    val reviewedAt: String? = null,
    val registered: Int = 0,
    val rejected: Int = 0,
)

@Serializable
data class MerchantContact(val name: String = "", val email: String = "", val accountStatus: String = "")

/** GET /api/admin/removals */
@Serializable
data class RemovalsResponse(val requests: List<AdminRemoval> = emptyList())

@Serializable
data class AdminRemoval(
    val id: String,
    val kind: String = "",
    val itemSummary: String = "",
    val shopName: String? = null,
    val reason: String = "",
    val note: String? = null,
    val status: String = "PENDING",
    val decisionNote: String? = null,
    val createdAt: String = "",
    val decidedAt: String? = null,
    val photoIds: List<String> = emptyList(),
    val household: RemovalHousehold? = null,
)

@Serializable
data class RemovalHousehold(
    val id: String = "",
    val name: String = "",
    val city: String = "",
    val carbonId: String? = null,
    val requestsEver: Int = 0,
    val recentBills: List<RecentBill> = emptyList(),
)

@Serializable
data class RecentBill(val month: String = "", val kwh: Double = 0.0)

/** GET /api/admin/grievances */
@Serializable
data class GrievancesResponse(val tickets: List<Ticket> = emptyList())

@Serializable
data class Ticket(
    val id: String,
    val ticket: String = "",
    val category: String = "",
    val subject: String = "",
    val message: String = "",
    val status: String = "OPEN",
    val response: String? = null,
    val createdAt: String = "",
    val from: TicketFrom? = null,
)

@Serializable
data class TicketFrom(val name: String = "", val email: String = "", val platformRole: String = "")

/** GET /api/admin/schemes */
@Serializable
data class AdminSchemes(val schemes: List<AdminScheme> = emptyList())

@Serializable
data class AdminScheme(
    val slug: String,
    val category: String = "",
    val name: String = "",
    val nameHi: String? = null,
    val summary: String = "",
    val benefit: String = "",
    val states: String = "",
    val status: String = "ACTIVE",
    val lastChecked: String? = null,
    val link: String? = null,
    val explained: Int = 0,
    val applied: Int = 0,
)

/** GET /api/admin/ml: the forecast model's health */
@Serializable
data class MlStatus(val trained: Boolean = false, val info: MlInfo? = null, val data: MlData? = null)

@Serializable
data class MlInfo(
    val version: String? = null,
    @SerialName("trained_at") val trainedAt: String? = null,
    val homes: Int = 0,
    @SerialName("held_out") val heldOut: HeldOut? = null,
    @SerialName("beats_baseline") val beatsBaseline: Boolean = false,
)

@Serializable
data class HeldOut(
    val model: Score? = null,
    @SerialName("same_as_last_month") val lastMonth: Score? = null,
)

@Serializable
data class Score(@SerialName("mae_kg") val maeKg: Double? = null, @SerialName("mape_pct") val mapePct: Double? = null, val r2: Double? = null)

@Serializable
data class MlData(val homesWithHistory: Int = 0, val homeMonths: Int = 0, val demoHomes: Int = 0, val realHomes: Int = 0)
