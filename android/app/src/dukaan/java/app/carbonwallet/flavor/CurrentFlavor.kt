package app.carbonwallet.flavor

import android.app.Activity
import app.carbonwallet.core.DemoAccount
import app.carbonwallet.core.FlavorSpec
import app.carbonwallet.core.TabSpec
import app.carbonwallet.core.model.Me
import app.carbonwallet.core.ui.Lucide
import app.carbonwallet.dukaan.CatalogueTab
import app.carbonwallet.dukaan.CounterTab
import app.carbonwallet.dukaan.SalesTab
import app.carbonwallet.dukaan.ShopTab
import app.carbonwallet.google.GoogleAuth

/** Dukaan: the shop app. It opens straight on "Scan card" (PLAN-V2 §12). */
object CurrentFlavor : FlavorSpec {
    override val serviceEn = "Dukaan · shop counter"
    override val serviceHi = "दुकान · काउंटर"

    override val tabs = listOf(
        TabSpec("Scan card", "कार्ड स्कैन", Lucide.Scan) { CounterTab(it) },
        TabSpec("My shop", "मेरी दुकान", Lucide.Store) { ShopTab(it) },
        TabSpec("Sales", "बिक्री", Lucide.Receipt) { SalesTab(it) },
        TabSpec("Catalogue", "कैटलॉग", Lucide.Package) { CatalogueTab(it) },
    )

    override fun accountProblem(me: Me): Pair<String, String>? =
        if (me.user.platformRole == "MERCHANT") null
        else "This app is for registered shops. Households use Carbon Ghar." to "यह ऐप पंजीकृत दुकानों के लिए है। घर वाले Carbon Ghar इस्तेमाल करें।"

    override val googleIdToken: (suspend (Activity) -> String) = GoogleAuth::idToken
    override val googleRole = "merchant"

    override val demoAccounts = listOf(
        DemoAccount("Demo Appliances, Noida", "counter@demo-appliances.example.com", "ShopDemo#2026"),
    )

    override fun prefetch(me: Me) = listOf(
        "/api/merchant/dashboard",
        "/api/merchant/catalogue",
        "/api/merchant/sales",
        "/api/notifications",
    )
}
