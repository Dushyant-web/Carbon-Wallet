package app.carbonwallet.flavor

import android.app.Activity
import app.carbonwallet.admin.ComplaintsTab
import app.carbonwallet.admin.OVERVIEW_PATH
import app.carbonwallet.admin.OverviewTab
import app.carbonwallet.admin.RemovalsTab
import app.carbonwallet.admin.SchemesTab
import app.carbonwallet.admin.ShopsTab
import app.carbonwallet.core.DemoAccount
import app.carbonwallet.core.FlavorSpec
import app.carbonwallet.core.TabSpec
import app.carbonwallet.core.model.Me
import app.carbonwallet.core.ui.Lucide

/** Admin: the decisions queue for Carbon Wallet staff, on the phone. Password sign-in only (the server refuses Google for admins). */
object CurrentFlavor : FlavorSpec {
    override val serviceEn = "Admin · platform desk"
    override val serviceHi = "एडमिन · प्लेटफ़ॉर्म डेस्क"

    override val tabs = listOf(
        TabSpec("Overview", "सारांश", Lucide.Gauge) { OverviewTab(it) },
        TabSpec("Shops", "दुकानें", Lucide.Store) { ShopsTab(it) },
        TabSpec("Removals", "हटाना", Lucide.Package) { RemovalsTab(it) },
        TabSpec("Help desk", "शिकायत", Lucide.LifeBuoy) { ComplaintsTab(it) },
        TabSpec("Schemes", "योजना", Lucide.Landmark) { SchemesTab(it) },
    )

    override fun accountProblem(me: Me): Pair<String, String>? =
        if (me.user.platformRole == "ADMIN") null
        else "This app is for Carbon Wallet admins only." to "यह ऐप सिर्फ़ Carbon Wallet एडमिन के लिए है।"

    override val googleIdToken: (suspend (Activity) -> String)? = null
    override val googleRole: String? = null

    override val demoAccounts = listOf(DemoAccount("Platform admin", "admin@carbonwallet.in", "AdminDemo#2026"))

    override fun prefetch(me: Me) = listOf(
        OVERVIEW_PATH,
        "/api/admin/ml",
        "/api/admin/merchants",
        "/api/admin/removals",
        "/api/admin/grievances",
        "/api/admin/schemes",
        "/api/notifications",
    )
}
