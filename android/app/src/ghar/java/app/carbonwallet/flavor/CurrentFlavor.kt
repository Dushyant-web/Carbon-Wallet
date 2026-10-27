package app.carbonwallet.flavor

import android.app.Activity
import app.carbonwallet.core.DemoAccount
import app.carbonwallet.core.FlavorSpec
import app.carbonwallet.core.TabSpec
import app.carbonwallet.core.model.Me
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.ghar.BillsTab
import app.carbonwallet.ghar.CardTab
import app.carbonwallet.ghar.HomeTab
import app.carbonwallet.ghar.MohallaTab
import app.carbonwallet.ghar.YojanaTab
import app.carbonwallet.ghar.homePath
import app.carbonwallet.google.GoogleAuth

/** Ghar: the household app. The same five places as the website's menu (PLAN-V2 §4.2). */
object CurrentFlavor : FlavorSpec {
    override val serviceEn = "Ghar · your home's carbon account"
    override val serviceHi = "घर · आपके घर का कार्बन खाता"

    override val tabs = listOf(
        TabSpec("My home", "मेरा घर", Lucide.Home) { HomeTab(it) },
        TabSpec("Bill", "बिजली बिल", Lucide.Bill) { BillsTab(it) },
        TabSpec("Mohalla", "मोहल्ला", Lucide.MapPin) { MohallaTab(it) },
        TabSpec("Card & items", "कार्ड-सामान", Lucide.Card) { CardTab(it) },
        TabSpec("Schemes", "योजना", Lucide.Landmark) { YojanaTab(it) },
    )

    override fun accountProblem(me: Me): Pair<String, String>? = when (me.user.platformRole) {
        "MERCHANT" -> "This is a shop account. Use the Carbon Dukaan app." to "यह दुकान का खाता है। Carbon Dukaan ऐप इस्तेमाल करें।"
        "ADMIN" -> "This is an admin account. Use the Carbon Admin app." to "यह एडमिन खाता है। Carbon Admin ऐप इस्तेमाल करें।"
        else -> null
    }

    override val googleIdToken: (suspend (Activity) -> String) = GoogleAuth::idToken
    override val googleRole = "household"

    override val demoAccounts = listOf(
        DemoAccount("Sharma Residence · Owner", "arjun.sharma@example.com", "CarbonDemo#2026"),
    )

    override fun prefetch(me: Me): List<String> {
        val id = me.households.firstOrNull()?.id ?: return listOf("/api/public/updates")
        return listOf("overview", "bills", "mohalla", "passbook", "appliances", "vehicles", "removals", "schemes").map { homePath(id, it) } +
            listOf("/api/public/updates", "/api/notifications")
    }
}
