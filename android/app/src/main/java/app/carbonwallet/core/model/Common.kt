package app.carbonwallet.core.model

import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val name: String = "",
    val email: String = "",
    val platformRole: String = "USER",
)

@Serializable
data class HouseholdRef(val id: String, val name: String = "", val role: String = "VIEWER")

/** GET /api/auth/me */
@Serializable
data class Me(val user: User, val households: List<HouseholdRef> = emptyList())

@Serializable
data class LoginResponse(val user: User)

/** POST /api/auth/google/idtoken */
@Serializable
data class GoogleTokenResponse(val token: String, val user: User)

/** GET /api/notifications */
@Serializable
data class NotificationsPage(
    val items: List<NotificationItem> = emptyList(),
    val total: Int = 0,
    val unread: Int = 0,
)

@Serializable
data class NotificationItem(
    val id: String,
    val kind: String = "",
    val title: String = "",
    val body: String = "",
    val url: String? = null,
    val read: Boolean = false,
    val at: String = "",
)

/** GET /api/public/updates: the "What's new" ticker */
@Serializable
data class PortalUpdates(val updates: List<PortalUpdate> = emptyList(), val stats: PortalStats? = null)

@Serializable
data class PortalUpdate(val tag: String = "", val en: String = "", val hi: String = "", val href: String = "")

@Serializable
data class PortalStats(
    val homes: Int = 0,
    val shops: Int = 0,
    val mohallas: Int = 0,
    val sealedDays: Int = 0,
    val lastUpdated: String? = null,
)
